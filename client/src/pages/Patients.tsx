import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FormSection,
  IconButton,
  Modal,
  ModalActions,
  PageHeader,
  SegmentedControl,
  formatDate,
  toInputDate,
} from '../components/ui';
import FormIcon from '../components/FormIcon';
import { Patient } from '../types';

/** First letters of up to two words, for the avatar shown while adding or editing a patient. */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

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
  attendantName: '',
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
      attendantName: p.attendantName || '',
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

  /**
   * True when this row is in the results because of the attendant rather than the patient —
   * worth showing, otherwise a search for "Raza Ahmed" returns a list of other people's names.
   */
  function matchedOnAttendant(p: Patient) {
    const needle = q.trim().toLowerCase();
    if (!needle || !p.attendantName) return false;
    if (p.name.toLowerCase().includes(needle)) return false;
    return p.attendantName.toLowerCase().includes(needle);
  }

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={
          q.trim()
            ? `${patients.length} match${patients.length === 1 ? '' : 'es'} for “${q.trim()}”`
            : `${patients.length} patient${patients.length === 1 ? '' : 's'} registered`
        }
        actions={
          <button className="btn-primary" onClick={openNew}>
            + Add Patient
          </button>
        }
      />

      <Card className="mb-4 p-4">
        <input
          className="input"
          placeholder="Search by patient name, attendant, phone or email…"
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
              <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">Email</th>
                  <th className="th">Registered</th>
                  <th className="th">Sessions</th>
                  <th className="th text-right">Actions</th>
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
                      {matchedOnAttendant(p) && (
                        // Say why a patient nobody searched for by name is in the results.
                        <div className="text-xs text-ink-500">with {p.attendantName}</div>
                      )}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit patient' : 'Add patient'}
        description={
          editing
            ? `Updating ${editing.name}'s record`
            : 'Just a name and phone number to start — everything else can be filled in later.'
        }
        icon={<FormIcon name="person" />}
        size="lg"
      >
        <form onSubmit={save} className="space-y-5">
          <FormSection icon={<FormIcon name="person" />} title="Identity" tone="brand">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-soft">
                {initialsOf(form.name)}
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Ahmed Raza"
                    required
                    autoFocus
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="03XX-XXXXXXX"
                    required
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4">
              <Field
                label="Attendant name (optional)"
                hint="Whoever brings the patient in — a family member, a carer, a driver. Searching finds the patient by this name too."
              >
                <input
                  className="input"
                  value={form.attendantName}
                  onChange={(e) => setForm({ ...form, attendantName: e.target.value })}
                  placeholder="Leave blank if they come alone"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={<FormIcon name="phone" />} title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Address">
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={<FormIcon name="calendar" />} title="Personal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth">
                <input
                  className="input"
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </Field>
              <Field label="Blood group">
                <input
                  className="input"
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  placeholder="e.g. O+"
                />
              </Field>
              <Field label="Gender">
                <SegmentedControl
                  value={form.gender}
                  onChange={(gender) => setForm({ ...form, gender })}
                  options={[
                    { label: 'Male', value: 'Male' },
                    { label: 'Female', value: 'Female' },
                    { label: 'Other', value: 'Other' },
                  ]}
                />
              </Field>
              <Field label="Occupation">
                <input
                  className="input"
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={<FormIcon name="heart" />} title="Care & referral">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Emergency contact">
                <input
                  className="input"
                  value={form.emergencyContact}
                  onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                />
              </Field>
              <Field label="Referred by">
                <input
                  className="input"
                  value={form.referredBy}
                  onChange={(e) => setForm({ ...form, referredBy: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={<FormIcon name="note" />} title="Notes">
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Anything else worth knowing about this patient"
            />
          </FormSection>

          <ModalActions>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update patient' : 'Add patient'}
            </button>
          </ModalActions>
        </form>
      </Modal>
    </div>
  );
}
