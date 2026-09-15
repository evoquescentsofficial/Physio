/**
 * Packages that run by the week or the month.
 *
 * A course of treatment is sold in one of three shapes:
 *
 *  - **One-off**: 10 sessions for Rs 15,000, paid as an advance plus installments.
 *  - **Weekly**: 3 sessions a week at Rs 4,000 a week, for 6 weeks.
 *  - **Monthly**: 12 sessions a month at Rs 12,000 a month, for 3 months.
 *
 * The weekly and monthly shapes are turned into the same underlying package — a session
 * count, a total fee and a row of dated installments, one per cycle. Everything downstream
 * (the money rules, attendance, the P&L) therefore keeps working untouched, and the cycle is
 * what the clinic talks about rather than a second way of counting money.
 */

export const BILLING_CYCLES = ['ONE_TIME', 'WEEKLY', 'MONTHLY'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  ONE_TIME: 'One-off package',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

/** "week" / "month", for sentences like "Rs 12,000 per month". */
export function cycleNoun(cycle: BillingCycle): string {
  return cycle === 'WEEKLY' ? 'week' : cycle === 'MONTHLY' ? 'month' : 'package';
}

export function isRecurring(cycle: string | null | undefined): boolean {
  return cycle === 'WEEKLY' || cycle === 'MONTHLY';
}

/** The n-th cycle boundary from a start date. Month arithmetic clamps to the month's length. */
export function addCycles(start: Date | string, cycle: BillingCycle, count: number): Date {
  const date = new Date(start);
  if (cycle === 'WEEKLY') {
    date.setDate(date.getDate() + 7 * count);
    return date;
  }
  if (cycle === 'MONTHLY') {
    // 31 Jan + 1 month is 28 Feb, not 3 March: keep the payment inside the month it belongs to.
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + count);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
    return date;
  }
  return date;
}

export interface CyclePlan {
  totalSessions: number;
  totalFee: number;
  /** One installment per cycle, the first due on the start date. */
  installments: { amount: number; dueDate: Date }[];
}

/**
 * Turns "3 sessions a week at Rs 4,000 a week for 6 weeks" into the package the rest of the
 * system understands, plus the row of due dates that drives the payment reminders.
 */
export function planCycles(input: {
  cycle: BillingCycle;
  sessionsPerCycle: number;
  cycleFee: number;
  cycles: number;
  startDate: Date | string;
}): CyclePlan {
  const cycles = Math.max(1, Math.floor(input.cycles));
  const sessionsPerCycle = Math.max(1, Math.floor(input.sessionsPerCycle));
  const cycleFee = Math.max(0, input.cycleFee);

  return {
    totalSessions: sessionsPerCycle * cycles,
    totalFee: cycleFee * cycles,
    installments: Array.from({ length: cycles }).map((_, i) => ({
      amount: cycleFee,
      dueDate: addCycles(input.startDate, input.cycle, i),
    })),
  };
}

/**
 * How far apart to book sessions so that `sessionsPerCycle` of them fall in each cycle —
 * 3 a week is roughly every other day, 12 a month is roughly every 2-3 days.
 */
export function frequencyForCycle(cycle: BillingCycle, sessionsPerCycle: number): number {
  const days = cycle === 'WEEKLY' ? 7 : cycle === 'MONTHLY' ? 30 : 0;
  if (!days || sessionsPerCycle <= 0) return 2;
  return Math.max(1, Math.round(days / sessionsPerCycle));
}

export interface DueReminder {
  amount: number;
  dueDate: string;
  /** Negative when the date has passed. */
  daysAway: number;
  overdue: boolean;
}

/**
 * The next payment a patient owes: the earliest installment still unpaid. Overdue counts from
 * the start of today, so a payment due today is not already late.
 */
export function nextDue(
  installments: { amount: number; dueDate: string | Date; paidDate?: string | null }[],
  now: Date = new Date()
): DueReminder | null {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const pending = installments
    .filter((i) => !i.paidDate)
    .map((i) => ({ amount: i.amount, due: new Date(i.dueDate) }))
    .filter((i) => !Number.isNaN(i.due.getTime()))
    .sort((a, b) => a.due.getTime() - b.due.getTime());

  if (!pending.length) return null;

  const next = pending[0];
  const dueDay = new Date(next.due);
  dueDay.setHours(0, 0, 0, 0);
  const daysAway = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  return {
    amount: next.amount,
    dueDate: next.due.toISOString(),
    daysAway,
    overdue: daysAway < 0,
  };
}

/** "Due today", "Due in 3 days", "9 days overdue" — the words a receptionist would use. */
export function dueLabel(due: DueReminder): string {
  if (due.daysAway === 0) return 'Due today';
  if (due.daysAway === 1) return 'Due tomorrow';
  if (due.daysAway > 1) return `Due in ${due.daysAway} days`;
  if (due.daysAway === -1) return '1 day overdue';
  return `${Math.abs(due.daysAway)} days overdue`;
}

export interface PlanSummary {
  /** What the patient still owes on this package. */
  balance: number;
  /** How much of that has a date against it. */
  scheduled: number;
  /** Owed, but with no date set yet. */
  unscheduled: number;
  /** Scheduled beyond what is owed — usually a plan that was edited twice. */
  over: number;
}

/**
 * Does the payment plan add up?
 *
 * The clinic decides the dates and the amounts: an advance now, then whatever the patient can
 * manage, whenever they agreed to. That freedom is only safe if the screen says plainly whether
 * the instalments cover the balance, fall short, or overshoot it.
 */
export function planSummary(
  totalFee: number,
  paid: number,
  installments: { amount: number; paidDate?: string | null }[]
): PlanSummary {
  const balance = Math.max(0, round2(totalFee - paid));
  const scheduled = round2(
    installments.filter((i) => !i.paidDate).reduce((sum, i) => sum + i.amount, 0)
  );
  return {
    balance,
    scheduled,
    unscheduled: Math.max(0, round2(balance - scheduled)),
    over: Math.max(0, round2(scheduled - balance)),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** 1st, 2nd, 3rd, 4th… — how the clinic and the patient count the payments. */
export function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th';
  return `${n}${suffix}`;
}

/** "1st installment", "2nd installment" — the name of a row in the payment plan. */
export function installmentLabel(index: number): string {
  return `${ordinal(index + 1)} installment`;
}
