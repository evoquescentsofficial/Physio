import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Card, EmptyState, Field, PageHeader } from '../components/ui';
import { AuditLogEntry } from '../types';
import { ROLE_LABELS } from '../../../shared/roles';

const roleLabel = (role: string) => (ROLE_LABELS as Record<string, string>)[role] || role;

const ENTITY_TYPES = ['PATIENT', 'DIAGNOSIS', 'VISIT', 'ATTACHMENT', 'PAYMENT'] as const;
const ENTITY_LABELS: Record<string, string> = {
  PATIENT: 'Patients',
  DIAGNOSIS: 'Diagnoses',
  VISIT: 'Sessions',
  ATTACHMENT: 'Reports',
  PAYMENT: 'Payments',
};

const ACTION_DOT: Record<string, string> = {
  CREATE: 'bg-brand-500',
  UPDATE: 'bg-amber-500',
  DELETE: 'bg-red-500',
  APPROVE: 'bg-emerald-500',
  COLLECT: 'bg-teal-500',
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `Today, ${time}` : `${dateStr}, ${time}`;
}

/**
 * Who did what, admin-only — the accountability record once more than one member of staff
 * touches the system. Every create, edit and delete on a patient's clinical file, and every
 * payment collected, lands here with a name and a role attached.
 */
export default function ActivityLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/audit-log', { params: { entityType: entityType || undefined, from: from || undefined, to: to || undefined } })
      .then((r) => setEntries(r.data))
      .finally(() => setLoading(false));
  }, [entityType, from, to]);

  return (
    <div>
      <PageHeader title="Activity log" subtitle="Every clinical and payment record change, with who made it" />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="From">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Record type">
            <select className="input" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">All records</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENTITY_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {(from || to) && (
          <button
            className="mt-3 text-xs font-medium text-brand-600 hover:underline"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            Clear dates
          </button>
        )}
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">Working it out…</div>
        ) : entries.length === 0 ? (
          <EmptyState message="Nothing recorded in this range." />
        ) : (
          <div className="divide-y divide-ink-100">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_DOT[e.action] || 'bg-ink-300'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink-800">
                    {e.summary}
                    {e.patientId && (
                      <>
                        {' — '}
                        <Link to={`/patients/${e.patientId}`} className="text-brand-700 hover:underline">
                          view patient
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {e.userName} · {roleLabel(e.userRole)} · {timeAgo(e.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
