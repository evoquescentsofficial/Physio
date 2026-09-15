/**
 * How a doctor is paid, and who owes whom at the end of the month.
 *
 * Two arrangements exist side by side in a clinic like this one:
 *
 *  - **Salaried.** A fixed monthly amount, posted to expenses like rent. Nothing to settle.
 *  - **Commission.** The doctor sits in the clinic and keeps a share of what their patients
 *    pay — say 70% theirs, 30% the clinic's. What has to be settled depends on who took the
 *    money: if the front desk took it, the clinic owes the doctor their share; if the doctor
 *    took it at the chair, the doctor owes the clinic its commission.
 *
 * Both sides of that are the same sum, which is why it is computed in one place and imported
 * by the API, the client and the demo rather than written out three times.
 */

export const EMPLOYMENT_TYPES = ['SALARIED', 'COMMISSION'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** The departments a clinic runs. Editable in Settings; this is the starting list. */
export const DEFAULT_DEPARTMENTS = [
  'Physiotherapy',
  'Orthopaedic rehabilitation',
  'Neuro rehabilitation',
  'Sports injury rehabilitation',
  "Women's health",
  'Paediatric physiotherapy',
  'Chiropractic',
];

interface EarningVisit {
  doctorId?: string | null;
  fee: number;
  attendance: string;
  scheduledDate: string | Date;
  completedDate?: string | Date | null;
}

interface EarningPayment {
  amount: number;
  type: string;
  date: string | Date;
  collectedByDoctorId?: string | null;
}

interface Payout {
  amount: number;
  date: string | Date;
  doctorId?: string | null;
}

export interface DoctorEarnings {
  /** Sessions the patient actually attended in the range. */
  sessions: number;
  /** What those sessions were worth. */
  gross: number;
  /** The doctor's share of that. */
  doctorShare: number;
  /** What the clinic keeps. */
  clinicShare: number;
  /** Money the doctor took directly from patients and is holding. */
  collectedByDoctor: number;
  /** Commission or salary already paid out to them, recorded as an expense. */
  paidOut: number;
  /**
   * Positive: the clinic owes the doctor this much.
   * Negative: the doctor is holding this much of the clinic's money.
   */
  balance: number;
}

function inRange(date: string | Date, from?: Date, to?: Date) {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

/**
 * Commission is earned on sessions the patient actually turned up for — a booking nobody
 * attended earned nothing, and a cancelled one certainly did not.
 */
export function isEarningVisit(visit: { attendance: string }) {
  return visit.attendance === 'PRESENT';
}

/** The date a session counts on: when it happened, falling back to when it was booked for. */
export function earningDate(visit: EarningVisit) {
  return visit.completedDate || visit.scheduledDate;
}

export function computeDoctorEarnings(
  doctor: { id: string; commissionPercent?: number | null },
  visits: EarningVisit[],
  payments: EarningPayment[],
  payouts: Payout[],
  range: { from?: Date; to?: Date } = {}
): DoctorEarnings {
  const share = Math.min(100, Math.max(0, doctor.commissionPercent ?? 0));

  const worked = visits.filter(
    (v) => v.doctorId === doctor.id && isEarningVisit(v) && inRange(earningDate(v), range.from, range.to)
  );
  const gross = worked.reduce((sum, v) => sum + v.fee, 0);
  const doctorShare = round2((gross * share) / 100);

  // A refund hands money back, so it reduces what the doctor is holding rather than adding to it.
  const collectedByDoctor = payments
    .filter((p) => p.collectedByDoctorId === doctor.id && inRange(p.date, range.from, range.to))
    .reduce((sum, p) => sum + (p.type === 'REFUND' ? -p.amount : p.amount), 0);

  const paidOut = payouts
    .filter((e) => e.doctorId === doctor.id && inRange(e.date, range.from, range.to))
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    sessions: worked.length,
    gross: round2(gross),
    doctorShare,
    clinicShare: round2(gross - doctorShare),
    collectedByDoctor: round2(collectedByDoctor),
    paidOut: round2(paidOut),
    balance: round2(doctorShare - collectedByDoctor - paidOut),
  };
}

/** Rupees, to the paisa. Kept here so every surface rounds identically. */
export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Plain words for a settlement figure, so no screen has to work out the sign twice. */
export function settlementLabel(balance: number) {
  if (Math.abs(balance) < 0.005) return 'Settled up';
  return balance > 0 ? 'Clinic owes the doctor' : 'Doctor owes the clinic';
}

/**
 * The month a salary belongs to, as `YYYY-MM`. Salary expenses carry it in a tag so posting
 * the same month twice can be refused rather than quietly doubling the wage bill.
 */
export function salaryPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function salaryTag(period: string) {
  return `[salary:${period}]`;
}

export function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}
