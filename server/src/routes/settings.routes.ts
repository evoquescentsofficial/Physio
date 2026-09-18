import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { ADMIN_ONLY, requireAuth } from '../middleware/auth';
import { parseList, serializeList } from '../../../shared/prescription';
import { ExerciseEntry, parseJsonMap, serializeJsonMap } from '../../../shared/exerciseLibrary';

const router = Router();
router.use(requireAuth);

const SETTINGS_ID = 'clinic';

async function getOrCreateSettings() {
  const existing = await prisma.clinicSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.clinicSettings.create({ data: { id: SETTINGS_ID } });
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(fromRow(await getOrCreateSettings()));
  })
);

const settingsSchema = z.object({
  clinicName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  checkupFee: z.number().min(0).optional(),
  defaultSessionFee: z.number().min(0).optional(),
  // Printed on the prescription.
  email: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  timings: z.string().optional().nullable(),
  formTitle: z.string().optional().nullable(),
  diagnosisOptions: z.array(z.string()).optional().nullable(),
  exerciseOptions: z.array(z.string()).optional().nullable(),
  modalityOptions: z.array(z.string()).optional().nullable(),
  departmentOptions: z.array(z.string()).optional().nullable(),
  // The clinic's own rewrite of the built-in exercise library, keyed by exercise name.
  exerciseLibrary: z
    .record(
      z.object({
        instructions: z.string(),
        dosage: z.string(),
        homeExercise: z.boolean(),
      })
    )
    .optional()
    .nullable(),
});

const LIST_FIELDS = [
  'diagnosisOptions',
  'exerciseOptions',
  'modalityOptions',
  'departmentOptions',
] as const;

/** Lists are arrays on the wire and JSON text in the column; nowhere else needs to know. */
function fromRow<T extends Record<string, any>>(row: T) {
  return {
    ...row,
    diagnosisOptions: parseList(row.diagnosisOptions),
    exerciseOptions: parseList(row.exerciseOptions),
    modalityOptions: parseList(row.modalityOptions),
    departmentOptions: parseList(row.departmentOptions),
    exerciseLibrary: parseJsonMap<ExerciseEntry>(row.exerciseLibrary),
  };
}

router.put(
  '/',
  ADMIN_ONLY,
  asyncHandler(async (req, res) => {
    const data = settingsSchema.parse(req.body);
    const row: Record<string, unknown> = { ...data };
    for (const field of LIST_FIELDS) {
      if (field in data) row[field] = serializeList(data[field] as string[] | null | undefined);
    }
    if ('exerciseLibrary' in data) {
      row.exerciseLibrary = serializeJsonMap(
        data.exerciseLibrary as Record<string, ExerciseEntry> | null | undefined
      );
    }
    await getOrCreateSettings();
    const updated = await prisma.clinicSettings.update({
      where: { id: SETTINGS_ID },
      data: row as any,
    });
    res.json(fromRow(updated));
  })
);

export default router;
