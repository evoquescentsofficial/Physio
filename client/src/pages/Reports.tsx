import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { Card, EmptyState, Field, PageHeader, currency, formatDate, toInputDate } from '../components/ui';

interface PLRow {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

/** Presets are expressed as "the last N days ending today"; 1 day means today only. */
const PRESETS: { key: string; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 3 months', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
];

export default function Reports() {
  const [preset, setPreset] = useState('30');
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));
  const [rows, setRows] = useState<PLRow[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, expenses: 0, profit: 0 });
  const [revenueBreakdown, setRevenueBreakdown] = useState<any[]>([]);

  const query = useMemo(() => {
    if (preset === 'custom') return `from=${customFrom}&to=${customTo}`;
    const days = PRESETS.find((p) => p.key === preset)?.days ?? 30;
    return `days=${days}`;
  }, [preset, customFrom, customTo]);

  const rangeLabel = useMemo(() => {
    if (preset === 'custom') return `${formatDate(customFrom)} — ${formatDate(customTo)}`;
    return PRESETS.find((p) => p.key === preset)?.label ?? '';
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    api.get(`/reports/profit-loss?${query}`).then((r) => {
      setRows(r.data.rows);
      setTotals(r.data.totals);
    });
    api.get(`/reports/revenue?${query}`).then((r) => setRevenueBreakdown(r.data));
  }, [query]);

  const margin = totals.revenue ? (totals.profit / totals.revenue) * 100 : 0;

  function exportCsv() {
    const header = 'Period,Revenue,Expenses,Profit\n';
    const body = rows.map((r) => `${r.month},${r.revenue},${r.expenses},${r.profit}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-loss-${rangeLabel.replace(/[^\w]+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Reports & Profit / Loss"
        subtitle="Financial performance over time"
        actions={
          <button className="btn-secondary" onClick={exportCsv}>
            Export CSV
          </button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={preset === p.key ? 'btn-primary !py-1' : 'btn-secondary !py-1'}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPreset('custom')}
            className={preset === 'custom' ? 'btn-primary !py-1' : 'btn-secondary !py-1'}
          >
            Custom range
          </button>
        </div>

        {preset === 'custom' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <Field label="From">
              <input
                className="input"
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </Field>
            <Field label="To">
              <input
                className="input"
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="mt-3 text-sm text-ink-500">
          Showing <span className="font-semibold text-ink-800">{rangeLabel}</span>
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ['Total Revenue', currency(totals.revenue), 'text-emerald-600'],
          ['Total Expenses', currency(totals.expenses), 'text-amber-600'],
          ['Net Profit', currency(totals.profit), totals.profit < 0 ? 'text-red-600' : 'text-emerald-600'],
          ['Profit Margin', `${margin.toFixed(1)}%`, margin < 0 ? 'text-red-600' : 'text-brand-700'],
        ].map(([label, value, color]) => (
          <Card key={label} className="px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-6 p-5">
        <h3 className="mb-4 font-semibold text-ink-900">Profit trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7eaf3" />
            <XAxis dataKey="month" stroke="#9fabc9" fontSize={12} />
            <YAxis stroke="#9fabc9" fontSize={12} />
            <Tooltip formatter={(v: number) => currency(v)} />
            <Legend fontSize={11} />
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2559e4" strokeWidth={2} />
            <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f59e0b" strokeWidth={2} />
            <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mb-6 p-5">
        <h3 className="mb-4 font-semibold text-ink-900">Revenue by payment type</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7eaf3" />
            <XAxis dataKey="month" stroke="#9fabc9" fontSize={12} />
            <YAxis stroke="#9fabc9" fontSize={12} />
            <Tooltip formatter={(v: number) => currency(v)} />
            <Legend fontSize={11} />
            <Bar dataKey="CHECKUP_FEE" name="Checkup fees" stackId="a" fill="#0f766e" />
            <Bar dataKey="ADVANCE" name="Advances" stackId="a" fill="#1d45c9" />
            <Bar dataKey="SESSION_FEE" name="Session fees" stackId="a" fill="#3b76f0" />
            <Bar dataKey="INSTALLMENT" name="Installments" stackId="a" fill="#93bafc" />
            <Bar dataKey="VISIT_FEE" name="Visit fees" stackId="a" fill="#bfd6fe" />
            <Bar dataKey="REFUND" name="Refunds" stackId="a" fill="#be123c" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-3 font-semibold text-ink-900">
          Profit &amp; Loss statement
        </div>
        {rows.length === 0 ? (
          <EmptyState message="No data for this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Period</th>
                  <th className="px-5 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-5 py-3 text-right font-semibold">Expenses</th>
                  <th className="px-5 py-3 text-right font-semibold">Profit / Loss</th>
                  <th className="px-5 py-3 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.month} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3 font-medium text-ink-800">{r.month}</td>
                    <td className="px-5 py-3 text-right text-ink-700">{currency(r.revenue)}</td>
                    <td className="px-5 py-3 text-right text-ink-700">{currency(r.expenses)}</td>
                    <td
                      className={`px-5 py-3 text-right font-semibold ${
                        r.profit < 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {currency(r.profit)}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-500">
                      {r.revenue ? `${((r.profit / r.revenue) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-ink-50 font-bold">
                <tr>
                  <td className="px-5 py-3 text-ink-900">Total</td>
                  <td className="px-5 py-3 text-right text-ink-900">{currency(totals.revenue)}</td>
                  <td className="px-5 py-3 text-right text-ink-900">{currency(totals.expenses)}</td>
                  <td
                    className={`px-5 py-3 text-right ${
                      totals.profit < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {currency(totals.profit)}
                  </td>
                  <td className="px-5 py-3 text-right text-ink-600">{margin.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
