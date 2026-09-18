import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import FormIcon from '../components/FormIcon';
import { Doctor, Visit } from '../types';
import { canCarryForward, holdsAPlace } from '../../../shared/sessions';
import { CarryModal } from './Sessions';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Matches the Badge color mapping in ui.tsx, as a small dot rather than a full pill —
// the grid has no room for a badge on every row of every day.
const ATTENDANCE_DOT: Record<string, string> = {
  SCHEDULED: 'bg-brand-500',
  PRESENT: 'bg-emerald-500',
  ABSENT: 'bg-red-500',
  CARRIED_FORWARD: 'bg-amber-500',
  CANCELLED: 'bg-ink-300',
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * The month laid out as a real calendar grid — the request that started this page was "where
 * is the calendar", after the clinic had spent a while working from the flat Sessions list.
 * That list stays for filtering and bulk attendance; this is for seeing the shape of the month
 * and jumping into a single day.
 */
export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [agendaDate, setAgendaDate] = useState<Date | null>(null);
  const [carryVisit, setCarryVisit] = useState<Visit | null>(null);

  // A month grid fills whole weeks, so it runs from the Sunday on/before the 1st to the
  // Saturday on/after the last day — the days from neighbouring months shown at each end are
  // real and clickable, just dimmed.
  const gridStart = useMemo(
    () => addDays(startOfMonth(cursor), -startOfMonth(cursor).getDay()),
    [cursor]
  );
  const gridEnd = useMemo(() => {
    const last = endOfMonth(cursor);
    return addDays(last, 6 - last.getDay());
  }, [cursor]);

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) list.push(new Date(d));
    return list;
  }, [gridStart, gridEnd]);

  const load = useCallback(async () => {
    const res = await api.get('/visits', {
      params: {
        from: toInputDate(gridStart),
        to: `${toInputDate(gridEnd)}T23:59:59`,
        doctorId: doctorId || undefined,
      },
    });
    setVisits(res.data);
  }, [gridStart, gridEnd, doctorId]);

  useEffect(() => {
    api.get('/doctors').then((r) => setDoctors(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = toInputDate(new Date());

  function visitsOn(d: Date) {
    const key = toInputDate(d);
    return visits
      .filter((v) => v.scheduledDate.slice(0, 10) === key)
      .sort((a, b) => (a.patient?.name || '').localeCompare(b.patient?.name || ''));
  }

  // Stats only count the month actually on screen, not the padding days from either side.
  const monthLive = visits.filter(
    (v) => new Date(v.scheduledDate).getMonth() === cursor.getMonth() && holdsAPlace(v)
  );
  const stats = {
    total: monthLive.length,
    present: monthLive.filter((v) => v.attendance === 'PRESENT').length,
    absent: monthLive.filter((v) => v.attendance === 'ABSENT').length,
    scheduled: monthLive.filter((v) => v.attendance === 'SCHEDULED').length,
  };

  async function mark(visit: Visit, status: string) {
    await api.post(`/visits/${visit.id}/attendance`, { status });
    load();
  }

  const agendaVisits = agendaDate ? visitsOn(agendaDate) : [];

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="The month at a glance — click a day for its full list"
        actions={
          <select
            className="input !w-auto"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ['This month', stats.total, 'text-ink-900'],
          ['Present', stats.present, 'text-emerald-600'],
          ['Absent', stats.absent, 'text-red-600'],
          ['Scheduled', stats.scheduled, 'text-brand-600'],
        ].map(([label, value, color]) => (
          <Card key={label as string} className="px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {label}
            </div>
            <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary !px-2.5"
              onClick={() => setCursor(addMonths(cursor, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button type="button" className="btn-secondary" onClick={() => setCursor(startOfMonth(new Date()))}>
              Today
            </button>
            <button
              type="button"
              className="btn-secondary !px-2.5"
              onClick={() => setCursor(addMonths(cursor, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="text-lg font-bold text-ink-900">
            {cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
            {(
              [
                ['SCHEDULED', 'Scheduled'],
                ['PRESENT', 'Present'],
                ['ABSENT', 'Absent'],
                ['CARRIED_FORWARD', 'Moved'],
              ] as const
            ).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${ATTENDANCE_DOT[key]}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-100 bg-ink-100">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="bg-ink-50 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500"
            >
              {w}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const dayVisits = visitsOn(d);
            const isToday = toInputDate(d) === today;
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setAgendaDate(d)}
                className={`flex min-h-[92px] flex-col items-stretch gap-1 bg-white p-2 text-left transition-colors hover:bg-brand-50/50 sm:min-h-[108px] ${
                  inMonth ? '' : 'bg-ink-50/40'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-brand-600 text-white'
                      : inMonth
                        ? 'text-ink-700'
                        : 'text-ink-300'
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className="space-y-0.5">
                  {dayVisits.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      className={`flex items-center gap-1.5 truncate text-[11px] ${
                        inMonth ? 'text-ink-700' : 'text-ink-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          ATTENDANCE_DOT[v.attendance] || 'bg-ink-300'
                        }`}
                      />
                      <span className="truncate">{v.patient?.name}</span>
                    </div>
                  ))}
                  {dayVisits.length > 3 && (
                    <div className="px-0.5 text-[11px] font-medium text-ink-400">
                      +{dayVisits.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Modal
        open={!!agendaDate}
        onClose={() => setAgendaDate(null)}
        title={agendaDate ? formatDate(agendaDate.toISOString()) : ''}
        description={
          agendaVisits.length
            ? `${agendaVisits.length} session${agendaVisits.length === 1 ? '' : 's'} booked`
            : 'Nothing booked this day'
        }
        icon={<FormIcon name="calendar" />}
        size="lg"
      >
        {agendaVisits.length === 0 ? (
          <EmptyState message="No sessions on this day." />
        ) : (
          <div className="space-y-2">
            {agendaVisits.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    to={`/patients/${v.patientId}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {v.patient?.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-500">
                    <span>{v.doctor?.name || 'Unassigned'}</span>
                    <span>·</span>
                    <span>
                      {v.package?.title || v.type.replace(/_/g, ' ')}
                      {v.sessionNumber ? ` #${v.sessionNumber}` : ''}
                    </span>
                    <span>·</span>
                    <span>
                      {currency(v.fee)}
                      {v.feeCollected && <span className="text-emerald-600"> ✓</span>}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Badge value={v.attendance} />
                  <button
                    type="button"
                    className="btn-ghost !py-1 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => mark(v, 'PRESENT')}
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !py-1 text-red-600 hover:bg-red-50"
                    onClick={() => mark(v, 'ABSENT')}
                  >
                    Absent
                  </button>
                  {canCarryForward(v) && (
                    <button
                      type="button"
                      className="btn-ghost !py-1"
                      onClick={() => setCarryVisit(v)}
                    >
                      Move date
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <CarryModal visit={carryVisit} onClose={() => setCarryVisit(null)} reload={load} />
    </div>
  );
}
