import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { Card, EmptyState, currency } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Visit } from '../types';

interface DashboardData {
  totalPatients: number;
  activePackages: number;
  todaysVisits: Visit[];
  overduePendingSessions: number;
  monthRevenue: number;
  monthExpenses: number;
  monthProfit: number;
  outstandingDues: number;
  patientCredits: number;
}

/**
 * Categorical hues for expense categories, in fixed order. Validated for colour-blind
 * separation against the light surface — do not reorder or cycle; an eighth category
 * folds into the last slot rather than getting a generated hue.
 */
const CATEGORY_COLORS = [
  '#2559e4',
  '#be123c',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#65a30d',
  '#db2777',
];

const CATEGORY_LABELS: Record<string, string> = {
  SALARY: 'Salaries',
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  EQUIPMENT: 'Equipment',
  MARKETING: 'Marketing',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-100 bg-white/95 px-3 py-2 shadow-card backdrop-blur">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-ink-600">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-ink-900">
            {currency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Headline figure with its own accent bar; the number is the point, so it carries the weight. */
function Kpi({
  label,
  value,
  hint,
  tone = 'brand',
  icon,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'brand' | 'emerald' | 'amber' | 'red' | 'violet';
  icon: string;
  to?: string;
}) {
  const tones: Record<string, { bar: string; chip: string; text: string }> = {
    brand: { bar: 'bg-brand-600', chip: 'bg-brand-50 text-brand-700', text: 'text-ink-900' },
    emerald: {
      bar: 'bg-emerald-500',
      chip: 'bg-emerald-50 text-emerald-700',
      text: 'text-emerald-600',
    },
    amber: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', text: 'text-amber-600' },
    red: { bar: 'bg-red-500', chip: 'bg-red-50 text-red-700', text: 'text-red-600' },
    violet: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700', text: 'text-violet-700' },
  };
  const t = tones[tone];

  const body = (
    <div className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card">
      <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} />
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${t.chip}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
        <div className={`mt-1 truncate text-2xl font-bold tabular-nums ${t.text}`}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-400">{hint}</div>}
      </div>
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [data, setData] = useState<DashboardData | null>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<{ byCategory: any[] }>({ byCategory: [] });
  const [pl, setPl] = useState<any[]>([]);

  useEffect(() => {
    api.get('/reports/dashboard').then((r) => setData(r.data));
    api.get('/reports/revenue?days=30').then((r) => setRevenue(r.data));
    api.get('/reports/expenses-summary?days=180').then((r) => setExpenseSummary(r.data));
    api.get('/reports/profit-loss?days=180').then((r) => setPl(r.data.rows));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const todays = data?.todaysVisits || [];
  const seenToday = todays.filter((v) => v.attendance === 'PRESENT').length;
  const expenseTotal = expenseSummary.byCategory.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6">
      {/* Hero: who, when, and the one number that matters today */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-7 text-white sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-32 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-sm font-medium text-brand-200">
              {greeting}, {user?.name}
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{settings.clinicName}</h1>
            <div className="mt-2 text-sm text-brand-200">
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl bg-white/10 px-5 py-3 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                Booked today
              </div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums">{todays.length}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-3 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                Seen so far
              </div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums">{seenToday}</div>
            </div>
            <Link
              to="/patients"
              className="flex items-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50"
            >
              + New patient
            </Link>
          </div>
        </div>
      </div>

      {/* This month's money */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Revenue this month"
          value={data ? currency(data.monthRevenue) : '—'}
          tone="emerald"
          icon="₨"
          to="/payments"
        />
        <Kpi
          label="Expenses this month"
          value={data ? currency(data.monthExpenses) : '—'}
          tone="amber"
          icon="▤"
          to="/expenses"
        />
        <Kpi
          label="Profit this month"
          value={data ? currency(data.monthProfit) : '—'}
          tone={data && data.monthProfit < 0 ? 'red' : 'emerald'}
          hint={data && data.monthProfit < 0 ? 'Running at a loss' : 'In profit'}
          icon="◔"
          to="/reports"
        />
        <Kpi
          label="Outstanding dues"
          value={data ? currency(data.outstandingDues) : '—'}
          tone="red"
          hint={data?.patientCredits ? `${currency(data.patientCredits)} held as credit` : undefined}
          icon="!"
          to="/payments"
        />
      </div>

      {/* Practice health */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label="Total patients"
          value={data?.totalPatients ?? '—'}
          tone="brand"
          icon="☰"
          to="/patients"
        />
        <Kpi
          label="Active packages"
          value={data?.activePackages ?? '—'}
          tone="violet"
          icon="▦"
        />
        <Kpi
          label="Overdue sessions"
          value={data?.overduePendingSessions ?? '—'}
          tone={data?.overduePendingSessions ? 'amber' : 'brand'}
          hint="Missed or unmarked — can be carried forward"
          icon="↻"
          to="/sessions"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Revenue trend */}
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">Revenue</h3>
              <p className="text-xs text-ink-400">Daily collections over the last 30 days</p>
            </div>
            <Link to="/reports" className="text-sm font-medium text-brand-600 hover:underline">
              Full report →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2559e4" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2559e4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eef1f7" />
              <XAxis
                dataKey="month"
                stroke="#9fabc9"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                stroke="#9fabc9"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#bfd6fe', strokeWidth: 2 }} />
              <Area
                type="monotone"
                dataKey="total"
                name="Collected"
                stroke="#2559e4"
                strokeWidth={2}
                fill="url(#revFill)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Today's list */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <div>
              <h3 className="font-semibold text-ink-900">Today's schedule</h3>
              <p className="text-xs text-ink-400">
                {todays.length ? `${seenToday} of ${todays.length} seen` : 'Nothing booked'}
              </p>
            </div>
            <Link to="/sessions" className="text-sm font-medium text-brand-600 hover:underline">
              All
            </Link>
          </div>

          {!todays.length ? (
            <EmptyState message="No sessions scheduled for today" />
          ) : (
            <div className="max-h-[300px] divide-y divide-ink-100 overflow-y-auto">
              {todays.map((v) => {
                const done = v.attendance === 'PRESENT';
                const missed = v.attendance === 'ABSENT';
                return (
                  <Link
                    key={v.id}
                    to={`/patients/${v.patientId}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-50/50"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        done
                          ? 'bg-emerald-100 text-emerald-700'
                          : missed
                            ? 'bg-red-100 text-red-700'
                            : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {done ? '✓' : missed ? '✕' : v.patient?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink-900">
                        {v.patient?.name}
                      </div>
                      <div className="truncate text-xs text-ink-400">
                        {new Date(v.scheduledDate).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {v.sessionNumber ? `Session ${v.sessionNumber}` : v.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        done
                          ? 'bg-emerald-50 text-emerald-700'
                          : missed
                            ? 'bg-red-50 text-red-700'
                            : 'bg-ink-100 text-ink-500'
                      }`}
                    >
                      {done ? 'Seen' : missed ? 'Absent' : 'Waiting'}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Money in vs money out */}
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4">
            <h3 className="font-semibold text-ink-900">Money in vs money out</h3>
            <p className="text-xs text-ink-400">Last 6 months</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pl} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="#eef1f7" />
              <XAxis
                dataKey="month"
                stroke="#9fabc9"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#9fabc9"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f4f6fb' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#2559e4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#93bafc" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-5 text-xs text-ink-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-300" /> Expenses
            </span>
          </div>
        </Card>

        {/* Where the money goes */}
        <Card className="p-5">
          <div className="mb-2">
            <h3 className="font-semibold text-ink-900">Where the money goes</h3>
            <p className="text-xs text-ink-400">Expenses, last 6 months</p>
          </div>

          {expenseSummary.byCategory.length === 0 ? (
            <EmptyState message="No expenses recorded yet" />
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={expenseSummary.byCategory}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {expenseSummary.byCategory.map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    Total
                  </div>
                  <div className="text-lg font-bold tabular-nums text-ink-900">
                    {currency(expenseTotal)}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {expenseSummary.byCategory
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((c, i) => (
                    <div key={c.category} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{
                          background:
                            CATEGORY_COLORS[
                              expenseSummary.byCategory.findIndex(
                                (x) => x.category === c.category
                              ) % CATEGORY_COLORS.length
                            ],
                        }}
                      />
                      <span className="truncate text-ink-600">
                        {CATEGORY_LABELS[c.category] || c.category}
                      </span>
                      <span className="ml-auto shrink-0 font-medium tabular-nums text-ink-800">
                        {currency(c.total)}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-400">
                        {expenseTotal ? Math.round((c.total / expenseTotal) * 100) : 0}%
                      </span>
                      <span className="sr-only">{i}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
