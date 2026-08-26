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
import { Doctor } from '../types';

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
};

export default function Doctors() {
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
