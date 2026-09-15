import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import { Doctor, DoctorEarnings, EmploymentType } from '../types';
import { useSettings } from '../context/SettingsContext';
import DoctorEarningsPanel from '../components/DoctorEarningsPanel';
import {
  DEFAULT_DEPARTMENTS,
  EMPLOYMENT_TYPES,
  settlementLabel,
} from '../../../shared/commission';
import { salaryPeriod, monthLabel } from '../../../shared/commission';

/** "Dr. Sana Aslam" should read as S, not D — the title is not the person's initial. */
function initialOf(name: string) {
  return (name.replace(/^\s*(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s+/i, '').trim() || name)
    .charAt(0)
    .toUpperCase();
}

const emptyForm = {
  name: '',
  specialization: '',
  qualification: '',
  phone: '',
  email: '',
  consultationFee: '',
  joinedDate: toInputDate(new Date()),
  active: true,
  notes: '',
  credentials: '',
  onLetterhead: false,
  departments: [] as string[],
  employmentType: 'SALARIED' as EmploymentType,
  monthlySalary: '',
  commissionPercent: '',
};

export default function Doctors() {
  const { settings } = useSettings();
  const departmentOptions = settings.departmentOptions?.length
    ? settings.departmentOptions
    : DEFAULT_DEPARTMENTS;
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showInactive, setShowInactive] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Doctor | null>(null);

  const load = useCallback(async () => {
    const res = await api.get('/doctors', { params: { includeInactive: showInactive } });
    setDoctors(res.data);
  }, [showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(d: Doctor) {
    setEditing(d);
    setForm({
      name: d.name,
      specialization: d.specialization || '',
      qualification: d.qualification || '',
      phone: d.phone || '',
      email: d.email || '',
      consultationFee: d.consultationFee != null ? String(d.consultationFee) : '',
      joinedDate: toInputDate(d.joinedDate),
      active: d.active,
      notes: d.notes || '',
      credentials: d.credentials || '',
      onLetterhead: !!d.onLetterhead,
      departments: d.departments || [],
      employmentType: (d.employmentType || 'SALARIED') as EmploymentType,
      monthlySalary: d.monthlySalary != null ? String(d.monthlySalary) : '',
      commissionPercent: d.commissionPercent != null ? String(d.commissionPercent) : '',
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        // Fee is optional — an empty box means "not set", not zero.
        consultationFee: form.consultationFee === '' ? null : Number(form.consultationFee),
        joinedDate: form.joinedDate || null,
        // Only the arrangement in force carries a figure, so the other cannot go stale.
        monthlySalary:
          form.employmentType === 'SALARIED' && form.monthlySalary !== ''
            ? Number(form.monthlySalary)
            : null,
        commissionPercent:
          form.employmentType === 'COMMISSION' && form.commissionPercent !== ''
            ? Number(form.commissionPercent)
            : null,
      };
      if (editing) await api.put(`/doctors/${editing.id}`, payload);
      else await api.post('/doctors', payload);
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(d: Doctor) {
    await api.put(`/doctors/${d.id}`, { active: !d.active });
    load();
  }

  async function remove(d: Doctor) {
    await api.delete(`/doctors/${d.id}`);
    setConfirming(null);
    load();
  }

  const activeCount = doctors.filter((d) => d.active).length;
  const sessionsThisMonth = doctors.reduce((s, d) => s + (d.sessionsThisMonth || 0), 0);

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle="Physiotherapists and consultants working at the clinic"
        actions={
          <button className="btn-primary" onClick={openNew}>
            + Add Doctor
          </button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Working doctors
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{activeCount}</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Sessions this month
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-brand-700">
            {sessionsThisMonth}
          </div>
        </Card>
        <Card className="flex items-center px-5 py-4">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show doctors who have left
          </label>
        </Card>
      </div>

      <DoctorEarningsPanel onPaid={load} />

      {doctors.length === 0 ? (
        <Card>
          <EmptyState message="No doctors added yet. Add your team to start assigning sessions." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {doctors.map((d) => (
            <Card
              key={d.id}
              className={`flex flex-col p-5 ${d.active ? '' : 'opacity-70'}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${
                    d.active ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-400'
                  }`}
                >
                  {initialOf(d.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-ink-900">{d.name}</h3>
                    {!d.active && (
                      <span className="badge bg-ink-200 text-ink-600">Left</span>
                    )}
                  </div>
                  <div className="truncate text-sm text-ink-500">
                    {d.specialization || 'Physiotherapist'}
                  </div>
                  {d.qualification && (
                    <div className="truncate text-xs text-ink-400">{d.qualification}</div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span
                      className={`badge ${
                        d.employmentType === 'COMMISSION'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {d.employmentType === 'COMMISSION'
                        ? `${d.commissionPercent ?? 0}% commission`
                        : d.monthlySalary
                          ? `${currency(d.monthlySalary)} / month`
                          : 'Salaried'}
                    </span>
                    {(d.departments || []).map((dep) => (
                      <span key={dep} className="badge bg-ink-100 text-ink-600">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Phone
                  </dt>
                  <dd className="text-ink-700">{d.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Consultation fee
                  </dt>
                  <dd className="text-ink-700">
                    {d.consultationFee != null ? currency(d.consultationFee) : 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Joined
                  </dt>
                  <dd className="text-ink-700">{formatDate(d.joinedDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Email
                  </dt>
                  <dd className="truncate text-ink-700">{d.email || '—'}</dd>
                </div>
              </dl>

              <div className="mt-4 flex gap-3">
                <div className="flex-1 rounded-lg bg-brand-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                    This month
                  </div>
                  <div className="text-lg font-bold tabular-nums text-ink-900">
                    {d.sessionsThisMonth ?? 0}
                    <span className="ml-1 text-xs font-normal text-ink-400">sessions</span>
                  </div>
                </div>
                <div className="flex-1 rounded-lg bg-emerald-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Completed
                  </div>
                  <div className="text-lg font-bold tabular-nums text-ink-900">
                    {d.sessionsCompleted ?? 0}
                    <span className="ml-1 text-xs font-normal text-ink-400">all time</span>
                  </div>
                </div>
              </div>

              {d.notes && <p className="mt-3 text-xs text-ink-500">{d.notes}</p>}

              <div className="mt-4 flex flex-wrap justify-end gap-1 border-t border-ink-100 pt-3">
                <button className="btn-ghost !py-1" onClick={() => toggleActive(d)}>
                  {d.active ? 'Mark as left' : 'Reactivate'}
                </button>
                <IconButton icon="edit" label={`Edit ${d.name}`} onClick={() => openEdit(d)} />
                <IconButton
                  icon="trash"
                  label={`Remove ${d.name}`}
                  tone="danger"
                  onClick={() => setConfirming(d)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        title={`Remove ${confirming?.name ?? ''}?`}
        message={
          <>
            If they have treated patients they are marked as having left instead of being
            deleted, so past sessions keep their name. They can be reactivated at any time.
          </>
        }
        confirmLabel="Remove doctor"
        onCancel={() => setConfirming(null)}
        onConfirm={() => remove(confirming!)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Doctor' : 'Add Doctor'}
        wide
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dr. Imran Shah"
              required
            />
          </Field>
          <Field label="Specialization">
            <input
              className="input"
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="Sports injury / Orthopaedic physio"
            />
          </Field>
          <Field label="Qualification">
            <input
              className="input"
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              placeholder="DPT, MSPT"
            />
          </Field>
          <Field label="Phone">
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Consultation fee (optional)">
            <input
              className="input"
              type="number"
              min={0}
              value={form.consultationFee}
              onChange={(e) => setForm({ ...form, consultationFee: e.target.value })}
              placeholder="Leave blank if not charged separately"
            />
          </Field>
          <Field label="Joined on">
            <input
              className="input"
              type="date"
              value={form.joinedDate}
              onChange={(e) => setForm({ ...form, joinedDate: e.target.value })}
            />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 text-sm font-medium text-ink-800">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Currently working here
            </label>
          </div>
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Working days, shift timings, salary arrangement…"
            />
          </Field>

          {/* Departments */}
          <div className="sm:col-span-2">
            <label className="label">Departments</label>
            <div className="flex flex-wrap gap-2">
              {departmentOptions.map((dep) => {
                const on = form.departments.includes(dep);
                return (
                  <button
                    key={dep}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        departments: on
                          ? form.departments.filter((x) => x !== dep)
                          : [...form.departments, dep],
                      })
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      on
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                    }`}
                  >
                    {dep}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              A doctor can work in more than one. The list is editable in Settings.
            </p>
          </div>

          {/* How they are paid */}
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 sm:col-span-2">
            <label className="label">How is this doctor paid?</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {EMPLOYMENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, employmentType: t })}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    form.employmentType === t
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-ink-200 bg-white text-ink-600 hover:bg-white/60'
                  }`}
                >
                  <span className="block font-semibold">
                    {t === 'SALARIED' ? 'On salary' : 'On commission'}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {t === 'SALARIED'
                      ? 'A fixed amount every month, posted to expenses'
                      : 'Keeps a share of what their sessions bill'}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3">
              {form.employmentType === 'SALARIED' ? (
                <Field
                  label="Monthly salary"
                  hint="Posted to expenses each month from the Doctors page, so the P&L includes it without anyone retyping it."
                >
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.monthlySalary}
                    onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                    placeholder="e.g. 60000"
                  />
                </Field>
              ) : (
                <Field
                  label="The doctor's share (%)"
                  hint={
                    form.commissionPercent
                      ? `They keep ${form.commissionPercent}% of what their sessions bill; the clinic keeps ${
                          100 - Number(form.commissionPercent || 0)
                        }%.`
                      : 'For a 70/30 split in the doctor’s favour, enter 70.'
                  }
                >
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={form.commissionPercent}
                    onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                    placeholder="e.g. 70"
                  />
                </Field>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <input
                type="checkbox"
                checked={form.onLetterhead}
                onChange={(e) => setForm({ ...form, onLetterhead: e.target.checked })}
              />
              Show this doctor on the printed prescription
            </label>
            <Field
              label="Credentials, one per line"
              className="mt-3"
              hint="Printed under the doctor's name at the top of the prescription, exactly as typed."
            >
              <textarea
                className="input font-mono !text-xs"
                rows={4}
                value={form.credentials}
                onChange={(e) => setForm({ ...form, credentials: e.target.value })}
                placeholder={'DPT (MMDC / UHS)\nMS-OMPT (RIU)\nCertified in Dry Needling & Injection Therapy\nClinical Physiotherapist at Bakhtawar Amin Teaching Hospital'}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update doctor' : 'Add doctor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
