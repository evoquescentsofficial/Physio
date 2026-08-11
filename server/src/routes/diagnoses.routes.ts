import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const diagnosisSchema = z.object({
  patientId: z.string().min(1),
  date: z.string().optional(),
  title: z.string().min(1),
  details: z.string().optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  doctorName: z.string().optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const patientId = req.query.patientId as string | undefined;
    const diagnoses = await prisma.diagnosis.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { date: 'desc' },
      include: { patient: { select: { name: true } } },
    });
    res.json(diagnoses);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = diagnosisSchema.parse(req.body);
    const diagnosis = await prisma.diagnosis.create({
      data: { ...data, date: data.date ? new Date(data.date) : new Date() },
    });
    res.status(201).json(diagnosis);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = diagnosisSchema.partial().parse(req.body);
    const diagnosis = await prisma.diagnosis.update({
      where: { id: req.params.id },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
    });
    res.json(diagnosis);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.diagnosis.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
