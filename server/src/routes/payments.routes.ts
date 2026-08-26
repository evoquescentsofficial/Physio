import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { ADMIN_ONLY, requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const paymentSchema = z.object({
  patientId: z.string().min(1),
  packageId: z.string().optional().nullable(),
  visitId: z.string().optional().nullable(),
  amount: z.number().positive(),
  type: z.enum(['CHECKUP_FEE', 'ADVANCE', 'SESSION_FEE', 'INSTALLMENT', 'VISIT_FEE', 'REFUND']),
  method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
  date: z.string().optional(),
  notes: z.string().optional().nullable(),
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
    await prisma.payment.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
