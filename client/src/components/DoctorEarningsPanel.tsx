import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, ConfirmDialog, EmptyState, Field, Modal, currency, formatDate, toInputDate } from './ui';
import { DoctorEarnings } from '../types';
import { monthLabel, salaryPeriod, settlementLabel } from '../../../shared/commission';

function monthRange(period: string) {
  const [y, m] = period.split('-').map(Number);
  return {
    from: toInputDate(new Date(y, m - 1, 1)),
    to: toInputDate(new Date(y, m, 0)),
  };
}

/** The last six months, newest first — the range anyone actually settles over. */
function recentPeriods(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    out.push(salaryPeriod(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
}

/**
 * Who owes whom, for doctors who work on commission.
 *
 * A commission doctor keeps a share of what their sessions bill. Whether the clinic ends up
 * owing them or the other way round depends on who took the money at the time: the front desk,
 * or the doctor at the chair. Both are counted here, along with anything already paid out, so
 * the closing figure is the only number the two of them have to agree on.
 */
export default function DoctorEarningsPanel({ onPaid }: { onPaid: () => void }) {
  const [period, setPeriod] = useState(salaryPeriod(new Date()));
  const [range, setRange] = useState(monthRange(salaryPeriod(new Date())));
  const [rows, setRows] = useState<DoctorEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState<DoctorEarnings | null>(null);
  const [confirmSalaries, setConfirmSalaries] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/doctors/earnings', { params: range });
      setRows(res.data.doctors || []);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  function choosePeriod(p: string) {
    setPeriod(p);
    setRange(monthRange(p));
  }

  async function postSalaries() {
    const res = await api.post('/doctors/post-salaries', { period });
    setConfirmSalaries(false);
    setMessage(
      res.data.posted
        ? `Posted ${res.data.posted} ${res.data.posted === 1 ? 'salary' : 'salaries'} for ${monthLabel(
            period
          )} — ${currency(res.data.total)} added to expenses.`
        : `Salaries for ${monthLabel(period)} were already posted. Nothing was paid twice.`
    );
    await load();
    onPaid();
  }

  const commission = rows.filter((r) => r.doctor.employmentType === 'COMMISSION');
  const salaried = rows.filter((r) => r.doctor.employmentType !== 'COMMISSION');
  const salaryBill = salaried.reduce((sum, r) => sum + (r.doctor.monthlySalary || 0), 0);

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-ink-900">Earnings &amp; settlement</h3>
          <p className="text-xs text-ink-400">
            Commission is earned on sessions the patient actually attended
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input !w-auto !py-1.5 !text-sm"
            value={period}
            onChange={(e) => choosePeriod(e.target.value)}
          >
            {recentPeriods().map((p) => (
              <option key={p} value={p}>
                {monthLabel(p)}
              </option>
            ))}
          </select>
          {salaryBill > 0 && (
            <button className="btn-secondary !py-1.5 !text-sm" onClick={() => setConfirmSalaries(true)}>
              Post salaries ({currency(salaryBill)})
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {loading ? (
        <div className="px-5 py-6 text-sm text-ink-400">Working it out…</div>
      ) : commission.length === 0 ? (
        <EmptyState message="No commission doctors yet. Add one and their share is worked out here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
              <tr>
                <th className="th">Doctor</th>
                <th className="th">Sessions</th>
                <th className="th">Billed</th>
                <th className="th">Their share</th>
                <th className="th">Clinic keeps</th>
                <th className="th">Took at the chair</th>
                <th className="th">Already paid</th>
                <th className="th">Settlement</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {commission.map((r) => (
                <tr key={r.doctor.id} className="hover:bg-brand-50/40">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink-900">{r.doctor.name}</div>
                    <div className="text-xs text-ink-400">
                      {r.doctor.commissionPercent ?? 0}% of billings
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-700">{r.sessions}</td>
                  <td className="px-5 py-3 text-ink-700">{currency(r.gross)}</td>
                  <td className="px-5 py-3 font-medium text-ink-900">{currency(r.doctorShare)}</td>
                  <td className="px-5 py-3 text-emerald-700">{currency(r.clinicShare)}</td>
                  <td className="px-5 py-3 text-ink-700">{currency(r.collectedByDoctor)}</td>
                  <td className="px-5 py-3 text-ink-700">{currency(r.paidOut)}</td>
                  <td className="px-5 py-3">
                    <div
                      className={`font-bold ${
                        Math.abs(r.balance) < 0.005
                          ? 'text-ink-500'
                          : r.balance > 0
                            ? 'text-red-600'
                            : 'text-emerald-700'
                      }`}
                    >
                      {currency(Math.abs(r.balance))}
                    </div>
                    <div className="text-xs text-ink-400">{settlementLabel(r.balance)}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.balance > 0 && (
                      <button
                        className="btn-secondary !py-1 !text-xs"
                        onClick={() => setPayFor(r)}
                      >
                        Pay out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PayoutModal
        row={payFor}
        period={period}
        onClose={() => setPayFor(null)}
        onSaved={async () => {
          setPayFor(null);
          await load();
          onPaid();
        }}
      />

      <ConfirmDialog
        open={confirmSalaries}
        title={`Post salaries for ${monthLabel(period)}?`}
        message={
          <>
            {currency(salaryBill)} across {salaried.filter((r) => r.doctor.monthlySalary).length}{' '}
            salaried {salaried.length === 1 ? 'doctor' : 'doctors'} will be recorded as expenses,
            dated the last day of the month. A month already posted is skipped, so nobody is paid
            twice.
          </>
        }
        confirmLabel="Post salaries"
        tone="primary"
        onCancel={() => setConfirmSalaries(false)}
        onConfirm={postSalaries}
      />
    </Card>
  );
}

/** Paying a doctor their share records an expense, so the P&L sees the money leaving. */
function PayoutModal({
  row,
  period,
  onClose,
  onSaved,
}: {
  row: DoctorEarnings | null;
  period: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toInputDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (row) {
      setAmount(Math.max(0, Math.round(row.balance)));
      setDate(toInputDate(new Date()));
      setError('');
    }
  }, [row?.doctor.id]);

  async function save() {
    if (!row) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/expenses', {
        category: 'COMMISSION',
        title: `Commission — ${row.doctor.name}`,
        amount: Number(amount),
        date,
        paidTo: row.doctor.name,
        doctorId: row.doctor.id,
        notes: `Settlement for ${monthLabel(period)}`,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'That payout could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  if (!row) return null;

  return (
    <Modal open onClose={onClose} title={`Pay ${row.doctor.name}`}>
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700">
          {row.sessions} sessions billing {currency(row.gross)}. Their {row.doctor.commissionPercent}%
          share is {currency(row.doctorShare)}
          {row.collectedByDoctor > 0 && <> , of which they already took {currency(row.collectedByDoctor)} at the chair</>}
          {row.paidOut > 0 && <> , and {currency(row.paidOut)} has been paid</>}.
        </div>
        <Field label="Amount to pay now">
          <input
            className="input"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
        <Field label="Date">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <p className="text-xs text-ink-500">
          Recorded as a commission expense on {formatDate(date)}, so it shows in the P&amp;L and
          comes off what is still owed.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Recording…' : `Pay ${currency(amount)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
