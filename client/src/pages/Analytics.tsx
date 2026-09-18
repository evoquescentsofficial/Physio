import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { Card, EmptyState, PageHeader, currency, formatDate } from '../components/ui';

interface DiagnosisCount {
  title: string;
  count: number;
}
interface DoctorActivity {
  doctorId: string;
  name: string;
  sessions: number;
  billed: number;
  attendanceRate: number | null;
}
interface NewPatientBucket {
  month: string;
  count: number;
}
interface ReactivationRow {
  patient: { id: string; name: string; phone: string };
  lastVisit: string;
  daysSince: number;
}

/** Presets are expressed as "the last N days ending today"; 1 day means today only. */
const PRESETS: { key: string; label: string; days: number }[] = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 3 months', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
];

const BAR_COLORS = ['#2559e4', '#3b76f0', '#5b8ff5', '#93bafc', '#c7dafe', '#0f766e', '#0891b2', '#7c3aed'];

/**
 * The operational half of "how is the clinic doing", next to Reports & P/L's financial half:
 * what the caseload is made of, how full each doctor's diary is running, whether new patients
 * are coming in, and who has gone quiet and needs a call.
 */
export default function Analytics() {
  const [preset, setPreset] = useState('90');
  const [topDiagnoses, setTopDiagnoses] = useState<DiagnosisCount[]>([]);
  const [doctorActivity, setDoctorActivity] = useState<DoctorActivity[]>([]);
  const [newPatients, setNewPatients] = useState<NewPatientBucket[]>([]);
  const [reactivationDays, setReactivationDays] = useState(45);
  const [reactivation, setReactivation] = useState<ReactivationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const days = PRESETS.find((p) => p.key === preset)?.days ?? 90;
    return `days=${days}`;
  }, [preset]);

  const rangeLabel = PRESETS.find((p) => p.key === preset)?.label ?? '';

  useEffect(() => {
    setLoading(true);
    api
      .get(`/reports/analytics?${query}`)
      .then((r) => {
        setTopDiagnoses(r.data.topDiagnoses);
        setDoctorActivity(r.data.doctorActivity);
        setNewPatients(r.data.newPatients);
      })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    api.get('/reports/reactivation', { params: { days: reactivationDays } }).then((r) => {
      setReactivation(r.data);
    });
  }, [reactivationDays]);

  const totalNewPatients = newPatients.reduce((s, b) => s + b.count, 0);
  const busiestDoctor = doctorActivity[0];
  const topCondition = topDiagnoses[0];

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Caseload, doctor activity and patient retention — the clinic side of the numbers"
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
        </div>
        <div className="mt-3 text-sm text-ink-500">
          Showing <span className="font-semibold text-ink-800">{rangeLabel}</span>
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            New patients
          </div>
          <div className="mt-1 text-2xl font-bold text-brand-700">{totalNewPatients}</div>
          <div className="mt-1 text-xs text-ink-400">{rangeLabel.toLowerCase()}</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Busiest doctor
          </div>
          <div className="mt-1 truncate text-2xl font-bold text-ink-900">
            {busiestDoctor?.name || '—'}
          </div>
          <div className="mt-1 text-xs text-ink-400">
            {busiestDoctor ? `${busiestDoctor.sessions} sessions billed` : 'No sessions yet'}
          </div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Most common condition
          </div>
          <div className="mt-1 truncate text-2xl font-bold text-ink-900">
            {topCondition?.title || '—'}
          </div>
          <div className="mt-1 text-xs text-ink-400">
            {topCondition ? `${topCondition.count} assessments` : 'No assessments yet'}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-1 font-semibold text-ink-900">Most common conditions</h3>
          <p className="mb-4 text-xs text-ink-400">By assessments recorded, {rangeLabel.toLowerCase()}</p>
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-400">Working it out…</div>
          ) : topDiagnoses.length === 0 ? (
            <EmptyState message="No assessments recorded in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, topDiagnoses.length * 38)}>
              <BarChart data={topDiagnoses} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7eaf3" horizontal={false} />
                <XAxis type="number" stroke="#9fabc9" fontSize={12} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="title"
                  stroke="#9fabc9"
                  fontSize={12}
                  width={140}
                  tick={{ fill: '#4a5578' }}
                />
                <Tooltip formatter={(v: number) => [`${v} assessment${v === 1 ? '' : 's'}`, '']} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {topDiagnoses.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 font-semibold text-ink-900">New patients</h3>
          <p className="mb-4 text-xs text-ink-400">Registered, {rangeLabel.toLowerCase()}</p>
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-400">Working it out…</div>
          ) : totalNewPatients === 0 ? (
            <EmptyState message="No new patients registered in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={newPatients}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7eaf3" />
                <XAxis dataKey="month" stroke="#9fabc9" fontSize={12} />
                <YAxis stroke="#9fabc9" fontSize={12} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} patient${v === 1 ? '' : 's'}`, '']} />
                <Bar dataKey="count" name="New patients" fill="#2559e4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-3">
          <h3 className="font-semibold text-ink-900">Doctor activity</h3>
          <p className="text-xs text-ink-400">Sessions actually seen, {rangeLabel.toLowerCase()}</p>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">Working it out…</div>
        ) : doctorActivity.length === 0 ? (
          <EmptyState message="No sessions billed in this range" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Doctor</th>
                  <th className="px-5 py-3 text-right font-semibold">Sessions</th>
                  <th className="px-5 py-3 text-right font-semibold">Billed</th>
                  <th className="px-5 py-3 text-right font-semibold">Attendance rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {doctorActivity.map((d) => (
                  <tr key={d.doctorId} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3 font-medium text-ink-800">{d.name}</td>
                    <td className="px-5 py-3 text-right text-ink-700">{d.sessions}</td>
                    <td className="px-5 py-3 text-right text-ink-700">{currency(d.billed)}</td>
                    <td className="px-5 py-3 text-right">
                      {d.attendanceRate == null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <span
                          className={
                            d.attendanceRate >= 85
                              ? 'text-emerald-600'
                              : d.attendanceRate >= 65
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }
                        >
                          {d.attendanceRate}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
          <div>
            <h3 className="font-semibold text-ink-900">Needs a follow-up</h3>
            <p className="text-xs text-ink-400">
              Came before, nothing booked, and gone quiet for a while — worth a call
            </p>
          </div>
          <div className="flex gap-1.5">
            {[30, 45, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setReactivationDays(d)}
                className={
                  reactivationDays === d ? 'btn-primary !py-1 !text-xs' : 'btn-secondary !py-1 !text-xs'
                }
              >
                {d}+ days
              </button>
            ))}
          </div>
        </div>
        {reactivation.length === 0 ? (
          <EmptyState message="Nobody has gone quiet for this long — everyone is either booked or new." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Patient</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Last seen</th>
                  <th className="px-5 py-3 text-right font-semibold">Days since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {reactivation.map((r) => (
                  <tr key={r.patient.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3">
                      <Link
                        to={`/patients/${r.patient.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {r.patient.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{r.patient.phone}</td>
                    <td className="px-5 py-3 text-ink-600">{formatDate(r.lastVisit)}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`badge ${
                          r.daysSince >= 90
                            ? 'bg-red-100 text-red-700'
                            : r.daysSince >= 60
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-ink-100 text-ink-600'
                        }`}
                      >
                        {r.daysSince} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
