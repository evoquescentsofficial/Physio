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
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  generateSchedule: z.boolean().optional(),
  scheduleFrequencyDays: z.number().int().min(1).optional(),
  installments: z
    .array(z.object({ amount: z.number().min(0), dueDate: z.string() }))
    .optional(),
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
        installments: data.installments
          ? {
              create: data.installments.map((i) => ({
                amount: i.amount,
                dueDate: new Date(i.dueDate),
              })),
            }
          : undefined,
      },
      include: { installments: true },
    });

    if (data.generateSchedule) {
      const freq = data.scheduleFrequencyDays ?? 2;
      const visits = Array.from({ length: data.totalSessions }).map((_, idx) => {
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + idx * freq);
        return {
          patientId: data.patientId,
          packageId: pkg.id,
          diagnosisId: data.diagnosisId || null,
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
