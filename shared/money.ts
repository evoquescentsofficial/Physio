/**
 * The single definition of how money is counted, imported by the Express API, the React
 * client and the browser-only demo backend.
 *
 * It used to live in three places and they disagreed: reports excluded refunds entirely,
 * the account calculation subtracted them, and the patient page added them. Anything that
 * sums payments must go through `netAmount` so those answers can never drift apart again.
 */

export const PAYMENT_TYPES = [
  'CHECKUP_FEE',
  'ADVANCE',
  'SESSION_FEE',
  'INSTALLMENT',
  'VISIT_FEE',
  'REFUND',
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ATTENDANCE_STATUSES = [
  'SCHEDULED',
  'PRESENT',
  'ABSENT',
  'CARRIED_FORWARD',
  'CANCELLED',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const VISIT_TYPES = ['INITIAL_CONSULT', 'SESSION', 'FOLLOWUP'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const PACKAGE_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export const INSTALLMENT_STATUSES = ['PENDING', 'PAID'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  'SALARY',
  'RENT',
  'UTILITIES',
  'EQUIPMENT',
  'MARKETING',
  'MAINTENANCE',
  'OTHER',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface MoneyRow {
  amount: number;
  type: string;
  packageId?: string | null;
  discount?: number | null;
}

/** What the visit would have cost before any concession was applied. */
export function standardAmount(payment: MoneyRow): number {
  return payment.amount + (payment.discount || 0);
}

/** Total given away as family rates, concessions and waived visits. */
export function sumDiscounts(payments: MoneyRow[]): number {
  return payments.reduce((total, p) => total + (p.discount || 0), 0);
}

/** A refund is money leaving the till, so it counts against revenue rather than for it. */
export function netAmount(payment: { amount: number; type: string }): number {
  return payment.type === 'REFUND' ? -payment.amount : payment.amount;
}

/** Net total of a set of payments, refunds included as negatives. */
export function sumPayments(payments: MoneyRow[]): number {
  return payments.reduce((total, p) => total + netAmount(p), 0);
}

/**
 * Money that sits against a patient's account rather than being settled on the spot.
 * Packages create the debt; checkup and single-session fees are paid as they happen and
 * cancel out. An advance or installment with no package named is still money on account.
 */
export function isOnAccount(payment: MoneyRow): boolean {
  return (
    payment.packageId != null || payment.type === 'ADVANCE' || payment.type === 'INSTALLMENT'
  );
}

export function sumOnAccount(payments: MoneyRow[]): number {
  return sumPayments(payments.filter(isOnAccount));
}

export interface AccountPosition {
  packageValue: number;
  paid: number;
  due: number;
  credit: number;
}

/** Where a patient stands: what they were charged, what they paid, and which way it leans. */
export function accountPosition(
  packages: { totalFee: number; status: string }[],
  payments: MoneyRow[]
): AccountPosition {
  const packageValue = packages
    .filter((p) => p.status !== 'CANCELLED')
    .reduce((total, p) => total + p.totalFee, 0);
  const paid = sumOnAccount(payments);
  const balance = packageValue - paid;
  return {
    packageValue,
    paid,
    due: Math.max(balance, 0),
    credit: Math.max(-balance, 0),
  };
}

/**
 * Split a balance into equal monthly installments, with any rounding remainder placed on
 * the last one so the parts always add back up to the balance exactly.
 */
export function splitInstallments(balance: number, count: number): number[] {
  if (count <= 0 || balance <= 0) return [];
  const per = Math.floor(balance / count);
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? balance - per * (count - 1) : per
  );
}

/**
 * OVERDUE is a fact about today, not a stored state — an installment that is PENDING past
 * its due date is overdue, and stops being so the moment it is paid. Storing it would need
 * a nightly job and would be wrong between runs.
 */
export function installmentStatus(
  installment: { status: string; dueDate: string | Date },
  now: Date = new Date()
): 'PENDING' | 'PAID' | 'OVERDUE' {
  if (installment.status === 'PAID') return 'PAID';
  const due = new Date(installment.dueDate);
  return due < now ? 'OVERDUE' : 'PENDING';
}
