import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { ADMIN_ONLY, NOT_JUNIOR, requireAuth } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();
router.use(requireAuth);
// Money is entirely off-limits to a junior doctor — nothing below this line is theirs to see
// or touch, not just the delete.
router.use(NOT_JUNIOR);

const paymentSchema = z.object({
  patientId: z.string().min(1),
  packageId: z.string().optional().nullable(),
  visitId: z.string().optional().nullable(),
  // Zero is valid: a waived visit is still worth recording, so the patient's history
  // shows they were seen and the giveaway is visible in the discount total.
  amount: z.number().min(0),
  discount: z.number().min(0).default(0),
  type: z.enum(['CHECKUP_FEE', 'ADVANCE', 'SESSION_FEE', 'INSTALLMENT', 'VISIT_FEE', 'REFUND']),
  method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
  date: z.string().optional(),
  notes: z.string().optional().nullable(),
  // Left empty when the front desk took the money, which is the usual case. Naming a doctor
  // means they took it at the chair and are holding the clinic's share of it.
  collectedByDoctorId: z.string().optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { patientId, packageId, type, from, to } = req.query as Record<string, string>;
    const payments = await prisma.payment.findMany({
      where: {
        patientId: patientId || undefined,
        packageId: packageId || undefined,
        type: (type as any) || undefined,
        date:
          from || to
            ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
            : undefined,
      },
      orderBy: { date: 'desc' },
      include: { patient: { select: { name: true, phone: true } } },
    });
    res.json(payments);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = paymentSchema.parse(req.body);
    const payment = await prisma.payment.create({
      data: { ...data, date: data.date ? new Date(data.date) : new Date() },
    });

    if (data.visitId && (data.type === 'SESSION_FEE' || data.type === 'VISIT_FEE')) {
      await prisma.visit.update({ where: { id: data.visitId }, data: { feeCollected: true } });
    }

    await logAudit(req, {
      action: 'COLLECT',
      entityType: 'PAYMENT',
      entityId: payment.id,
      patientId: payment.patientId,
      summary: `Recorded a ${payment.type.toLowerCase().replace(/_/g, ' ')} payment of Rs ${payment.amount}`,
    });

    res.status(201).json(payment);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = paymentSchema.partial().parse(req.body);
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
    });
    res.json(payment);
  })
);

// Removing a payment rewrites the day's takings, so it is not a front-desk action.
router.delete(
  '/:id',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    const existing = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Payment not found' });
    await prisma.payment.delete({ where: { id: req.params.id } });
    await logAudit(req, {
      action: 'DELETE',
      entityType: 'PAYMENT',
      entityId: req.params.id,
      patientId: existing.patientId,
      summary: `Deleted a Rs ${existing.amount} payment`,
    });
    res.status(204).end();
  })
);

export default router;
