import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const visitSchema = z.object({
  patientId: z.string().min(1),
  packageId: z.string().optional().nullable(),
  diagnosisId: z.string().optional().nullable(),
  doctorId: z.string().optional().nullable(),
  sessionNumber: z.number().int().optional().nullable(),
  scheduledDate: z.string(),
  type: z.enum(['INITIAL_CONSULT', 'SESSION', 'FOLLOWUP']).default('SESSION'),
  fee: z.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
  treatmentNotes: z.string().optional().nullable(),
  // Book a run of sessions in one go: `count` visits spaced `frequencyDays` apart,
  // starting at scheduledDate.
  count: z.number().int().min(1).max(60).default(1),
  frequencyDays: z.number().int().min(1).default(2),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { patientId, from, to, attendance, doctorId } = req.query as Record<string, string>;
    const visits = await prisma.visit.findMany({
      where: {
        patientId: patientId || undefined,
        attendance: (attendance as any) || undefined,
        doctorId: doctorId || undefined,
        scheduledDate:
          from || to
            ? {
                gte: from ? new Date(from) : undefined,
                lte: to ? new Date(to) : undefined,
              }
            : undefined,
      },
      orderBy: { scheduledDate: 'asc' },
      include: {
        patient: { select: { name: true, phone: true } },
        package: { select: { title: true } },
        doctor: { select: { id: true, name: true } },
      },
    });
    res.json(visits);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { count, frequencyDays, ...data } = visitSchema.parse(req.body);
    const startDate = new Date(data.scheduledDate);

    // Continue the package's existing numbering rather than restarting at 1.
    let nextNumber = data.sessionNumber ?? null;
    if (nextNumber == null && data.packageId) {
      const last = await prisma.visit.findFirst({
        where: { packageId: data.packageId },
        orderBy: { sessionNumber: 'desc' },
        select: { sessionNumber: true },
      });
      nextNumber = (last?.sessionNumber ?? 0) + 1;
    }

    const visits = Array.from({ length: count }).map((_, i) => {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + i * frequencyDays);
      return {
        ...data,
        scheduledDate,
        sessionNumber: nextNumber == null ? null : nextNumber + i,
      };
    });

    await prisma.visit.createMany({ data: visits });
    res.status(201).json({ count: visits.length, visits });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = visitSchema.partial().parse(req.body);
    const visit = await prisma.visit.update({
      where: { id: req.params.id },
      data: {
        ...data,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      },
    });
    res.json(visit);
  })
);

// Mark attendance: PRESENT / ABSENT / CANCELLED
router.post(
  '/:id/attendance',
  asyncHandler(async (req, res) => {
    const { status, feeCollected } = z
      .object({
        status: z.enum(['PRESENT', 'ABSENT', 'CANCELLED', 'SCHEDULED']),
        feeCollected: z.boolean().optional(),
      })
      .parse(req.body);

    const visit = await prisma.visit.update({
      where: { id: req.params.id },
      data: {
        attendance: status,
        completedDate: status === 'PRESENT' ? new Date() : null,
        feeCollected: feeCollected ?? undefined,
      },
    });
    res.json(visit);
  })
);

// Carry forward a pending/absent session to a new date (e.g. next month)
router.post(
  '/:id/carry-forward',
  asyncHandler(async (req, res) => {
    const { newDate } = z.object({ newDate: z.string() }).parse(req.body);
    const source = await prisma.visit.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: 'Visit not found' });

    const [, newVisit] = await prisma.$transaction([
      prisma.visit.update({
        where: { id: source.id },
        data: { attendance: 'CARRIED_FORWARD', carriedForward: true },
      }),
      prisma.visit.create({
        data: {
          patientId: source.patientId,
          packageId: source.packageId,
          diagnosisId: source.diagnosisId,
          doctorId: source.doctorId,
          sessionNumber: source.sessionNumber,
          scheduledDate: new Date(newDate),
          type: source.type,
          fee: source.fee,
          carriedFromId: source.id,
          remarks: `Carried forward from ${source.scheduledDate.toDateString()}`,
        },
      }),
    ]);

    res.status(201).json(newVisit);
  })
);

// Bulk carry-forward: move all pending sessions from a package that are overdue into next month
router.post(
  '/carry-forward-pending',
  asyncHandler(async (req, res) => {
    const { packageId, newStartDate, frequencyDays } = z
      .object({
        packageId: z.string(),
        newStartDate: z.string(),
        frequencyDays: z.number().int().min(1).default(2),
      })
      .parse(req.body);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const pending = await prisma.visit.findMany({
      where: {
        packageId,
        attendance: { in: ['SCHEDULED', 'ABSENT'] },
        scheduledDate: { lt: startOfToday },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    const created = [];
    for (let i = 0; i < pending.length; i++) {
      const source = pending[i];
      const scheduledDate = new Date(newStartDate);
      scheduledDate.setDate(scheduledDate.getDate() + i * frequencyDays);
      await prisma.visit.update({
        where: { id: source.id },
        data: { attendance: 'CARRIED_FORWARD', carriedForward: true },
      });
      const nv = await prisma.visit.create({
        data: {
          patientId: source.patientId,
          packageId: source.packageId,
          diagnosisId: source.diagnosisId,
          doctorId: source.doctorId,
          sessionNumber: source.sessionNumber,
          scheduledDate,
          type: source.type,
          fee: source.fee,
          carriedFromId: source.id,
          remarks: `Carried forward from ${source.scheduledDate.toDateString()}`,
        },
      });
      created.push(nv);
    }

    res.status(201).json({ count: created.length, visits: created });
  })
);

/**
 * Deleting a session removes it from history entirely, so it is refused when money is
 * attached to it — that payment would be left pointing at nothing and the day's takings
 * would no longer reconcile. Mark such a session CANCELLED instead, which keeps the record.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const linkedPayments = await prisma.payment.count({ where: { visitId: req.params.id } });
    if (linkedPayments > 0) {
      return res.status(409).json({
        error:
          'This session has a payment recorded against it. Cancel the session instead, or delete the payment first.',
      });
    }
    await prisma.visit.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
