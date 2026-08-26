import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { ADMIN_ONLY, FINANCE, requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const expenseSchema = z.object({
  category: z.enum(['SALARY', 'RENT', 'UTILITIES', 'EQUIPMENT', 'MARKETING', 'MAINTENANCE', 'OTHER']),
  title: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().optional(),
  paidTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Staff costs and rent are the owner's business, not the front desk's.
router.get(
  '/',
  FINANCE,
  asyncHandler(async (req, res) => {
    const { category, from, to } = req.query as Record<string, string>;
    const expenses = await prisma.expense.findMany({
      where: {
        category: (category as any) || undefined,
        date:
          from || to
            ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
            : undefined,
      },
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  })
);

router.post(
  '/',
  FINANCE,
  asyncHandler(async (req, res) => {
    const data = expenseSchema.parse(req.body);
    const expense = await prisma.expense.create({
      data: { ...data, date: data.date ? new Date(data.date) : new Date() },
    });
    res.status(201).json(expense);
  })
);

router.put(
  '/:id',
  FINANCE,
  asyncHandler(async (req, res) => {
    const data = expenseSchema.partial().parse(req.body);
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
    });
    res.json(expense);
  })
);

router.delete(
  '/:id',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
