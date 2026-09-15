import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { ADMIN_ONLY, requireAuth } from '../middleware/auth';
import { parseList, serializeList } from '../../../shared/prescription';
import {
  EMPLOYMENT_TYPES,
  computeDoctorEarnings,
  salaryPeriod,
  salaryTag,
} from '../../../shared/commission';

const router = Router();
router.use(requireAuth);

const doctorSchema = z.object({
  name: z.string().min(1),
  specialization: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  // Optional: many clinics bill per package rather than per doctor.
  consultationFee: z.number().min(0).optional().nullable(),
  joinedDate: z.string().optional().nullable(),
  active: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  // Printed beside the logo on the prescription, one qualification per line.
  credentials: z.string().optional().nullable(),
  onLetterhead: z.boolean().optional(),
  departments: z.array(z.string()).optional().nullable(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  // A salaried doctor draws this every month; a commission doctor keeps a share instead.
  monthlySalary: z.number().min(0).optional().nullable(),
  commissionPercent: z.number().min(0).max(100).optional().nullable(),
});

/** Departments are a list on the wire and JSON text in the column. */
const fromRow = <T extends Record<string, any>>(row: T) => ({
  ...row,
  departments: parseList(row.departments),
});

function toRow(data: Partial<z.infer<typeof doctorSchema>>) {
  const row: Record<string, unknown> = { ...data };
  if ('departments' in data) row.departments = serializeList(data.departments);
  return row;
}

/** Sessions each doctor handled this month, so the list doubles as a workload view. */
async function withStats(doctors: { id: string }[]) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthVisits, allVisits] = await Promise.all([
    prisma.visit.groupBy({
      by: ['doctorId'],
      where: { doctorId: { not: null }, scheduledDate: { gte: startOfMonth } },
      _count: { _all: true },
    }),
    prisma.visit.groupBy({
      by: ['doctorId'],
      where: { doctorId: { not: null }, attendance: 'PRESENT' },
      _count: { _all: true },
    }),
  ]);

  const monthMap = new Map(monthVisits.map((v) => [v.doctorId, v._count._all]));
  const totalMap = new Map(allVisits.map((v) => [v.doctorId, v._count._all]));

  return doctors.map((d) => ({
    ...fromRow(d as any),
    sessionsThisMonth: monthMap.get(d.id) ?? 0,
    sessionsCompleted: totalMap.get(d.id) ?? 0,
  }));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const doctors = await prisma.doctor.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    res.json(await withStats(doctors));
  })
);

/**
 * What each doctor earned over a range, and who owes whom because of it.
 *
 * Commission is earned on sessions the patient actually attended. Money the doctor took at the
 * chair and payouts already recorded as expenses are both subtracted, so the closing figure is
 * the one thing the clinic and the doctor have to agree on at month end.
 */
router.get(
  '/earnings',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    to.setHours(23, 59, 59, 999);
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(to.getFullYear(), to.getMonth(), 1);
    from.setHours(0, 0, 0, 0);

    const [doctors, visits, payments, payouts] = await Promise.all([
      prisma.doctor.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      prisma.visit.findMany({
        where: { doctorId: { not: null }, attendance: 'PRESENT' },
        select: {
          doctorId: true,
          fee: true,
          attendance: true,
          scheduledDate: true,
          completedDate: true,
        },
      }),
      prisma.payment.findMany({
        where: { collectedByDoctorId: { not: null } },
        select: { amount: true, type: true, date: true, collectedByDoctorId: true },
      }),
      prisma.expense.findMany({
        where: { doctorId: { not: null }, category: { in: ['SALARY', 'COMMISSION'] } },
        select: { amount: true, date: true, doctorId: true },
      }),
    ]);

    const rows = doctors.map((doctor) => ({
      doctor: fromRow(doctor),
      ...computeDoctorEarnings(
        doctor,
        visits.map((v) => ({
          ...v,
          scheduledDate: v.scheduledDate,
          completedDate: v.completedDate,
        })),
        payments,
        payouts,
        { from, to }
      ),
    }));

    res.json({ from: from.toISOString(), to: to.toISOString(), doctors: rows });
  })
);

/**
 * Posts this month's salaries to expenses in one go, which is the job that otherwise gets
 * forgotten and leaves the P&L flattering. Re-running it is safe: a month already posted for
 * a doctor is skipped rather than paid twice.
 */
router.post(
  '/post-salaries',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    const period = (req.body?.period as string) || salaryPeriod(new Date());
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'Which month to post is not a valid YYYY-MM.' });
    }
    const [year, month] = period.split('-').map(Number);
    // Salaries are dated to the last day of the month they are for.
    const date = new Date(year, month, 0, 12);
    const tag = salaryTag(period);

    const salaried = await prisma.doctor.findMany({
      where: { active: true, employmentType: 'SALARIED', monthlySalary: { gt: 0 } },
    });
    const already = await prisma.expense.findMany({
      where: { category: 'SALARY', notes: { contains: tag } },
      select: { doctorId: true },
    });
    const posted = new Set(already.map((e) => e.doctorId));

    const created = await prisma.$transaction(
      salaried
        .filter((d) => !posted.has(d.id))
        .map((d) =>
          prisma.expense.create({
            data: {
              category: 'SALARY',
              title: `Salary — ${d.name}`,
              amount: d.monthlySalary!,
              date,
              paidTo: d.name,
              doctorId: d.id,
              notes: tag,
            },
          })
        )
    );

    res.json({
      period,
      posted: created.length,
      skipped: salaried.length - created.length,
      total: created.reduce((sum, e) => sum + e.amount, 0),
      expenses: created,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: {
        visits: {
          orderBy: { scheduledDate: 'desc' },
          take: 50,
          include: { patient: { select: { id: true, name: true, phone: true } } },
        },
      },
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    const [stats] = await withStats([doctor]);
    res.json({ ...stats, visits: doctor.visits });
  })
);

router.post(
  '/',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    const data = doctorSchema.parse(req.body);
    const doctor = await prisma.doctor.create({
      data: {
        ...toRow(data),
        name: data.name,
        email: data.email || null,
        joinedDate: data.joinedDate ? new Date(data.joinedDate) : null,
      } as any,
    });
    res.status(201).json(fromRow(doctor));
  })
);

router.put(
  '/:id',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    const data = doctorSchema.partial().parse(req.body);
    const doctor = await prisma.doctor.update({
      where: { id: req.params.id },
      data: {
        ...toRow(data),
        email: data.email === undefined ? undefined : data.email || null,
        joinedDate: data.joinedDate ? new Date(data.joinedDate) : undefined,
      } as any,
    });
    res.json(fromRow(doctor));
  })
);

/**
 * Doctors who have treated patients are deactivated rather than deleted, so past sessions
 * keep showing who did the work. Only a doctor with no sessions at all is removed outright.
 */
router.delete(
  '/:id',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    const visits = await prisma.visit.count({ where: { doctorId: req.params.id } });
    if (visits > 0) {
      const doctor = await prisma.doctor.update({
        where: { id: req.params.id },
        data: { active: false },
      });
      return res.json({ deactivated: true, doctor });
    }
    await prisma.doctor.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
