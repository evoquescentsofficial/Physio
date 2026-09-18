import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { NOT_JUNIOR, requireAuth } from '../middleware/auth';
import {
  canCarryForward,
  carryForwardBlockedReason,
  nextSessionNumber,
} from '../../../shared/sessions';
import { logAudit } from '../utils/audit';

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

    // Continue the package's existing numbering rather than restarting at 1. Carried-forward
    // and cancelled rows are skipped: a moved session is still the same session of the course,
    // so it must not push the next one up a number.
    let nextNumber = data.sessionNumber ?? null;
    if (nextNumber == null && data.packageId) {
      const existing = await prisma.visit.findMany({
        where: { packageId: data.packageId },
        select: { sessionNumber: true, attendance: true, scheduledDate: true },
      });
      nextNumber = nextSessionNumber(existing);
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
    await logAudit(req, {
      action: 'CREATE',
      entityType: 'VISIT',
      entityId: data.patientId,
      patientId: data.patientId,
      summary: `Booked ${visits.length} session${visits.length === 1 ? '' : 's'}`,
    });
    res.status(201).json({ count: visits.length, visits });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    // `count` and `frequencyDays` only describe how to create a run of sessions; they are
    // not columns, and passing them through to Prisma throws.
    const { count: _count, frequencyDays: _frequencyDays, ...data } = visitSchema
      .partial()
      .parse(req.body);
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
    const parsed = z
      .object({
        status: z.enum(['PRESENT', 'ABSENT', 'CANCELLED', 'SCHEDULED']),
        feeCollected: z.boolean().optional(),
      })
      .parse(req.body);
    const { status } = parsed;
    // Attendance is clinical and open to a junior doctor; whether the fee was collected is
    // money, and stays off-limits to them even on this otherwise-clinical route.
    const feeCollected = req.user!.role === 'JUNIOR_DOCTOR' ? undefined : parsed.feeCollected;

    const existing = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: { patient: { select: { name: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Visit not found' });

    const visit = await prisma.visit.update({
      where: { id: req.params.id },
      data: {
        attendance: status,
        // Keep the first completion timestamp. Correcting an attendance mistake
        // (present → absent → present) should not rewrite when the patient was treated.
        completedDate:
          status === 'PRESENT' ? (existing.completedDate ?? new Date()) : existing.completedDate,
        feeCollected: feeCollected ?? undefined,
      },
    });
    await logAudit(req, {
      action: 'UPDATE',
      entityType: 'VISIT',
      entityId: visit.id,
      patientId: visit.patientId,
      summary: `Marked ${existing.patient.name}'s session ${status.toLowerCase()}`,
    });
    if (feeCollected && !existing.feeCollected) {
      await logAudit(req, {
        action: 'COLLECT',
        entityType: 'VISIT',
        entityId: visit.id,
        patientId: visit.patientId,
        summary: `Marked ${existing.patient.name}'s session fee as collected`,
      });
    }
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

    // Moving a session that already happened would invent a second one out of nothing, and
    // moving one that was already moved would fork the chain into two live sessions.
    if (!canCarryForward(source)) {
      return res.status(409).json({ error: carryForwardBlockedReason(source) });
    }

    const target = new Date(newDate);
    const sameDay =
      target.toISOString().slice(0, 10) === source.scheduledDate.toISOString().slice(0, 10);
    if (sameDay) {
      return res.status(400).json({
        error: 'That is the day it is already booked for. Pick a different date to move it to.',
      });
    }

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
          // The replacement is the same session of the course, on another day.
          sessionNumber: source.sessionNumber,
          scheduledDate: target,
          type: source.type,
          fee: source.fee,
          // A session already paid for stays paid for; the patient must not be charged twice
          // because the appointment moved.
          feeCollected: source.feeCollected,
          carriedFromId: source.id,
          // Where it came from is in carriedFromId; remarks belong to the clinician.
          remarks: source.remarks,
          treatmentNotes: source.treatmentNotes,
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

    // All or nothing: a failure part-way through would leave a half-carried month with
    // some sessions marked carried forward and no replacements booked.
    const created = await prisma.$transaction(async (tx) => {
      const madeVisits = [];
      for (let i = 0; i < pending.length; i++) {
        const source = pending[i];
        const scheduledDate = new Date(newStartDate);
        scheduledDate.setDate(scheduledDate.getDate() + i * frequencyDays);
        await tx.visit.update({
          where: { id: source.id },
          data: { attendance: 'CARRIED_FORWARD', carriedForward: true },
        });
        madeVisits.push(
          await tx.visit.create({
            data: {
              patientId: source.patientId,
              packageId: source.packageId,
              diagnosisId: source.diagnosisId,
              doctorId: source.doctorId,
              sessionNumber: source.sessionNumber,
              scheduledDate,
              type: source.type,
              fee: source.fee,
              feeCollected: source.feeCollected,
              carriedFromId: source.id,
              remarks: source.remarks,
              treatmentNotes: source.treatmentNotes,
            },
          })
        );
      }
      return madeVisits;
    });

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
  NOT_JUNIOR,
  asyncHandler(async (req, res) => {
    const existing = await prisma.visit.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Visit not found' });
    const linkedPayments = await prisma.payment.count({ where: { visitId: req.params.id } });
    if (linkedPayments > 0) {
      return res.status(409).json({
        error:
          'This session has a payment recorded against it. Cancel the session instead, or delete the payment first.',
      });
    }
    await prisma.visit.delete({ where: { id: req.params.id } });
    await logAudit(req, {
      action: 'DELETE',
      entityType: 'VISIT',
      entityId: req.params.id,
      patientId: existing.patientId,
      summary: `Deleted a session`,
    });
    res.status(204).end();
  })
);

export default router;
