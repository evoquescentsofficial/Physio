import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { ADMIN_ONLY, requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
// Who did what is only the admin's business — a junior doctor's own mistakes are exactly the
// sort of thing this log exists to surface, so they cannot be the one reading it.
router.use(ADMIN_ONLY);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, entityType, userId, patientId } = req.query as Record<string, string>;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
    const entries = await prisma.auditLog.findMany({
      where: {
        entityType: entityType || undefined,
        userId: userId || undefined,
        patientId: patientId || undefined,
        createdAt:
          from || to
            ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59`) : undefined }
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(entries);
  })
);

export default router;
