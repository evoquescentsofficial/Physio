import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  formatDate,
  toInputDate,
} from '../components/ui';
import { Patient } from '../types';

const empty = {
  name: '',
  phone: '',
  email: '',
  address: '',
  dob: '',
  gender: '',
  occupation: '',
  referredBy: '',
  bloodGroup: '',
  emergencyContact: '',
  notes: '',
};

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Patient | null>(null);

  async function load() {
    const res = await api.get('/patients', { params: { q } });
    setPatients(res.data);
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(p: Patient) {
    setEditing(p);
    setForm({
      name: p.name,
      phone: p.phone,
      email: p.email || '',
      address: p.address || '',
      dob: toInputDate(p.dob),
      gender: p.gender || '',
      occupation: p.occupation || '',
      referredBy: p.referredBy || '',
      bloodGroup: p.bloodGroup || '',
      emergencyContact: p.emergencyContact || '',
      notes: p.notes || '',
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, dob: form.dob || null };
      if (editing) await api.put(`/patients/${editing.id}`, payload);
      else await api.post('/patients', payload);
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Patient) {
    await api.delete(`/patients/${p.id}`);
    setConfirming(null);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={`${patients.length} patient${patients.length === 1 ? '' : 's'} registered`}
        actions={
          <button className="btn-primary" onClick={openNew}>
            + Add Patient
          </button>
        }
      />

      <Card className="mb-4 p-4">
        <input
          className="input"
          placeholder="Search by name, phone or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Card>

      <Card className="overflow-hidden">
        {patients.length === 0 ? (
          <EmptyState message="No patients found. Add your first patient to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Registered</th>
                  <th className="px-5 py-3 font-semibold">Sessions</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3">
                      <Link
                        to={`/patients/${p.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.gender && <div className="text-xs text-ink-400">{p.gender}</div>}
                    </td>
                    <td className="px-5 py-3 text-ink-600">{p.phone}</td>
                    <td className="px-5 py-3 text-ink-600">{p.email || '—'}</td>
                    <td className="px-5 py-3 text-ink-600">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-3 text-ink-600">{p._count?.visits ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <IconButton icon="edit" label={`Edit ${p.name}`} onClick={() => openEdit(p)} />
                        <IconButton
                          icon="trash"
                          label={`Delete ${p.name}`}
                          tone="danger"
                          onClick={() => setConfirming(p)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirming}
        title={`Delete ${confirming?.name ?? ''}?`}
        message={
          <>
            This permanently removes their diagnoses, sessions and payment history. Money already
            recorded against them will disappear from your reports. This cannot be undone.
          </>
        }
        confirmLabel="Delete patient"
        onCancel={() => setConfirming(null)}
        onConfirm={() => remove(confirming!)}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Patient' : 'Add Patient'} wide>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
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
          <Field label="Date of birth">
            <input
              className="input"
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </Field>
          <Field label="Gender">
            <select
              className="input"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Blood group">
            <input
              className="input"
              value={form.bloodGroup}
              onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
            />
          </Field>
          <Field label="Occupation">
            <input
              className="input"
              value={form.occupation}
              onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            />
          </Field>
          <Field label="Referred by">
            <input
              className="input"
              value={form.referredBy}
              onChange={(e) => setForm({ ...form, referredBy: e.target.value })}
            />
          </Field>
          <Field label="Emergency contact">
            <input
              className="input"
              value={form.emergencyContact}
              onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update Patient' : 'Add Patient'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
