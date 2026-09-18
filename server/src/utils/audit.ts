import { Request } from 'express';
import { prisma } from '../db';

/**
 * Records who did what, for the admin-only activity log. Called after a mutation succeeds,
 * from the route itself, so a summary can be written in plain words rather than reconstructed
 * from a before/after diff later.
 */
export async function logAudit(
  req: Request,
  opts: {
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'COLLECT';
    entityType: 'PATIENT' | 'DIAGNOSIS' | 'VISIT' | 'ATTACHMENT' | 'PAYMENT';
    entityId: string;
    summary: string;
    patientId?: string | null;
  }
) {
  const user = req.user!;
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      patientId: opts.patientId || null,
      summary: opts.summary,
    },
  });
}
