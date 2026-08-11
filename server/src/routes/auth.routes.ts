import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { signToken } from '../utils/jwt';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'DOCTOR', 'RECEPTIONIST']).default('RECEPTIONIST'),
});

router.post(
  '/users',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
    });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);

router.get(
  '/users',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  })
);

router.delete(
  '/users/:id',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
