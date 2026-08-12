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

/**
 * Resolves the reporting window. Callers may pass explicit from/to dates (a custom range)
 * or a `days` count meaning "the last N days ending today"; `days=1` is today only.
 * Falls back to the last 30 days.
 */
function resolveRange(query: any) {
  const to = query.to ? new Date(query.to) : new Date();
  to.setHours(23, 59, 59, 999);

  let from: Date;
  if (query.from) {
    from = new Date(query.from);
  } else {
    const days = Math.max(1, Number(query.days) || 30);
    from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
  }
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

/** Buckets a range by day, week or month depending on how long it is. */
function bucketFor(from: Date, to: Date): 'day' | 'week' | 'month' {
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

function bucketKey(d: Date, bucket: 'day' | 'week' | 'month') {
  if (bucket === 'month') return monthKey(d);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (bucket === 'week') day.setDate(day.getDate() - day.getDay());
  return day.toISOString().slice(0, 10);
}

function bucketLabel(key: string, bucket: 'day' | 'week' | 'month') {
  if (bucket === 'month') return monthLabel(key);
  const d = new Date(key);
  const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return bucket === 'week' ? `w/c ${label}` : label;
}

/** Every bucket start between from and to, so quiet days still appear on the chart. */
function bucketKeys(from: Date, to: Date, bucket: 'day' | 'week' | 'month') {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  if (bucket === 'week') cursor.setDate(cursor.getDate() - cursor.getDay());
  if (bucket === 'month') cursor.setDate(1);

  while (cursor <= to) {
    keys.push(bucketKey(cursor, bucket));
    if (bucket === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (bucket === 'week') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
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
    const { from, to } = resolveRange(req.query);
    const bucket = bucketFor(from, to);
    const keys = bucketKeys(from, to, bucket);

    const payments = await prisma.payment.findMany({
      where: { date: { gte: from, lte: to }, type: { not: 'REFUND' } },
    });

    const byBucket: Record<string, Record<string, number>> = {};
    for (const key of keys)
      byBucket[key] = { CHECKUP_FEE: 0, ADVANCE: 0, SESSION_FEE: 0, INSTALLMENT: 0, VISIT_FEE: 0 };
    for (const p of payments) {
      const key = bucketKey(p.date, bucket);
      if (!byBucket[key]) continue;
      byBucket[key][p.type] = (byBucket[key][p.type] || 0) + p.amount;
    }

    res.json(
      keys.map((key) => ({
        month: bucketLabel(key, bucket),
        total: Object.values(byBucket[key]).reduce((a, b) => a + b, 0),
        ...byBucket[key],
      }))
    );
  })
);

router.get(
  '/expenses-summary',
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(req.query);
    const bucket = bucketFor(from, to);
    const keys = bucketKeys(from, to, bucket);

    const expenses = await prisma.expense.findMany({ where: { date: { gte: from, lte: to } } });

    const byBucket: Record<string, number> = {};
    for (const key of keys) byBucket[key] = 0;
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      const key = bucketKey(e.date, bucket);
      if (byBucket[key] !== undefined) byBucket[key] += e.amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }

    res.json({
      series: keys.map((key) => ({ month: bucketLabel(key, bucket), total: byBucket[key] })),
      byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total })),
    });
  })
);

router.get(
  '/profit-loss',
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(req.query);
    const bucket = bucketFor(from, to);
    const keys = bucketKeys(from, to, bucket);

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({ where: { date: { gte: from, lte: to }, type: { not: 'REFUND' } } }),
      prisma.expense.findMany({ where: { date: { gte: from, lte: to } } }),
    ]);

    const revenueBy: Record<string, number> = {};
    const expenseBy: Record<string, number> = {};
    for (const key of keys) {
      revenueBy[key] = 0;
      expenseBy[key] = 0;
    }
    for (const p of payments) {
      const key = bucketKey(p.date, bucket);
      if (revenueBy[key] !== undefined) revenueBy[key] += p.amount;
    }
    for (const e of expenses) {
      const key = bucketKey(e.date, bucket);
      if (expenseBy[key] !== undefined) expenseBy[key] += e.amount;
    }

    const rows = keys.map((key) => ({
      month: bucketLabel(key, bucket),
      revenue: revenueBy[key],
      expenses: expenseBy[key],
      profit: revenueBy[key] - expenseBy[key],
    }));

    const totals = rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        expenses: acc.expenses + r.expenses,
        profit: acc.profit + r.profit,
      }),
      { revenue: 0, expenses: 0, profit: 0 }
    );

    res.json({
      rows,
      totals,
      range: { from: from.toISOString(), to: to.toISOString(), bucket },
    });
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
