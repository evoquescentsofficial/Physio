import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  Field,
  PageHeader,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import { Payment } from '../types';
import { netAmount, sumDiscounts, sumPayments } from '../../../shared/money';

export default function Payments() {
  const now = new Date();
  const [from, setFrom] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [type, setType] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);

  const load = useCallback(async () => {
    const res = await api.get('/payments', {
      params: { from, to: to ? `${to}T23:59:59` : undefined, type: type || undefined },
    });
    setPayments(res.data);
  }, [from, to, type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get('/reports/outstanding').then((r) => setOutstanding(r.data));
    api.get('/reports/credits').then((r) => setCredits(r.data));
  }, []);

  const total = sumPayments(payments);
  const advances = payments.filter((p) => p.type === 'ADVANCE').reduce((s, p) => s + p.amount, 0);
  const discountsGiven = sumDiscounts(payments);

  return (
    <div>
      <PageHeader title="Payments" subtitle="Advances, session fees and installment collections" />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="From">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option value="CHECKUP_FEE">Checkup fee</option>
              <option value="ADVANCE">Advance</option>
              <option value="SESSION_FEE">Session fee</option>
              <option value="INSTALLMENT">Installment</option>
              <option value="VISIT_FEE">Visit fee</option>
              <option value="REFUND">Refund</option>
            </select>
          </Field>
        </div>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Collected in range
          </div>
          <div className="mt-1 text-xl font-bold text-emerald-600">{currency(total)}</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Discounts given
          </div>
          <div className="mt-1 text-xl font-bold text-brand-700">{currency(discountsGiven)}</div>
          <div className="mt-0.5 text-xs text-ink-400">
            {currency(advances)} taken as advances
          </div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Total outstanding dues
          </div>
          <div className="mt-1 text-xl font-bold text-red-600">
            {currency(outstanding.reduce((s, o) => s + o.due, 0))}
          </div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Patient credits held
          </div>
          <div className="mt-1 text-xl font-bold text-emerald-600">
            {currency(credits.reduce((s, c) => s + c.credit, 0))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="border-b border-ink-100 px-5 py-3 font-semibold text-ink-900">
            Payment records
          </div>
          {payments.length === 0 ? (
            <EmptyState message="No payments in this range" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Patient</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Method</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-brand-50/40">
                      <td className="px-5 py-3 text-ink-700">{formatDate(p.date)}</td>
                      <td className="px-5 py-3">
                        <Link
                          to={`/patients/${p.patientId}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {p.patient?.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={p.type} />
                        {!!p.discount && (
                          <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {currency(p.discount)} off
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-600">{p.method.replace(/_/g, ' ')}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          p.type === 'REFUND' ? 'text-red-600' : 'text-ink-900'
                        }`}
                      >
                        {currency(netAmount(p))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-3 font-semibold text-ink-900">
            Outstanding dues
          </div>
          {outstanding.length === 0 ? (
            <EmptyState message="All packages fully paid" />
          ) : (
            <div className="divide-y divide-ink-100">
              {outstanding.map((o) => (
                <div key={o.patient.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link
                      to={`/patients/${o.patient.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      {o.patient.name}
                    </Link>
                    <div className="text-xs text-ink-400">
                      {currency(o.paid)} paid of {currency(o.packageValue)}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-red-600">{currency(o.due)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="border-y border-ink-100 bg-ink-50 px-5 py-3 font-semibold text-ink-900">
            Credit balances
          </div>
          {credits.length === 0 ? (
            <EmptyState message="No patient is in credit" />
          ) : (
            <div className="divide-y divide-ink-100">
              {credits.map((c) => (
                <div key={c.patient.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link
                      to={`/patients/${c.patient.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      {c.patient.name}
                    </Link>
                    <div className="text-xs text-ink-400">Applies to their next package</div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600">{currency(c.credit)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
