import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

/**
 * Reports live on disk beside the database rather than inside it: an X-ray in a row would bloat
 * every backup and every query. The stored name is generated here — an uploaded filename is
 * never trusted as a path.
 */
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// What a clinic actually attaches: scans, lab PDFs, photographs of a report.
const ALLOWED = new Map<string, string>([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/heic', '.heic'],
]);

const MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ALLOWED.get(file.mimetype) || ''}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      const err: any = new Error('Only PDF, JPG, PNG, WEBP and HEIC files can be attached.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

/**
 * Multer's own failures are not bugs — a file too big or of the wrong type is the user being
 * told something. Without this they would come back as "Something went wrong".
 */
function uploadOne(req: any, res: any, next: any) {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.status = 413;
      err.message = `That file is larger than ${MAX_BYTES / 1024 / 1024} MB. Please compress it or upload a smaller scan.`;
    }
    next(err);
  });
}

const metaSchema = z.object({
  patientId: z.string().min(1),
  diagnosisId: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
});

/**
 * Deleting a patient or an assessment cascades the attachment rows in the database, which would
 * leave the scans themselves on disk for ever. Call this first so the files go with the record.
 */
export async function deleteStoredFilesFor(where: { patientId?: string; diagnosisId?: string }) {
  const doomed = await prisma.attachment.findMany({ where, select: { storedName: true } });
  for (const { storedName } of doomed) {
    fs.unlink(path.join(UPLOAD_DIR, storedName), () => undefined);
  }
}

router.post(
  '/',
  uploadOne,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
    const meta = metaSchema.safeParse(req.body);
    if (!meta.success) {
      fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => undefined);
      return res.status(400).json({ error: 'Which patient this belongs to is missing.' });
    }

    const attachment = await prisma.attachment.create({
      data: {
        patientId: meta.data.patientId,
        diagnosisId: meta.data.diagnosisId || null,
        filename: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        label: meta.data.label || null,
      },
    });
    res.status(201).json(attachment);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { patientId, diagnosisId } = req.query as Record<string, string | undefined>;
    const attachments = await prisma.attachment.findMany({
      where: {
        patientId: patientId || undefined,
        diagnosisId: diagnosisId || undefined,
      },
      orderBy: { uploadedAt: 'asc' },
    });
    res.json(attachments);
  })
);

// Opened in a new tab or shown inline, so it is served rather than forced as a download.
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!attachment) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(UPLOAD_DIR, attachment.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(410).json({ error: 'This file is no longer on the clinic computer.' });
    }
    res.type(attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.filename.replace(/["\\]/g, '')}"`
    );
    fs.createReadStream(filePath).pipe(res);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!attachment) return res.status(404).json({ error: 'File not found' });
    await prisma.attachment.delete({ where: { id: req.params.id } });
    // The row is the record; a leftover file on disk is tidied up but never blocks the delete.
    fs.unlink(path.join(UPLOAD_DIR, attachment.storedName), () => undefined);
    res.status(204).end();
  })
);

export default router;
