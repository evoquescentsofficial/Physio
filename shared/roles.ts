/**
 * Who can do what, in one place, so the server's route guards and the client's nav/UI hiding
 * can never quietly disagree with each other.
 *
 * Four roles: ADMIN and DOCTOR are "senior" staff — full clinical and financial access.
 * JUNIOR_DOCTOR covers a trainee taking patient details, writing up an assessment and
 * uploading reports before a senior doctor sees the patient — clinical access, but no money,
 * and their assessments sit "pending review" until a senior doctor signs off. RECEPTIONIST
 * runs the front desk: booking, attendance, payments, but not deleting records or the
 * practice's settings.
 */

export const ROLES = ['ADMIN', 'DOCTOR', 'JUNIOR_DOCTOR', 'RECEPTIONIST'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  JUNIOR_DOCTOR: 'Junior doctor',
  RECEPTIONIST: 'Receptionist',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Full access, including staff accounts, settings and the activity log.',
  DOCTOR: 'Full clinical and financial access. Can review a junior doctor’s assessments.',
  JUNIOR_DOCTOR:
    'Patients, diagnoses, sessions and reports. No payments, expenses, analytics or settings. Assessments need a senior doctor’s review, and records cannot be deleted.',
  RECEPTIONIST: 'Front desk: booking, attendance and payments. Cannot delete records or change settings.',
};

/** A senior doctor's or admin's own work never needs anyone else's sign-off. */
export function canReview(role: string): boolean {
  return role === 'ADMIN' || role === 'DOCTOR';
}

/** Whether this role's own assessments start out "pending review" rather than approved. */
export function needsReview(role: string): boolean {
  return role === 'JUNIOR_DOCTOR';
}

export function hasFinancialAccess(role: string): boolean {
  return role !== 'JUNIOR_DOCTOR';
}

export function canDeleteRecords(role: string): boolean {
  return role !== 'JUNIOR_DOCTOR';
}

export function canManageStaff(role: string): boolean {
  return role === 'ADMIN';
}
