import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import { Visit } from '../types';

export default function Sessions() {
  const today = toInputDate(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [attendance, setAttendance] = useState('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [carryVisit, setCarryVisit] = useState<Visit | null>(null);

  const load = useCallback(async () => {
    const res = await api.get('/visits', {
      params: { from, to: to ? `${to}T23:59:59` : undefined, attendance: attendance || undefined },
    });
    setVisits(res.data);
  }, [from, to, attendance]);

  useEffect(() => {
    load();
  }, [load]);

  async function mark(visit: Visit, status: string) {
    await api.post(`/visits/${visit.id}/attendance`, { status });
    load();
  }

  const counts = {
    total: visits.length,
    present: visits.filter((v) => v.attendance === 'PRESENT').length,
    absent: visits.filter((v) => v.attendance === 'ABSENT').length,
    scheduled: visits.filter((v) => v.attendance === 'SCHEDULED').length,
  };

  function quickRange(kind: 'today' | 'week' | 'month' | 'overdue') {
    const now = new Date();
    if (kind === 'today') {
      setFrom(toInputDate(now));
      setTo(toInputDate(now));
      setAttendance('');
    } else if (kind === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setFrom(toInputDate(start));
      setTo(toInputDate(end));
      setAttendance('');
    } else if (kind === 'month') {
      setFrom(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      setAttendance('');
    } else {
      const start = new Date(now);
      start.setFullYear(now.getFullYear() - 2);
      setFrom(toInputDate(start));
      setTo(toInputDate(new Date(now.getTime() - 86400000)));
      setAttendance('SCHEDULED');
    }
  }

  return (
    <div>
      <PageHeader title="Sessions & Attendance" subtitle="Mark daily attendance and carry forward pending sessions" />

      <Card className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {(['today', 'week', 'month', 'overdue'] as const).map((k) => (
            <button key={k} className="btn-secondary !py-1 capitalize" onClick={() => quickRange(k)}>
              {k === 'overdue' ? 'Overdue pending' : k}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="From">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Attendance">
            <select
              className="input"
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
            >
              <option value="">All</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="CARRIED_FORWARD">Carried forward</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </Field>
        </div>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ['Total', counts.total, 'text-ink-900'],
          ['Present', counts.present, 'text-emerald-600'],
          ['Absent', counts.absent, 'text-red-600'],
          ['Scheduled', counts.scheduled, 'text-brand-600'],
        ].map(([label, value, color]) => (
          <Card key={label as string} className="px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
            <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {visits.length === 0 ? (
          <EmptyState message="No sessions in this range" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Patient</th>
                  <th className="px-5 py-3 font-semibold">Package</th>
                  <th className="px-5 py-3 font-semibold">Session</th>
                  <th className="px-5 py-3 font-semibold">Fee</th>
                  <th className="px-5 py-3 font-semibold">Attendance</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3 text-ink-700">{formatDate(v.scheduledDate)}</td>
                    <td className="px-5 py-3">
                      <Link
                        to={`/patients/${v.patientId}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {v.patient?.name}
                      </Link>
                      <div className="text-xs text-ink-400">{v.patient?.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{v.package?.title || '—'}</td>
                    <td className="px-5 py-3 text-ink-600">
                      {v.sessionNumber ? `#${v.sessionNumber}` : v.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {currency(v.fee)}
                      {v.feeCollected && <span className="ml-1 text-xs text-emerald-600">✓</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge value={v.attendance} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <button
                        className="btn-ghost !py-1 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => mark(v, 'PRESENT')}
                      >
                        Present
                      </button>
                      <button
                        className="btn-ghost !py-1 text-red-600 hover:bg-red-50"
                        onClick={() => mark(v, 'ABSENT')}
                      >
                        Absent
                      </button>
                      <button className="btn-ghost !py-1" onClick={() => setCarryVisit(v)}>
                        Carry fwd
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CarryModal visit={carryVisit} onClose={() => setCarryVisit(null)} reload={load} />
    </div>
  );
}

function CarryModal({
  visit,
  onClose,
  reload,
}: {
  visit: Visit | null;
  onClose: () => void;
  reload: () => void;
}) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  const [newDate, setNewDate] = useState(toInputDate(nextMonth));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!visit) return;
    await api.post(`/visits/${visit.id}/carry-forward`, { newDate });
    onClose();
    reload();
  }

  return (
    <Modal open={!!visit} onClose={onClose} title="Carry Forward Session">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-ink-600">
          {visit?.patient?.name}'s session from {formatDate(visit?.scheduledDate)} will be marked
          carried forward and rescheduled.
        </p>
        <Field label="New date">
          <input
            className="input"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Carry Forward
          </button>
        </div>
      </form>
    </Modal>
  );
}
