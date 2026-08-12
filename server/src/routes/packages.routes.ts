import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const packageSchema = z.object({
  patientId: z.string().min(1),
  diagnosisId: z.string().optional().nullable(),
  title: z.string().min(1),
  totalSessions: z.number().int().min(1),
  feePerSession: z.number().min(0),
  startDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  doctorId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  generateSchedule: z.boolean().optional(),
  scheduleFrequencyDays: z.number().int().min(1).optional(),
  installments: z
    .array(z.object({ amount: z.number().min(0), dueDate: z.string() }))
    .optional(),
  // Advance collected up front; the remaining balance is split across `installmentCount`
  // monthly installments starting one month after the package start date.
  advanceAmount: z.number().min(0).optional(),
  advanceMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER']).optional(),
  installmentCount: z.number().int().min(0).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const patientId = req.query.patientId as string | undefined;
    const packages = await prisma.treatmentPackage.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { name: true, phone: true } },
        visits: true,
        installments: true,
        payments: true,
      },
    });
    res.json(packages);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const pkg = await prisma.treatmentPackage.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        visits: { orderBy: { scheduledDate: 'asc' } },
        installments: { orderBy: { dueDate: 'asc' } },
        payments: { orderBy: { date: 'desc' } },
      },
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    res.json(pkg);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = packageSchema.parse(req.body);
    const totalFee = data.totalSessions * data.feePerSession;
    const startDate = data.startDate ? new Date(data.startDate) : new Date();

    const advanceAmount = data.advanceAmount ?? 0;
    const installmentCount = data.installmentCount ?? 0;

    // Explicit installments win; otherwise split the balance after the advance evenly,
    // giving the last installment any rounding remainder so the parts sum to the balance.
    let installmentPlan = data.installments?.map((i) => ({
      amount: i.amount,
      dueDate: new Date(i.dueDate),
    }));

    const balanceAfterAdvance = Math.max(totalFee - advanceAmount, 0);

    // Nothing left to owe (advance covered or exceeded the total) means no installments —
    // otherwise the package would be given a schedule of zero-rupee payments.
    if (!installmentPlan && installmentCount > 0 && balanceAfterAdvance > 0) {
      const balance = balanceAfterAdvance;
      const per = Math.floor(balance / installmentCount);
      installmentPlan = Array.from({ length: installmentCount }).map((_, idx) => {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + idx + 1);
        const amount = idx === installmentCount - 1 ? balance - per * (installmentCount - 1) : per;
        return { amount, dueDate };
      });
    }

    const pkg = await prisma.treatmentPackage.create({
      data: {
        patientId: data.patientId,
        diagnosisId: data.diagnosisId || null,
        title: data.title,
        totalSessions: data.totalSessions,
        feePerSession: data.feePerSession,
        totalFee,
        startDate,
        notes: data.notes || null,
        installments: installmentPlan ? { create: installmentPlan } : undefined,
      },
      include: { installments: true },
    });

    if (advanceAmount > 0) {
      await prisma.payment.create({
        data: {
          patientId: data.patientId,
          packageId: pkg.id,
          amount: advanceAmount,
          type: 'ADVANCE',
          method: data.advanceMethod || 'CASH',
          date: startDate,
          notes: `Advance for ${data.title}`,
        },
      });
    }

    if (data.generateSchedule) {
      const freq = data.scheduleFrequencyDays ?? 2;
      const visits = Array.from({ length: data.totalSessions }).map((_, idx) => {
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + idx * freq);
        return {
          patientId: data.patientId,
          packageId: pkg.id,
          diagnosisId: data.diagnosisId || null,
          doctorId: data.doctorId || null,
          sessionNumber: idx + 1,
          scheduledDate,
          type: 'SESSION' as const,
          fee: data.feePerSession,
        };
      });
      await prisma.visit.createMany({ data: visits });
    }

    res.status(201).json(pkg);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = packageSchema.partial().parse(req.body);
    const totalFee =
      data.totalSessions !== undefined && data.feePerSession !== undefined
        ? data.totalSessions * data.feePerSession
        : undefined;
    const pkg = await prisma.treatmentPackage.update({
      where: { id: req.params.id },
      data: {
        title: data.title,
        totalSessions: data.totalSessions,
        feePerSession: data.feePerSession,
        totalFee,
        status: data.status,
        notes: data.notes,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
      },
    });
    res.json(pkg);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.treatmentPackage.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

/**
 * Extend a package that has run its course: books more sessions and, when they are chargeable,
 * raises the package's session count and total fee so the extra work is actually billed.
 */
router.post(
  '/:id/extend',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        extraSessions: z.number().int().min(1).max(60),
        feePerSession: z.number().min(0).optional(),
        startDate: z.string(),
        frequencyDays: z.number().int().min(1).default(2),
        chargeable: z.boolean().default(true),
      })
      .parse(req.body);

    const pkg = await prisma.treatmentPackage.findUnique({ where: { id: req.params.id } });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const fee = data.feePerSession ?? pkg.feePerSession;
    const startDate = new Date(data.startDate);

    const last = await prisma.visit.findFirst({
      where: { packageId: pkg.id },
      orderBy: { sessionNumber: 'desc' },
      select: { sessionNumber: true },
    });
    const firstNumber = (last?.sessionNumber ?? 0) + 1;

    const visits = Array.from({ length: data.extraSessions }).map((_, i) => {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + i * data.frequencyDays);
      return {
        patientId: pkg.patientId,
        packageId: pkg.id,
        diagnosisId: pkg.diagnosisId,
        sessionNumber: firstNumber + i,
        scheduledDate,
        type: 'SESSION',
        fee,
      };
    });
    await prisma.visit.createMany({ data: visits });

    const updated = await prisma.treatmentPackage.update({
      where: { id: pkg.id },
      data: data.chargeable
        ? {
            totalSessions: pkg.totalSessions + data.extraSessions,
            totalFee: pkg.totalFee + data.extraSessions * fee,
            status: 'ACTIVE',
          }
        : { status: 'ACTIVE' },
    });

    res.status(201).json({ package: updated, added: visits.length });
  })
);

// Installments
const installmentSchema = z.object({
  amount: z.number().min(0),
  dueDate: z.string(),
  notes: z.string().optional().nullable(),
});

router.post(
  '/:id/installments',
  asyncHandler(async (req, res) => {
    const data = installmentSchema.parse(req.body);
    const inst = await prisma.installment.create({
      data: {
        packageId: req.params.id,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        notes: data.notes || null,
      },
    });
    res.status(201).json(inst);
  })
);

router.put(
  '/installments/:instId',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        amount: z.number().min(0).optional(),
        dueDate: z.string().optional(),
        status: z.enum(['PENDING', 'PAID', 'OVERDUE']).optional(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const inst = await prisma.installment.update({
      where: { id: req.params.instId },
      data: {
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        status: data.status,
        notes: data.notes,
        paidDate: data.status === 'PAID' ? new Date() : undefined,
      },
    });
    res.json(inst);
  })
);

router.delete(
  '/installments/:instId',
  asyncHandler(async (req, res) => {
    await prisma.installment.delete({ where: { id: req.params.instId } });
    res.status(204).end();
  })
);

export default router;
