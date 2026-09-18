import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  SegmentedControl,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import FormIcon from '../components/FormIcon';
import { Doctor, Patient, Visit } from '../types';
import { canCarryForward, holdsAPlace } from '../../../shared/sessions';
import { useSettings } from '../context/SettingsContext';
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
function startOfWeek(d: Date) {
  return addDays(d, -d.getDay());
}

type ViewMode = 'month' | 'week';

/**
 * The month or week laid out as a real calendar grid — the request that started this page was
 * "where is the calendar", after the clinic had spent a while working from the flat Sessions
 * list. That list stays for filtering and bulk attendance; this is for seeing the shape of the
 * month, working a single week without opening anything, and booking straight onto a day.
 */
export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [agendaDate, setAgendaDate] = useState<Date | null>(null);
  const [carryVisit, setCarryVisit] = useState<Visit | null>(null);
  const [newSessionDate, setNewSessionDate] = useState<Date | null>(null);

  // A month grid fills whole weeks, so it runs from the Sunday on/before the 1st to the
  // Saturday on/after the last day — the days from neighbouring months shown at each end are
  // real and clickable, just dimmed. A week view is exactly those seven days.
  const rangeStart = useMemo(() => {
    if (viewMode === 'week') return startOfWeek(cursor);
    return addDays(startOfMonth(cursor), -startOfMonth(cursor).getDay());
  }, [cursor, viewMode]);
  const rangeEnd = useMemo(() => {
    if (viewMode === 'week') return addDays(rangeStart, 6);
    const last = endOfMonth(cursor);
    return addDays(last, 6 - last.getDay());
  }, [cursor, viewMode, rangeStart]);

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) list.push(new Date(d));
    return list;
  }, [rangeStart, rangeEnd]);

  const load = useCallback(async () => {
    const res = await api.get('/visits', {
      params: {
        from: toInputDate(rangeStart),
        to: `${toInputDate(rangeEnd)}T23:59:59`,
        doctorId: doctorId || undefined,
      },
    });
    setVisits(res.data);
  }, [rangeStart, rangeEnd, doctorId]);

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

  // Stats only count the period actually on screen — the padding days from neighbouring
  // months in month view are real days but not part of "this month".
  const periodStart = viewMode === 'week' ? rangeStart : startOfMonth(cursor);
  const periodEnd = viewMode === 'week' ? rangeEnd : endOfMonth(cursor);
  const inPeriod = visits.filter(
    (v) =>
      holdsAPlace(v) &&
      v.scheduledDate.slice(0, 10) >= toInputDate(periodStart) &&
      v.scheduledDate.slice(0, 10) <= toInputDate(periodEnd)
  );
  const stats = {
    total: inPeriod.length,
    present: inPeriod.filter((v) => v.attendance === 'PRESENT').length,
    absent: inPeriod.filter((v) => v.attendance === 'ABSENT').length,
    scheduled: inPeriod.filter((v) => v.attendance === 'SCHEDULED').length,
  };

  async function mark(visit: Visit, status: string) {
    await api.post(`/visits/${visit.id}/attendance`, { status });
    load();
  }

  function goPrev() {
    setCursor(viewMode === 'month' ? addMonths(cursor, -1) : addDays(cursor, -7));
  }
  function goNext() {
    setCursor(viewMode === 'month' ? addMonths(cursor, 1) : addDays(cursor, 7));
  }
  function goToday() {
    setCursor(viewMode === 'month' ? startOfMonth(new Date()) : new Date());
  }

  const agendaVisits = agendaDate ? visitsOn(agendaDate) : [];

  const periodLabel =
    viewMode === 'month'
      ? cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : (() => {
          const sameMonth = rangeStart.getMonth() === rangeEnd.getMonth();
          const startStr = rangeStart.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: sameMonth ? undefined : 'short',
          });
          const endStr = rangeEnd.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          return `${startStr} – ${endStr}`;
        })();

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={
          viewMode === 'month'
            ? 'The month at a glance — click a day for its full list'
            : 'One week, fully expanded — every session, right on the day'
        }
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { label: 'Month', value: 'month' },
                { label: 'Week', value: 'week' },
              ]}
            />
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
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          [viewMode === 'month' ? 'This month' : 'This week', stats.total, 'text-ink-900'],
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
              onClick={goPrev}
              aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
            >
              ‹
            </button>
            <button type="button" className="btn-secondary" onClick={goToday}>
              Today
            </button>
            <button
              type="button"
              className="btn-secondary !px-2.5"
              onClick={goNext}
              aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
            >
              ›
            </button>
          </div>
          <div className="text-lg font-bold text-ink-900">{periodLabel}</div>
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

        {viewMode === 'month' ? (
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
                <div
                  key={d.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => setAgendaDate(d)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAgendaDate(d);
                    }
                  }}
                  className={`flex min-h-[92px] cursor-pointer flex-col items-stretch gap-1 bg-white p-2 text-left transition-colors hover:bg-brand-50/50 sm:min-h-[108px] ${
                    inMonth ? '' : 'bg-ink-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
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
                    <button
                      type="button"
                      title="Book a session"
                      aria-label={`Book a session on ${formatDate(d.toISOString())}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewSessionDate(d);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-brand-100 hover:text-brand-700"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((d) => {
              const dayVisits = visitsOn(d);
              const isToday = toInputDate(d) === today;
              return (
                <div
                  key={d.toISOString()}
                  className={`flex flex-col rounded-xl border ${
                    isToday ? 'border-brand-300 bg-brand-50/30' : 'border-ink-100'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                        {WEEKDAYS[d.getDay()]}
                      </div>
                      <div
                        className={`text-sm font-bold ${isToday ? 'text-brand-700' : 'text-ink-900'}`}
                      >
                        {d.getDate()} {d.toLocaleDateString('en-GB', { month: 'short' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Book a session"
                      aria-label={`Book a session on ${formatDate(d.toISOString())}`}
                      onClick={() => setNewSessionDate(d)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-brand-100 hover:text-brand-700"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 space-y-1.5 p-2">
                    {dayVisits.length === 0 ? (
                      <div className="px-1 py-3 text-center text-[11px] text-ink-300">
                        No sessions
                      </div>
                    ) : (
                      dayVisits.map((v) => (
                        <div
                          key={v.id}
                          className="rounded-lg border border-ink-100 bg-white p-2 text-xs shadow-soft"
                        >
                          <Link
                            to={`/patients/${v.patientId}`}
                            className="block truncate font-semibold text-brand-700 hover:underline"
                          >
                            {v.patient?.name}
                          </Link>
                          <div className="mt-0.5 truncate text-[10.5px] text-ink-500">
                            {v.doctor?.name || 'Unassigned'} · {currency(v.fee)}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <Badge value={v.attendance} />
                            <div className="flex items-center gap-0.5">
                              <IconButton
                                icon="check"
                                label="Mark present"
                                className="!h-6 !w-6"
                                onClick={() => mark(v, 'PRESENT')}
                              />
                              <IconButton
                                icon="x"
                                label="Mark absent"
                                tone="danger"
                                className="!h-6 !w-6"
                                onClick={() => mark(v, 'ABSENT')}
                              />
                              {canCarryForward(v) && (
                                <IconButton
                                  icon="forward"
                                  label="Move date"
                                  className="!h-6 !w-6"
                                  onClick={() => setCarryVisit(v)}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className="btn-secondary !py-1.5 !text-xs"
            onClick={() => agendaDate && setNewSessionDate(agendaDate)}
          >
            + Book a session
          </button>
        </div>
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

      <NewSessionModal
        date={newSessionDate}
        onClose={() => setNewSessionDate(null)}
        onCreated={load}
      />
    </div>
  );
}

/**
 * Booking a session straight from the calendar, rather than from a patient's own page. The date
 * is already decided — it is whichever day was clicked — so this is really just "which patient,
 * which package (if any), which doctor" on top of a fixed day.
 */
function NewSessionModal({
  date,
  onClose,
  onCreated,
}: {
  date: Date | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [packageId, setPackageId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [type, setType] = useState<'SESSION' | 'INITIAL_CONSULT' | 'FOLLOWUP'>('SESSION');
  const [fee, setFee] = useState(settings.defaultSessionFee);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (date) api.get('/doctors').then((r) => setDoctors(r.data));
  }, [date]);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  // Reset to a clean slate each time a different day is clicked to book on.
  useEffect(() => {
    if (!date) return;
    setQuery('');
    setResults([]);
    setPatient(null);
    setPackageId('');
    setDoctorId('');
    setType('SESSION');
    setFee(settings.defaultSessionFee);
    setError('');
    setDropdownOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await api.get('/patients', { params: { q: query } });
      setResults(res.data);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function choosePatient(p: Patient) {
    const res = await api.get(`/patients/${p.id}`);
    setPatient(res.data);
    setQuery('');
    setResults([]);
    setDropdownOpen(false);
  }

  function choosePackage(id: string) {
    setPackageId(id);
    const pkg = patient?.packages?.find((p) => p.id === id);
    setFee(pkg ? pkg.feePerSession : settings.defaultSessionFee);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!patient || !date) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/visits', {
        patientId: patient.id,
        packageId: packageId || null,
        doctorId: doctorId || null,
        scheduledDate: toInputDate(date),
        type,
        fee: Number(fee),
        count: 1,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not book this session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!date}
      onClose={onClose}
      title="Book a session"
      description={date ? `On ${formatDate(date.toISOString())}` : undefined}
      icon={<FormIcon name="calendar" />}
      size="md"
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="Patient">
          {patient ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink-900">{patient.name}</div>
                <div className="truncate text-xs text-ink-500">{patient.phone}</div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                onClick={() => setPatient(null)}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative" ref={boxRef}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                  <FormIcon name="search" className="h-[15px] w-[15px]" />
                </span>
                <input
                  className="input pl-9"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Search by name or phone…"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              {dropdownOpen && query.trim() && (
                // In-flow rather than an absolute overlay: this modal is short with no patient
                // picked yet, and an overlay here gets clipped by the modal panel's own rounded-
                // corner overflow-hidden before it has anywhere below the fold to render into.
                <ul className="relative z-10 mt-1.5 max-h-56 w-full overflow-y-auto rounded-2xl border border-ink-100 bg-white py-1.5 shadow-card">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => choosePatient(p)}
                        className="mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-brand-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">
                            {p.name}
                          </span>
                          <span className="block text-xs text-ink-400">{p.phone}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {!searching && results.length === 0 && (
                    <li className="px-4 py-2 text-xs text-ink-400">No matching patients.</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </Field>

        {patient && (
          <>
            <Field label="Package">
              <select
                className="input"
                value={packageId}
                onChange={(e) => choosePackage(e.target.value)}
              >
                <option value="">Standalone visit</option>
                {patient.packages?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Doctor">
                <select
                  className="input"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                >
                  <option value="">Not assigned yet</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select
                  className="input"
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                >
                  <option value="SESSION">Session</option>
                  <option value="INITIAL_CONSULT">Initial consultation</option>
                  <option value="FOLLOWUP">Follow-up</option>
                </select>
              </Field>
            </div>
            <Field label="Fee">
              <input
                className="input"
                type="number"
                min={0}
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </Field>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Booking…' : 'Book session'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
