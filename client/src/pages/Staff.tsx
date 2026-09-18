import { FormEvent, useEffect, useState } from 'react';
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
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../../shared/roles';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'RECEPTIONIST' as (typeof ROLES)[number],
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-brand-100 text-brand-700',
  DOCTOR: 'bg-emerald-100 text-emerald-700',
  JUNIOR_DOCTOR: 'bg-amber-100 text-amber-700',
  RECEPTIONIST: 'bg-ink-100 text-ink-600',
};

/**
 * Who can sign in to the clinic's system, and as what. A staff account's role decides
 * everything else in the app — what they can see, what needs a senior's review, what they can
 * delete — so this is the one screen that has to exist before any of that matters.
 */
export default function Staff() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<User | null>(null);

  async function load() {
    const res = await api.get('/auth/users');
    setUsers(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/users', form);
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create this account.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: User) {
    await api.delete(`/auth/users/${u.id}`);
    setConfirming(null);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Who can sign in, and what their role lets them do"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + Add staff account
          </button>
        }
      />

      <Card className="mb-5 p-5">
        <h3 className="mb-3 font-semibold text-ink-900">Roles</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-xl border border-ink-100 p-3.5">
              <span className={`badge ${ROLE_BADGE[r]}`}>{ROLE_LABELS[r]}</span>
              <p className="mt-2 text-xs leading-snug text-ink-500">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {users.length === 0 ? (
          <EmptyState message="No staff accounts yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">Role</th>
                  <th className="th">Added</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      {u.name}
                      {u.id === me?.id && (
                        <span className="ml-1.5 text-xs font-normal text-ink-400">(you)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {u.createdAt ? formatDate(u.createdAt) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {u.id !== me?.id && (
                        <IconButton
                          icon="trash"
                          label={`Remove ${u.name}`}
                          tone="danger"
                          onClick={() => setConfirming(u)}
                        />
                      )}
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
        title={`Remove ${confirming?.name ?? ''}?`}
        message="They will no longer be able to sign in. Records they created stay on file, attributed to them."
        confirmLabel="Remove account"
        onCancel={() => setConfirming(null)}
        onConfirm={() => remove(confirming!)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add staff account"
        description="Give them the role that matches what they should be able to do."
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="Password" hint="At least 6 characters. They can change it once signed in.">
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
          </Field>
          <Field label="Role">
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
