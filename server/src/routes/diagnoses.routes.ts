import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { CLINICAL, NOT_JUNIOR, requireAuth } from '../middleware/auth';
import { parseList, serializeList } from '../../../shared/prescription';
import { parseJsonMap, serializeJsonMap } from '../../../shared/exerciseLibrary';
import { needsReview } from '../../../shared/roles';
import { logAudit } from '../utils/audit';
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
  // A dosage override for specific ticked exercises, keyed by exercise name — e.g. this
  // patient gets 15 reps instead of the clinic's usual 10.
  exerciseNotes: z.record(z.string()).optional().nullable(),
});

const LIST_FIELDS = ['checkedDiagnoses', 'exercises', 'modalities'] as const;

/** Arrays in, JSON text out — the only place that translation happens. */
function toRow(data: z.infer<typeof diagnosisSchema> | Partial<z.infer<typeof diagnosisSchema>>) {
  const row: Record<string, unknown> = { ...data };
  for (const field of LIST_FIELDS) {
    if (field in data) row[field] = serializeList(data[field] as string[] | null | undefined);
  }
  if ('exerciseNotes' in data) {
    row.exerciseNotes = serializeJsonMap(data.exerciseNotes as Record<string, string> | null | undefined);
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
    exerciseNotes: parseJsonMap<string>(row.exerciseNotes),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const patientId = req.query.patientId as string | undefined;
    const reviewStatus = req.query.reviewStatus as string | undefined;
    const diagnoses = await prisma.diagnosis.findMany({
      where: {
        patientId: patientId || undefined,
        reviewStatus: reviewStatus || undefined,
      },
      orderBy: { date: 'desc' },
      include: {
        patient: { select: { name: true, phone: true } },
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
    // A junior doctor's own assessment starts pending a senior's review; a senior doctor's or
    // admin's own work is approved the moment they write it — there is no one above them to
    // review it.
    const pending = needsReview(req.user!.role);
    const diagnosis = await prisma.diagnosis.create({
      data: {
        ...toRow(data),
        date: data.date ? new Date(data.date) : new Date(),
        reviewStatus: pending ? 'PENDING' : 'APPROVED',
        reviewedByName: pending ? null : req.user!.name,
        reviewedAt: pending ? null : new Date(),
      } as any,
    });
    await logAudit(req, {
      action: 'CREATE',
      entityType: 'DIAGNOSIS',
      entityId: diagnosis.id,
      patientId: diagnosis.patientId,
      summary: `Created assessment "${diagnosis.title}"`,
    });
    res.status(201).json(fromRow(diagnosis));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = diagnosisSchema.partial().parse(req.body);
    // Whoever's hand last touched the record is who is answerable for it: a junior doctor
    // editing anything — including an already-approved record — sends it back to pending,
    // and a senior doctor's or admin's edit counts as their own review.
    const pending = needsReview(req.user!.role);
    const diagnosis = await prisma.diagnosis.update({
      where: { id: req.params.id },
      data: {
        ...toRow(data),
        date: data.date ? new Date(data.date) : undefined,
        reviewStatus: pending ? 'PENDING' : 'APPROVED',
        reviewedByName: pending ? null : req.user!.name,
        reviewedAt: pending ? null : new Date(),
      } as any,
    });
    await logAudit(req, {
      action: 'UPDATE',
      entityType: 'DIAGNOSIS',
      entityId: diagnosis.id,
      patientId: diagnosis.patientId,
      summary: `Updated assessment "${diagnosis.title}"`,
    });
    res.json(fromRow(diagnosis));
  })
);

/** A senior doctor signing off on a junior doctor's assessment without changing anything on it. */
router.post(
  '/:id/review',
  CLINICAL,
  asyncHandler(async (req, res) => {
    const diagnosis = await prisma.diagnosis.update({
      where: { id: req.params.id },
      data: { reviewStatus: 'APPROVED', reviewedByName: req.user!.name, reviewedAt: new Date() },
    });
    await logAudit(req, {
      action: 'APPROVE',
      entityType: 'DIAGNOSIS',
      entityId: diagnosis.id,
      patientId: diagnosis.patientId,
      summary: `Reviewed and approved assessment "${diagnosis.title}"`,
    });
    res.json(fromRow(diagnosis));
  })
);

router.delete(
  '/:id',
  NOT_JUNIOR,
  asyncHandler(async (req, res) => {
    const existing = await prisma.diagnosis.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Assessment not found' });
    // The scans belong to the assessment; the rows cascade, the files have to be told.
    await deleteStoredFilesFor({ diagnosisId: req.params.id });
    await prisma.diagnosis.delete({ where: { id: req.params.id } });
    await logAudit(req, {
      action: 'DELETE',
      entityType: 'DIAGNOSIS',
      entityId: req.params.id,
      patientId: existing.patientId,
      summary: `Deleted assessment "${existing.title}"`,
    });
    res.status(204).end();
  })
);

export default router;
