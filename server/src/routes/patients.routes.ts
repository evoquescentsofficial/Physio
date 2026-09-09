import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { ADMIN_ONLY, requireAuth } from '../middleware/auth';
import { installmentStatus } from '../../../shared/money';

const router = Router();
router.use(requireAuth);

const patientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  referredBy: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  attendantName: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Everything except name and phone is optional. A field the caller left out must stay
// untouched on a partial update, while one sent empty means "not recorded" and is stored
// as null — otherwise '' and null would both float around meaning the same thing.
const OPTIONAL_TEXT = [
  'email',
  'address',
  'gender',
  'occupation',
  'referredBy',
  'bloodGroup',
  'attendantName',
  'emergencyContact',
  'notes',
] as const;

function blanksToNull<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const key of OPTIONAL_TEXT) if (key in out) out[key] = out[key] || null;
  return out as T;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) || '';
    const patients = await prisma.patient.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { visits: true, packages: true } },
      },
    });
    res.json(patients);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        diagnoses: {
          orderBy: { date: 'desc' },
          include: { doctor: { select: { id: true, name: true } } },
        },
        packages: {
          orderBy: { createdAt: 'desc' },
          include: {
            installments: { orderBy: { dueDate: 'asc' } },
            visits: { orderBy: { scheduledDate: 'asc' } },
            payments: true,
          },
        },
        payments: { orderBy: { date: 'desc' } },
        visits: {
          orderBy: { scheduledDate: 'desc' },
          include: { doctor: { select: { id: true, name: true } } },
        },
      },
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // OVERDUE is a fact about today rather than a stored state, so it is derived on read.
    res.json({
      ...patient,
      packages: patient.packages.map((pkg) => ({
        ...pkg,
        installments: pkg.installments.map((i) => ({ ...i, status: installmentStatus(i) })),
      })),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = patientSchema.parse(req.body);
    const patient = await prisma.patient.create({
      data: { ...blanksToNull(data), dob: data.dob ? new Date(data.dob) : null },
    });
    res.status(201).json(patient);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = patientSchema.partial().parse(req.body);
    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: {
        ...blanksToNull(data),
        dob: data.dob ? new Date(data.dob) : undefined,
      },
    });
    res.json(patient);
  })
);

// Deleting a patient destroys their whole history, including revenue already reported.
router.delete(
  '/:id',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    await prisma.patient.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
