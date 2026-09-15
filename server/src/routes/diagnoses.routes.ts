import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { parseList, serializeList } from '../../../shared/prescription';
import { deleteStoredFilesFor } from './attachments.routes';

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
  doctorId: z.string().optional().nullable(),
  bodyRegion: z.string().optional().nullable(),
  side: z.string().optional().nullable(),
  painScore: z.number().int().min(0).max(10).optional().nullable(),
  // The written sections of the prescription pad.
  history: z.string().optional().nullable(),
  evaluation: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  referredTo: z.string().optional().nullable(),
  labFindings: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  // The tick-box columns arrive as arrays and are stored as JSON text.
  checkedDiagnoses: z.array(z.string()).optional().nullable(),
  exercises: z.array(z.string()).optional().nullable(),
  modalities: z.array(z.string()).optional().nullable(),
});

const LIST_FIELDS = ['checkedDiagnoses', 'exercises', 'modalities'] as const;

/** Arrays in, JSON text out — the only place that translation happens. */
function toRow(data: z.infer<typeof diagnosisSchema> | Partial<z.infer<typeof diagnosisSchema>>) {
  const row: Record<string, unknown> = { ...data };
  for (const field of LIST_FIELDS) {
    if (field in data) row[field] = serializeList(data[field] as string[] | null | undefined);
  }
  return row;
}

/** JSON text in, arrays out, so no client ever has to know how this is stored. */
export function fromRow<T extends Record<string, any>>(row: T) {
  return {
    ...row,
    checkedDiagnoses: parseList(row.checkedDiagnoses),
    exercises: parseList(row.exercises),
    modalities: parseList(row.modalities),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const patientId = req.query.patientId as string | undefined;
    const diagnoses = await prisma.diagnosis.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { date: 'desc' },
      include: {
        patient: { select: { name: true } },
        doctor: { select: { id: true, name: true } },
        attachments: { orderBy: { uploadedAt: 'asc' } },
      },
    });
    res.json(diagnoses.map(fromRow));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        doctor: true,
        attachments: { orderBy: { uploadedAt: 'asc' } },
      },
    });
    if (!diagnosis) return res.status(404).json({ error: 'Assessment not found' });
    res.json(fromRow(diagnosis));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = diagnosisSchema.parse(req.body);
    const diagnosis = await prisma.diagnosis.create({
      data: { ...toRow(data), date: data.date ? new Date(data.date) : new Date() } as any,
    });
    res.status(201).json(fromRow(diagnosis));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = diagnosisSchema.partial().parse(req.body);
    const diagnosis = await prisma.diagnosis.update({
      where: { id: req.params.id },
      data: { ...toRow(data), date: data.date ? new Date(data.date) : undefined } as any,
    });
    res.json(fromRow(diagnosis));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // The scans belong to the assessment; the rows cascade, the files have to be told.
    await deleteStoredFilesFor({ diagnosisId: req.params.id });
    await prisma.diagnosis.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
