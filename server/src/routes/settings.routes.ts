import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

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
    res.json(await getOrCreateSettings());
  })
);

const settingsSchema = z.object({
  clinicName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  checkupFee: z.number().min(0).optional(),
  defaultSessionFee: z.number().min(0).optional(),
});

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const data = settingsSchema.parse(req.body);
    await getOrCreateSettings();
    const updated = await prisma.clinicSettings.update({ where: { id: SETTINGS_ID }, data });
    res.json(updated);
  })
);

export default router;
