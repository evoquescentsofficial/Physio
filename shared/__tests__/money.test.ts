import { describe, expect, it } from 'vitest';
import {
  accountPosition,
  installmentStatus,
  netAmount,
  splitInstallments,
  sumOnAccount,
  sumPayments,
} from '../money';

describe('netAmount', () => {
  it('counts a refund against revenue', () => {
    expect(netAmount({ amount: 1000, type: 'SESSION_FEE' })).toBe(1000);
    expect(netAmount({ amount: 1000, type: 'REFUND' })).toBe(-1000);
  });
});

describe('sumPayments', () => {
  it('nets refunds off the total rather than ignoring them', () => {
    const total = sumPayments([
      { amount: 5000, type: 'ADVANCE' },
      { amount: 1500, type: 'SESSION_FEE' },
      { amount: 2000, type: 'REFUND' },
    ]);
    expect(total).toBe(4500);
  });
});

describe('sumOnAccount', () => {
  it('counts package payments and unattached advances, not walk-in fees', () => {
    const onAccount = sumOnAccount([
      { amount: 5000, type: 'ADVANCE', packageId: 'pkg1' },
      { amount: 3000, type: 'ADVANCE', packageId: null },
      { amount: 1000, type: 'CHECKUP_FEE', packageId: null },
      { amount: 1500, type: 'SESSION_FEE', packageId: null },
    ]);
    expect(onAccount).toBe(8000);
  });
});

describe('accountPosition', () => {
  const pkg = (totalFee: number, status = 'ACTIVE') => ({ totalFee, status });

  it('reports what is still owed', () => {
    const position = accountPosition(
      [pkg(15000)],
      [{ amount: 5000, type: 'ADVANCE', packageId: 'pkg1' }]
    );
    expect(position).toEqual({ packageValue: 15000, paid: 5000, due: 10000, credit: 0 });
  });

  it('turns an overpayment into credit rather than losing it', () => {
    const position = accountPosition(
      [pkg(2500)],
      [{ amount: 3000, type: 'ADVANCE', packageId: 'pkg1' }]
    );
    expect(position.due).toBe(0);
    expect(position.credit).toBe(500);
  });

  it('applies existing credit to a later package', () => {
    const position = accountPosition(
      [pkg(2500), pkg(2000)],
      [{ amount: 3000, type: 'ADVANCE', packageId: 'pkg1' }]
    );
    expect(position.due).toBe(1500);
    expect(position.credit).toBe(0);
  });

  it('ignores cancelled packages', () => {
    expect(accountPosition([pkg(15000, 'CANCELLED')], []).packageValue).toBe(0);
  });

  it('lets a refund put the patient back into debt', () => {
    const position = accountPosition(
      [pkg(10000)],
      [
        { amount: 10000, type: 'ADVANCE', packageId: 'pkg1' },
        { amount: 4000, type: 'REFUND', packageId: 'pkg1' },
      ]
    );
    expect(position.due).toBe(4000);
  });
});

describe('splitInstallments', () => {
  it('always sums back to the balance', () => {
    for (const [balance, count] of [
      [10000, 3],
      [2500, 4],
      [999, 7],
      [1, 3],
    ] as const) {
      const parts = splitInstallments(balance, count);
      expect(parts).toHaveLength(count);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(balance);
    }
  });

  it('puts the rounding remainder on the last installment', () => {
    expect(splitInstallments(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it('creates nothing when there is nothing left to pay', () => {
    expect(splitInstallments(0, 3)).toEqual([]);
    expect(splitInstallments(5000, 0)).toEqual([]);
  });
});

describe('installmentStatus', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('is overdue once the due date has passed', () => {
    expect(installmentStatus({ status: 'PENDING', dueDate: '2026-06-01' }, now)).toBe('OVERDUE');
  });

  it('is pending while still in the future', () => {
    expect(installmentStatus({ status: 'PENDING', dueDate: '2026-07-01' }, now)).toBe('PENDING');
  });

  it('stays paid even long after the due date', () => {
    expect(installmentStatus({ status: 'PAID', dueDate: '2026-01-01' }, now)).toBe('PAID');
  });
});
