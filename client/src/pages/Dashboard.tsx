import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { Badge, Card, EmptyState, PageHeader, StatCard, currency } from '../components/ui';
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
}

const PIE_COLORS = ['#2559e4', '#5f97f8', '#93bafc', '#1d45c9', '#0f1c4d', '#bfd6fe', '#3b76f0'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<{ byCategory: any[] }>({ byCategory: [] });
  const [pl, setPl] = useState<any[]>([]);

  useEffect(() => {
    api.get('/reports/dashboard').then((r) => setData(r.data));
    api.get('/reports/revenue?months=6').then((r) => setRevenue(r.data));
    api.get('/reports/expenses-summary?months=6').then((r) => setExpenseSummary(r.data));
    api.get('/reports/profit-loss?months=6').then((r) => setPl(r.data.rows));
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Clinic performance at a glance" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Patients" value={data?.totalPatients ?? '—'} />
        <StatCard
          label="Revenue this month"
          value={data ? currency(data.monthRevenue) : '—'}
          accent="emerald"
        />
        <StatCard
          label="Expenses this month"
          value={data ? currency(data.monthExpenses) : '—'}
          accent="amber"
        />
        <StatCard
          label="Profit this month"
          value={data ? currency(data.monthProfit) : '—'}
          accent={data && data.monthProfit < 0 ? 'red' : 'emerald'}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active Packages" value={data?.activePackages ?? '—'} />
        <StatCard
          label="Outstanding Dues"
          value={data ? currency(data.outstandingDues) : '—'}
          accent="red"
        />
        <StatCard
          label="Overdue Pending Sessions"
          value={data?.overduePendingSessions ?? '—'}
          accent="amber"
          hint="Eligible to carry forward"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h3 className="mb-4 font-semibold text-ink-900">Revenue trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2559e4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2559e4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7eaf3" />
              <XAxis dataKey="month" stroke="#9fabc9" fontSize={12} />
              <YAxis stroke="#9fabc9" fontSize={12} />
              <Tooltip formatter={(v: number) => currency(v)} />
              <Area
                type="monotone"
                dataKey="total"
                name="Revenue"
                stroke="#2559e4"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold text-ink-900">Expenses by category</h3>
          {expenseSummary.byCategory.length === 0 ? (
            <EmptyState message="No expenses recorded yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expenseSummary.byCategory}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {expenseSummary.byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => currency(v)} />
                <Legend fontSize={11} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-semibold text-ink-900">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pl}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7eaf3" />
              <XAxis dataKey="month" stroke="#9fabc9" fontSize={12} />
              <YAxis stroke="#9fabc9" fontSize={12} />
              <Tooltip formatter={(v: number) => currency(v)} />
              <Legend fontSize={11} />
              <Bar dataKey="revenue" name="Revenue" fill="#2559e4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#93bafc" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-ink-900">Today's schedule</h3>
            <Link to="/sessions" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {!data?.todaysVisits?.length ? (
            <EmptyState message="No sessions scheduled today" />
          ) : (
            <div className="divide-y divide-ink-100">
              {data.todaysVisits.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-ink-900">{v.patient?.name}</div>
                    <div className="text-xs text-ink-400">
                      {v.sessionNumber ? `Session ${v.sessionNumber}` : v.type.replace(/_/g, ' ')} ·{' '}
                      {v.patient?.phone}
                    </div>
                  </div>
                  <Badge value={v.attendance} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
