import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

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
});

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
    ...d,
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
    res.json(stats);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = doctorSchema.parse(req.body);
    const doctor = await prisma.doctor.create({
      data: {
        ...data,
        email: data.email || null,
        joinedDate: data.joinedDate ? new Date(data.joinedDate) : null,
      },
    });
    res.status(201).json(doctor);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = doctorSchema.partial().parse(req.body);
    const doctor = await prisma.doctor.update({
      where: { id: req.params.id },
      data: {
        ...data,
        email: data.email === undefined ? undefined : data.email || null,
        joinedDate: data.joinedDate ? new Date(data.joinedDate) : undefined,
      },
    });
    res.json(doctor);
  })
);

/**
 * Doctors who have treated patients are deactivated rather than deleted, so past sessions
 * keep showing who did the work. Only a doctor with no sessions at all is removed outright.
 */
router.delete(
  '/:id',
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
