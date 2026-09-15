import { describe, expect, it } from 'vitest';
import {
  addCycles,
  dueLabel,
  frequencyForCycle,
  isRecurring,
  nextDue,
  planCycles,
} from '../packages';
import { computeDoctorEarnings, settlementLabel } from '../commission';
import { installmentStatus } from '../money';

const day = (iso: string) => `${iso}T00:00:00.000Z`;

describe('billing cycles', () => {
  it('knows which shapes recur', () => {
    expect(isRecurring('WEEKLY')).toBe(true);
    expect(isRecurring('MONTHLY')).toBe(true);
    expect(isRecurring('ONE_TIME')).toBe(false);
    expect(isRecurring(null)).toBe(false);
  });

  it('turns a weekly plan into sessions, a total and a row of due dates', () => {
    const plan = planCycles({
      cycle: 'WEEKLY',
      sessionsPerCycle: 3,
      cycleFee: 4500,
      cycles: 4,
      startDate: day('2026-09-15'),
    });
    expect(plan.totalSessions).toBe(12);
    expect(plan.totalFee).toBe(18000);
    expect(plan.installments.map((i) => i.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
      '2026-10-06',
    ]);
  });

  it('bills a monthly plan once a month', () => {
    const plan = planCycles({
      cycle: 'MONTHLY',
      sessionsPerCycle: 12,
      cycleFee: 12000,
      cycles: 3,
      startDate: day('2026-01-31'),
    });
    expect(plan.totalFee).toBe(36000);
    // 31 January plus a month is the end of February, not the 3rd of March.
    expect(plan.installments.map((i) => i.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('never rolls a month-end date into the next month', () => {
    expect(addCycles(day('2026-03-31'), 'MONTHLY', 1).toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  it('spaces sessions so the agreed number fall in each cycle', () => {
    expect(frequencyForCycle('WEEKLY', 3)).toBe(2);
    expect(frequencyForCycle('MONTHLY', 12)).toBe(3);
    expect(frequencyForCycle('ONE_TIME', 10)).toBe(2);
  });
});

describe('the next payment due', () => {
  const now = new Date('2026-09-15T13:00:00.000Z');
  const rows = [
    { amount: 4500, dueDate: day('2026-09-08'), paidDate: '2026-09-08' },
    { amount: 4500, dueDate: day('2026-09-15'), paidDate: null },
    { amount: 4500, dueDate: day('2026-09-22'), paidDate: null },
  ];

  it('is the earliest one still unpaid', () => {
    expect(nextDue(rows, now)!.dueDate.slice(0, 10)).toBe('2026-09-15');
  });

  it('does not call a payment due today overdue', () => {
    const due = nextDue(rows, now)!;
    expect(due.overdue).toBe(false);
    expect(dueLabel(due)).toBe('Due today');
  });

  it('counts the days once the date has passed', () => {
    const later = new Date('2026-09-19T09:00:00.000Z');
    const due = nextDue(rows, later)!;
    expect(due.overdue).toBe(true);
    expect(dueLabel(due)).toBe('4 days overdue');
  });

  it('is null when everything is settled', () => {
    expect(nextDue(rows.map((r) => ({ ...r, paidDate: '2026-09-01' })), now)).toBeNull();
  });
});

describe('installment status', () => {
  // The same rule the reminders use: overdue starts the day after, not at midnight.
  it('is pending on the day it falls due', () => {
    const now = new Date('2026-09-15T23:00:00.000Z');
    expect(installmentStatus({ status: 'PENDING', dueDate: day('2026-09-15') }, now)).toBe('PENDING');
  });

  it('is overdue the next day', () => {
    const now = new Date('2026-09-16T00:30:00.000Z');
    expect(installmentStatus({ status: 'PENDING', dueDate: day('2026-09-15') }, now)).toBe('OVERDUE');
  });
});

describe('doctor settlement', () => {
  const doctor = { id: 'doc1', commissionPercent: 70 };
  const range = { from: new Date('2026-09-01'), to: new Date('2026-09-30T23:59:59') };
  const visits = [
    { doctorId: 'doc1', fee: 1000, attendance: 'PRESENT', scheduledDate: day('2026-09-05') },
    { doctorId: 'doc1', fee: 1000, attendance: 'PRESENT', scheduledDate: day('2026-09-07') },
    { doctorId: 'doc1', fee: 1000, attendance: 'PRESENT', scheduledDate: day('2026-09-09') },
    { doctorId: 'doc1', fee: 1000, attendance: 'PRESENT', scheduledDate: day('2026-09-11') },
    // Not earned: nobody attended these.
    { doctorId: 'doc1', fee: 1000, attendance: 'ABSENT', scheduledDate: day('2026-09-12') },
    { doctorId: 'doc1', fee: 1000, attendance: 'SCHEDULED', scheduledDate: day('2026-09-30') },
    // Another doctor's work.
    { doctorId: 'doc2', fee: 5000, attendance: 'PRESENT', scheduledDate: day('2026-09-05') },
    // Outside the range.
    { doctorId: 'doc1', fee: 1000, attendance: 'PRESENT', scheduledDate: day('2026-08-05') },
  ];

  it('earns commission only on sessions that were attended', () => {
    const e = computeDoctorEarnings(doctor, visits, [], [], range);
    expect(e.sessions).toBe(4);
    expect(e.gross).toBe(4000);
    expect(e.doctorShare).toBe(2800);
    expect(e.clinicShare).toBe(1200);
  });

  it('the clinic owes the doctor when the front desk took the money', () => {
    const e = computeDoctorEarnings(doctor, visits, [], [], range);
    expect(e.balance).toBe(2800);
    expect(settlementLabel(e.balance)).toBe('Clinic owes the doctor');
  });

  it('the doctor owes the clinic when they took it all at the chair', () => {
    const payments = [
      { amount: 4000, type: 'SESSION_FEE', date: day('2026-09-11'), collectedByDoctorId: 'doc1' },
    ];
    const e = computeDoctorEarnings(doctor, visits, payments, [], range);
    // They hold 4,000 but only 2,800 is theirs, so the clinic's 1,200 commission is owed back.
    expect(e.balance).toBe(-1200);
    expect(settlementLabel(e.balance)).toBe('Doctor owes the clinic');
  });

  it('a refund reduces what the doctor is holding', () => {
    const payments = [
      { amount: 4000, type: 'SESSION_FEE', date: day('2026-09-11'), collectedByDoctorId: 'doc1' },
      { amount: 1000, type: 'REFUND', date: day('2026-09-12'), collectedByDoctorId: 'doc1' },
    ];
    const e = computeDoctorEarnings(doctor, visits, payments, [], range);
    expect(e.collectedByDoctor).toBe(3000);
    expect(e.balance).toBe(-200);
  });

  it('subtracts what has already been paid out', () => {
    const payouts = [{ amount: 2000, date: day('2026-09-28'), doctorId: 'doc1' }];
    const e = computeDoctorEarnings(doctor, visits, [], payouts, range);
    expect(e.paidOut).toBe(2000);
    expect(e.balance).toBe(800);
  });

  it('settles to nothing when the sums meet', () => {
    const payouts = [{ amount: 2800, date: day('2026-09-28'), doctorId: 'doc1' }];
    const e = computeDoctorEarnings(doctor, visits, [], payouts, range);
    expect(e.balance).toBe(0);
    expect(settlementLabel(e.balance)).toBe('Settled up');
  });

  it('earns nothing for a doctor with no commission set', () => {
    const e = computeDoctorEarnings({ id: 'doc1' }, visits, [], [], range);
    expect(e.doctorShare).toBe(0);
    expect(e.clinicShare).toBe(4000);
  });
});
