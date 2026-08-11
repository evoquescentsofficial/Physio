import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

/**
 * A patient's money position, computed across their whole account rather than one package,
 * so an overpayment on one package is automatically available against the next.
 *
 * Only package charges create a debt. Checkup fees and single-session fees are settled as
 * they happen, so they cancel out and are excluded from both sides — but an advance or an
 * installment paid without naming a package is money sitting on the account, and counts.
 */
async function computeAccounts() {
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      packages: { select: { totalFee: true, status: true } },
      payments: { select: { amount: true, type: true, packageId: true } },
    },
  });

  return patients.map((p) => {
    const packageValue = p.packages
      .filter((k) => k.status !== 'CANCELLED')
      .reduce((s, k) => s + k.totalFee, 0);

    const paid = p.payments.reduce((s, pay) => {
      const onAccount = pay.packageId !== null || pay.type === 'ADVANCE' || pay.type === 'INSTALLMENT';
      if (!onAccount) return s;
      return s + (pay.type === 'REFUND' ? -pay.amount : pay.amount);
    }, 0);

    const balance = packageValue - paid;
    return {
      patient: { id: p.id, name: p.name, phone: p.phone },
      packageValue,
      paid,
      due: Math.max(balance, 0),
      credit: Math.max(-balance, 0),
    };
  });
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

function lastNMonthKeys(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [totalPatients, activePackages, todaysVisits, monthPayments, monthExpenses, pendingVisits] =
      await Promise.all([
        prisma.patient.count(),
        prisma.treatmentPackage.count({ where: { status: 'ACTIVE' } }),
        prisma.visit.findMany({
          where: { scheduledDate: { gte: startOfDay, lte: endOfDay } },
          include: { patient: { select: { name: true, phone: true } } },
          orderBy: { scheduledDate: 'asc' },
        }),
        prisma.payment.findMany({
          where: { date: { gte: startOfMonth, lte: endOfMonth }, type: { not: 'REFUND' } },
        }),
        prisma.expense.findMany({ where: { date: { gte: startOfMonth, lte: endOfMonth } } }),
        prisma.visit.count({ where: { attendance: 'SCHEDULED', scheduledDate: { lt: startOfDay } } }),
      ]);

    const monthRevenue = monthPayments.reduce((s, p) => s + p.amount, 0);
    const monthExpenseTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

    // One patient's credit cannot pay another patient's bill, so the totals sum each side
    // separately rather than netting the whole clinic to one figure.
    const accounts = await computeAccounts();
    const outstandingDues = accounts.reduce((s, a) => s + a.due, 0);
    const patientCredits = accounts.reduce((s, a) => s + a.credit, 0);

    res.json({
      totalPatients,
      activePackages,
      todaysVisits,
      overduePendingSessions: pendingVisits,
      monthRevenue,
      monthExpenses: monthExpenseTotal,
      monthProfit: monthRevenue - monthExpenseTotal,
      outstandingDues,
      patientCredits,
    });
  })
);

router.get(
  '/revenue',
  asyncHandler(async (req, res) => {
    const months = Number(req.query.months) || 6;
    const keys = lastNMonthKeys(months);
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
      where: { date: { gte: since }, type: { not: 'REFUND' } },
    });

    const byMonth: Record<string, Record<string, number>> = {};
    for (const key of keys)
      byMonth[key] = { CHECKUP_FEE: 0, ADVANCE: 0, SESSION_FEE: 0, INSTALLMENT: 0, VISIT_FEE: 0 };
    for (const p of payments) {
      const key = monthKey(p.date);
      if (!byMonth[key]) continue;
      byMonth[key][p.type] = (byMonth[key][p.type] || 0) + p.amount;
    }

    const series = keys.map((key) => ({
      month: monthLabel(key),
      total: Object.values(byMonth[key]).reduce((a, b) => a + b, 0),
      ...byMonth[key],
    }));

    res.json(series);
  })
);

router.get(
  '/expenses-summary',
  asyncHandler(async (req, res) => {
    const months = Number(req.query.months) || 6;
    const keys = lastNMonthKeys(months);
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const expenses = await prisma.expense.findMany({ where: { date: { gte: since } } });
    const byMonth: Record<string, number> = {};
    for (const key of keys) byMonth[key] = 0;
    for (const e of expenses) {
      const key = monthKey(e.date);
      if (byMonth[key] === undefined) continue;
      byMonth[key] += e.amount;
    }

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }

    res.json({
      series: keys.map((key) => ({ month: monthLabel(key), total: byMonth[key] })),
      byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total })),
    });
  })
);

router.get(
  '/profit-loss',
  asyncHandler(async (req, res) => {
    const months = Number(req.query.months) || 6;
    const keys = lastNMonthKeys(months);
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({ where: { date: { gte: since }, type: { not: 'REFUND' } } }),
      prisma.expense.findMany({ where: { date: { gte: since } } }),
    ]);

    const revenueByMonth: Record<string, number> = {};
    const expenseByMonth: Record<string, number> = {};
    for (const key of keys) {
      revenueByMonth[key] = 0;
      expenseByMonth[key] = 0;
    }
    for (const p of payments) {
      const key = monthKey(p.date);
      if (revenueByMonth[key] !== undefined) revenueByMonth[key] += p.amount;
    }
    for (const e of expenses) {
      const key = monthKey(e.date);
      if (expenseByMonth[key] !== undefined) expenseByMonth[key] += e.amount;
    }

    const rows = keys.map((key) => ({
      month: monthLabel(key),
      revenue: revenueByMonth[key],
      expenses: expenseByMonth[key],
      profit: revenueByMonth[key] - expenseByMonth[key],
    }));

    const totals = rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        expenses: acc.expenses + r.expenses,
        profit: acc.profit + r.profit,
      }),
      { revenue: 0, expenses: 0, profit: 0 }
    );

    res.json({ rows, totals });
  })
);

router.get(
  '/outstanding',
  asyncHandler(async (_req, res) => {
    const accounts = await computeAccounts();
    res.json(accounts.filter((a) => a.due > 0).sort((a, b) => b.due - a.due));
  })
);

// Patients who have paid more than they have been charged — the surplus is held on their
// account and offsets whatever they are billed next.
router.get(
  '/credits',
  asyncHandler(async (_req, res) => {
    const accounts = await computeAccounts();
    res.json(accounts.filter((a) => a.credit > 0).sort((a, b) => b.credit - a.credit));
  })
);

export default router;
