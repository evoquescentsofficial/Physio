import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  StatCard,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import {
  Diagnosis,
  Doctor,
  Installment,
  Patient,
  Payment,
  TreatmentPackage,
  Visit,
} from '../types';
import { useSettings } from '../context/SettingsContext';
import PrescriptionForm from '../components/PrescriptionForm';
import { ConditionTemplate } from '../../../shared/conditions';
import {
  accountPosition,
  installmentStatus,
  netAmount,
  sumPayments,
} from '../../../shared/money';
import {
  inferFrequencyDays,
  lastScheduledDate,
  nextSessionDate,
} from '../../../shared/scheduling';
import {
  BillingCycle,
  CYCLE_LABELS,
  cycleNoun,
  dueLabel,
  frequencyForCycle,
  installmentLabel,
  isRecurring,
  ordinal,
  nextDue,
  planCycles,
  planSummary,
} from '../../../shared/packages';

type Tab = 'overview' | 'diagnoses' | 'packages' | 'sessions' | 'payments';

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'diagnoses', label: 'Diagnoses' },
  { key: 'packages', label: 'Packages & Installments' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'payments', label: 'Payments & Advances' },
];

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = useCallback(async () => {
    const res = await api.get(`/patients/${id}`);
    setPatient(res.data);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!patient) return <div className="text-ink-400">Loading…</div>;

  const payments = patient.payments || [];
  const totalPaid = sumPayments(payments);
  // Same helper the API uses, so the patient header and the outstanding-dues report
  // can never disagree about what this person owes.
  const { packageValue, due: balanceDue, credit: creditBalance } = accountPosition(
    patient.packages || [],
    payments
  );
  const sessionsDone = (patient.visits || []).filter((v) => v.attendance === 'PRESENT').length;
  const sessionsPending = (patient.visits || []).filter((v) => v.attendance === 'SCHEDULED').length;

  return (
    <div>
      <Link to="/patients" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← Back to patients
      </Link>

      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-700 to-brand-900 px-6 py-6 text-white">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{patient.name}</h1>
              <div className="text-sm text-brand-200">
                {patient.phone}
                {patient.email ? ` · ${patient.email}` : ''}
                {patient.gender ? ` · ${patient.gender}` : ''}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-ink-100 sm:grid-cols-4">
          {[
            ['Package Value', currency(packageValue), ''],
            ['Total Paid', currency(totalPaid), ''],
            creditBalance > 0
              ? ['Credit Balance', currency(creditBalance), 'text-emerald-600']
              : ['Balance Due', currency(balanceDue), balanceDue > 0 ? 'text-red-600' : ''],
            ['Sessions', `${sessionsDone} done · ${sessionsPending} pending`, ''],
          ].map(([label, value, tone]) => (
            <div key={label} className="bg-white px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {label}
              </div>
              <div className={`mt-1 font-bold ${tone || 'text-ink-900'}`}>{value}</div>
            </div>
          ))}
        </div>
        {creditBalance > 0 && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
            This patient has paid <strong>{currency(creditBalance)}</strong> more than they have
            been charged. It stays on their account and is taken off their next package
            automatically.
          </div>
        )}
      </Card>

      <CheckupFeeBanner patient={patient} reload={load} />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-ink-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview patient={patient} />}
      {tab === 'diagnoses' && <Diagnoses patient={patient} reload={load} />}
      {tab === 'packages' && <Packages patient={patient} reload={load} />}
      {tab === 'sessions' && <Sessions patient={patient} reload={load} />}
      {tab === 'payments' && <Payments patient={patient} reload={load} />}
    </div>
  );
}

/**
 * First-visit checkup fee is a separate charge from session/package fees, so it gets a prompt
 * that disappears once the fee has been recorded for this patient.
 *
 * One button, not two. There used to be a "Record Rs 1,000" that took the money the instant it
 * was clicked, with no dialog and nothing to confirm — which reads as a broken button rather
 * than a decisive one. Now it opens the dialog, already filled in with the standard fee, so a
 * full-price visit is still two clicks and a discounted one is possible from the same place.
 */
function CheckupFeeBanner({ patient, reload }: { patient: Patient; reload: () => void }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const alreadyPaid = (patient.payments || []).some((p) => p.type === 'CHECKUP_FEE');

  if (alreadyPaid) return null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4">
        <div>
          <div className="font-semibold text-teal-900">Checkup fee not recorded</div>
          <div className="text-sm text-teal-700">
            Charge the first-visit checkup fee of {currency(settings.checkupFee)} before starting a
            treatment package.
          </div>
        </div>
        <button
          className="btn-primary !bg-teal-600 hover:!bg-teal-700"
          onClick={() => setOpen(true)}
        >
          Record payment
        </button>
      </div>

      {open && (
        <ChargeFeeModal
          patient={patient}
          standardFee={settings.checkupFee}
          onClose={() => setOpen(false)}
          reload={reload}
        />
      )}
    </>
  );
}

/**
 * Charging something other than the list price: a family rate, a concession for someone who
 * can't pay in full, or a waived visit. What was actually collected is stored as the amount
 * and what was given up as the discount, so a free visit still appears in the patient's
 * history and the giveaway stays visible rather than vanishing.
 */
function ChargeFeeModal({
  patient,
  standardFee,
  onClose,
  reload,
}: {
  patient: Patient;
  standardFee: number;
  onClose: () => void;
  reload: () => void;
}) {
  const [amount, setAmount] = useState<number>(standardFee);
  const [method, setMethod] = useState('CASH');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const charged = Math.max(0, Math.min(amount || 0, standardFee));
  const discount = Math.max(standardFee - charged, 0);
  const percentOff = standardFee > 0 ? Math.round((discount / standardFee) * 100) : 0;

  const presets = [
    { label: 'Full fee', value: standardFee },
    { label: '25% off', value: Math.round(standardFee * 0.75) },
    { label: '50% off', value: Math.round(standardFee * 0.5) },
    { label: 'Free', value: 0 },
  ];

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/payments', {
        patientId: patient.id,
        amount: charged,
        discount,
        type: 'CHECKUP_FEE',
        method,
        notes:
          reason.trim() ||
          (discount === standardFee
            ? 'Checkup fee waived'
            : discount > 0
              ? 'Checkup fee, discounted'
              : 'First visit checkup fee'),
      });
      onClose();
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Record checkup fee">
      <form onSubmit={save} className="space-y-4">
        <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
          Standard checkup fee is{' '}
          <span className="font-semibold text-ink-900">{currency(standardFee)}</span>. Charge less
          for family, friends or a patient who cannot pay in full.
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setAmount(p.value)}
              className={charged === p.value ? 'btn-primary !py-1' : 'btn-secondary !py-1'}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Field label="Amount to charge">
          <input
            className="input"
            type="number"
            min={0}
            max={standardFee}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            autoFocus
            required
          />
        </Field>

        <Field label="Paid by">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">Mobile wallet</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>

        <Field label="Reason (optional)">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Family · Friend of the clinic · Cannot afford full fee"
          />
        </Field>

        <div className="rounded-lg border border-brand-100 bg-ink-50 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-ink-600">Standard fee</span>
            <span className="font-semibold text-ink-900">{currency(standardFee)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-600">Discount</span>
            <span className="font-semibold text-emerald-600">
              − {currency(discount)}
              {discount > 0 && <span className="ml-1 text-xs">({percentOff}%)</span>}
            </span>
          </div>
          <div className="flex justify-between border-t border-ink-200 py-1 pt-2">
            <span className="text-ink-600">Collecting now</span>
            <span className="font-bold text-ink-900">{currency(charged)}</span>
          </div>
          {charged === 0 && (
            <div className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Free visit. Nothing is collected, but the checkup is still recorded against this
              patient and the {currency(standardFee)} shows in the clinic's discount total.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Recording…' : charged === 0 ? 'Record free visit' : `Record ${currency(charged)}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Overview({ patient }: { patient: Patient }) {
  const details: [string, string][] = [
    ['Phone', patient.phone],
    ['Email', patient.email || '—'],
    ['Date of birth', formatDate(patient.dob)],
    ['Gender', patient.gender || '—'],
    ['Blood group', patient.bloodGroup || '—'],
    ['Occupation', patient.occupation || '—'],
    ['Referred by', patient.referredBy || '—'],
    ['Attendant', patient.attendantName || '—'],
    ['Emergency contact', patient.emergencyContact || '—'],
    ['Address', patient.address || '—'],
    ['Registered on', formatDate(patient.createdAt)],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <h3 className="mb-4 font-semibold text-ink-900">Patient details</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{k}</dt>
              <dd className="mt-0.5 text-sm text-ink-800">{v}</dd>
            </div>
          ))}
        </dl>
        {patient.notes && (
          <div className="mt-5 rounded-lg bg-brand-50 p-4 text-sm text-ink-700">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              Notes
            </div>
            {patient.notes}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-semibold text-ink-900">Recent activity</h3>
        {!patient.visits?.length ? (
          <EmptyState message="No visits recorded" />
        ) : (
          <div className="divide-y divide-ink-100">
            {patient.visits.slice(0, 8).map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="text-ink-800">{formatDate(v.scheduledDate)}</div>
                  <div className="text-xs text-ink-400">
                    {v.sessionNumber ? `Session ${v.sessionNumber}` : v.type.replace(/_/g, ' ')}
                  </div>
                </div>
                <Badge value={v.attendance} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** What was ticked on the three columns, shown as chips so the card reads at a glance. */
function TickSummary({ d }: { d: Diagnosis }) {
  const groups: [string, string[], string][] = [
    ['Diagnosis', d.checkedDiagnoses || [], 'bg-brand-50 text-brand-700'],
    ['Exercises', d.exercises || [], 'bg-emerald-50 text-emerald-700'],
    ['Modalities', d.modalities || [], 'bg-violet-50 text-violet-700'],
  ];
  const filled = groups.filter(([, items]) => items.length);
  if (!filled.length) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {filled.map(([label, items, tone]) => (
        <div key={label} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {label}
          </span>
          {items.map((i) => (
            <span key={i} className={`badge ${tone}`}>
              {i}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Diagnoses({ patient, reload }: { patient: Patient; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Diagnosis | null>(null);
  const [confirming, setConfirming] = useState<Diagnosis | null>(null);
  // After saving a new diagnosis from a template, offer the package it usually leads to
  // rather than making the clinician navigate away and re-enter the same numbers.
  const [suggested, setSuggested] = useState<{
    diagnosis: Diagnosis;
    template: ConditionTemplate;
  } | null>(null);

  async function remove(d: Diagnosis) {
    await api.delete(`/diagnoses/${d.id}`);
    setConfirming(null);
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          + New assessment
        </button>
      </div>

      {!patient.diagnoses?.length ? (
        <Card>
          <EmptyState message="No assessments recorded yet" />
        </Card>
      ) : (
        <div className="space-y-4">
          {patient.diagnoses.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-ink-900">{d.title}</h4>
                    {d.bodyRegion && (
                      <span className="badge bg-brand-50 text-brand-700">
                        {d.bodyRegion}
                        {d.side ? ` · ${d.side}` : ''}
                      </span>
                    )}
                    {d.painScore != null && (
                      <span
                        className={`badge ${
                          d.painScore <= 3
                            ? 'bg-emerald-100 text-emerald-700'
                            : d.painScore <= 6
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        Pain {d.painScore}/10
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-400">
                    {formatDate(d.date)}
                    {d.doctor?.name ? ` · ${d.doctor.name}` : d.doctorName ? ` · ${d.doctorName}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to={`/patients/${patient.id}/prescription/${d.id}`}
                    className="btn-secondary !py-1 !text-xs"
                    title="Open the printable prescription"
                  >
                    Print
                  </Link>
                  <IconButton
                    icon="edit"
                    label="Edit assessment"
                    onClick={() => {
                      setEditing(d);
                      setOpen(true);
                    }}
                  />
                  <IconButton
                    icon="trash"
                    label="Delete assessment"
                    tone="danger"
                    onClick={() => setConfirming(d)}
                  />
                </div>
              </div>
              <TickSummary d={d} />

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ['History', d.history],
                    ['Evaluation & examination', d.evaluation],
                    ['Treatment plan', d.treatmentPlan],
                    ['Instructions', d.instructions],
                    ['Referred to', d.referredTo],
                    ['Medications', d.medications],
                    ['Lab / radiology', d.labFindings],
                    ['Details', d.details],
                    ['Remarks', d.remarks],
                  ] as [string, string | null | undefined][]
                )
                  .filter(([, value]) => value && value.trim())
                  .map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                        {label}
                      </div>
                      <div className="mt-0.5 whitespace-pre-wrap text-sm text-ink-700">{value}</div>
                    </div>
                  ))}
              </div>

              {!!d.attachments?.length && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Reports &amp; scans
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.dataUrl || `/api/attachments/${a.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="badge bg-ink-100 text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {a.mimeType === 'application/pdf' ? '📄' : '🖼'} {a.filename}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        title="Delete this assessment?"
        message={
          <>
            {confirming?.title} and everything written on it — history, examination, prescription
            and any attached reports — will be removed from the record.
          </>
        }
        onCancel={() => setConfirming(null)}
        onConfirm={() => remove(confirming!)}
      />

      <PrescriptionForm
        open={open}
        editing={editing}
        patientId={patient.id}
        onClose={() => setOpen(false)}
        onSaved={(diagnosis, template) => {
          setOpen(false);
          reload();
          if (template) setSuggested({ diagnosis, template });
        }}
      />

      {suggested && (
        <SuggestPackageModal
          patient={patient}
          diagnosis={suggested.diagnosis}
          template={suggested.template}
          onClose={() => setSuggested(null)}
          reload={reload}
        />
      )}
    </div>
  );
}

/**
 * The step that always follows a diagnosis: the course of treatment. Everything is already
 * known from the condition and the clinic's default fee, so this is a confirmation rather
 * than a form to fill in again.
 */
function SuggestPackageModal({
  patient,
  diagnosis,
  template,
  onClose,
  reload,
}: {
  patient: Patient;
  diagnosis: Diagnosis;
  template: ConditionTemplate;
  onClose: () => void;
  reload: () => void;
}) {
  const { settings } = useSettings();
  const [sessions, setSessions] = useState(template.sessions);
  const [fee, setFee] = useState(settings.defaultSessionFee);
  const [frequencyDays, setFrequencyDays] = useState(template.frequencyDays);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api.post('/packages', {
        patientId: patient.id,
        diagnosisId: diagnosis.id,
        title: `${diagnosis.title} — ${sessions} sessions`,
        totalSessions: Number(sessions),
        feePerSession: Number(fee),
        generateSchedule: true,
        scheduleFrequencyDays: Number(frequencyDays),
        advanceAmount: 0,
        installmentCount: 0,
      });
      onClose();
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Start the treatment package?">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-900">{diagnosis.title}</span> usually needs a
          course of treatment. Set it up now and the sessions are booked in one go — or skip and
          do it later from the Packages tab.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sessions">
            <input
              className="input"
              type="number"
              min={1}
              value={sessions}
              onChange={(e) => setSessions(Math.max(1, Number(e.target.value)))}
            />
          </Field>
          <Field label="Fee per session">
            <input
              className="input"
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
            />
          </Field>
          <Field label="Every (days)">
            <input
              className="input"
              type="number"
              min={1}
              value={frequencyDays}
              onChange={(e) => setFrequencyDays(Math.max(1, Number(e.target.value)))}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-brand-100 bg-ink-50 px-4 py-3 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-ink-600">
              {sessions} sessions × {currency(fee)}
            </span>
            <span className="font-bold text-brand-700">{currency(sessions * fee)}</span>
          </div>
          <div className="text-xs text-ink-500">
            Sessions are booked one every {frequencyDays} day
            {frequencyDays === 1 ? '' : 's'} from today. Advance and installments can be added on
            the package afterwards.
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Not now
          </button>
          <button type="button" className="btn-primary" onClick={create} disabled={busy}>
            {busy ? 'Creating…' : `Create package & book ${sessions} sessions`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The payment plan: an advance, then a 1st, 2nd, 3rd installment — the way the clinic and the
 * patient talk about it.
 *
 * A weekly or monthly package starts with one payment per cycle, but that is a suggestion, not
 * a rule: every row can be moved to the date they agreed, re-priced, removed, or split by
 * adding another. The line underneath says whether the plan still adds up to the balance, so a
 * re-arranged plan cannot quietly lose money.
 */
function PaymentPlan({
  pkg,
  paid,
  onMarkPaid,
  onEdit,
  onDelete,
  onAdd,
}: {
  pkg: TreatmentPackage;
  paid: number;
  onMarkPaid: (id: string) => void;
  onEdit: (inst: Installment) => void;
  onDelete: (inst: Installment) => void;
  onAdd: () => void;
}) {
  const installments = (pkg.installments || [])
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const plan = planSummary(pkg.totalFee, paid, installments);
  // The advance is a payment rather than a scheduled one, but it is the first line of the plan
  // as far as the clinic is concerned, so it is shown as one.
  const advance = (pkg.payments || [])
    .filter((y) => y.type === 'ADVANCE')
    .reduce((sum, y) => sum + y.amount, 0);

  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          Payment plan
        </div>
        <button className="btn-ghost !py-1 !text-xs text-brand-600" onClick={onAdd}>
          + Add an installment
        </button>
      </div>

      {installments.length === 0 && advance === 0 ? (
        <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-500">
          No dates set yet. {currency(plan.balance)} is owed — add an installment to agree a plan.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 text-left">
              <tr>
                <th className="th !px-0 !py-2">Payment</th>
                <th className="th !px-0 !py-2">Due date</th>
                <th className="th !px-0 !py-2">Amount</th>
                <th className="th !px-0 !py-2">Status</th>
                <th className="th !px-0 !py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {advance > 0 && (
                <tr>
                  <td className="py-2 font-medium text-ink-800">Advance</td>
                  <td className="py-2 text-ink-700">{formatDate(pkg.startDate)}</td>
                  <td className="py-2 text-ink-700">{currency(advance)}</td>
                  <td className="py-2">
                    <Badge value="PAID" />
                  </td>
                  <td className="py-2 text-right text-xs text-ink-400">Taken at the start</td>
                </tr>
              )}
              {installments.map((inst, i) => (
                <tr key={inst.id}>
                  <td className="py-2 font-medium text-ink-800">{installmentLabel(i)}</td>
                  <td className="py-2 text-ink-700">{formatDate(inst.dueDate)}</td>
                  <td className="py-2 text-ink-700">{currency(inst.amount)}</td>
                  <td className="py-2">
                    <Badge value={installmentStatus(inst)} />
                  </td>
                  <td className="whitespace-nowrap py-2 text-right">
                    {inst.status !== 'PAID' && (
                      <button
                        className="btn-ghost !py-1 text-brand-600"
                        onClick={() => onMarkPaid(inst.id)}
                      >
                        Mark paid
                      </button>
                    )}
                    <IconButton
                      icon="edit"
                      label="Change this date or amount"
                      onClick={() => onEdit(inst)}
                    />
                    <IconButton
                      icon="trash"
                      label="Remove this installment"
                      tone="danger"
                      onClick={() => onDelete(inst)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Does the plan cover what is owed? */}
      {plan.balance > 0 && plan.unscheduled > 0 && installments.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">{currency(plan.unscheduled)}</span> of the{' '}
          {currency(plan.balance)} balance has no date yet.
        </p>
      )}
      {plan.over > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The plan adds up to <span className="font-semibold">{currency(plan.over)}</span> more
          than the {currency(plan.balance)} still owed.
        </p>
      )}
      {plan.balance > 0 && plan.unscheduled === 0 && plan.over === 0 && installments.length > 0 && (
        <p className="mt-2 text-xs text-emerald-700">
          The plan covers the full {currency(plan.balance)} balance.
        </p>
      )}
    </div>
  );
}

/**
 * The next payment this package is waiting on. A monthly package quietly falls due every
 * month, so it has to say so on the record rather than only in a report nobody opens.
 */
function DueStrip({ pkg }: { pkg: TreatmentPackage }) {
  const due = nextDue(pkg.installments || []);
  if (!due) return null;

  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm ${
        due.overdue
          ? 'bg-red-50 text-red-800'
          : due.daysAway <= 3
            ? 'bg-amber-50 text-amber-900'
            : 'bg-brand-50 text-ink-700'
      }`}
    >
      <span>
        <span className="font-semibold">{currency(due.amount)}</span>{' '}
        {isRecurring(pkg.billingCycle)
          ? `for the next ${cycleNoun(pkg.billingCycle!)}`
          : 'on the payment plan'}{' '}
        — {formatDate(due.dueDate)}
      </span>
      <span
        className={`badge ${
          due.overdue
            ? 'bg-red-100 text-red-700'
            : due.daysAway <= 3
              ? 'bg-amber-100 text-amber-800'
              : 'bg-white text-ink-600'
        }`}
      >
        {dueLabel(due)}
      </span>
    </div>
  );
}

function Packages({ patient, reload }: { patient: Patient; reload: () => void }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [instFor, setInstFor] = useState<TreatmentPackage | null>(null);
  const [carryFor, setCarryFor] = useState<TreatmentPackage | null>(null);
  const [extendFor, setExtendFor] = useState<TreatmentPackage | null>(null);
  const [confirmingPkg, setConfirmingPkg] = useState<TreatmentPackage | null>(null);
  // The plan is the clinic's to arrange, so every row of it can be changed or removed.
  const [editingInst, setEditingInst] = useState<Installment | null>(null);
  const [confirmingInst, setConfirmingInst] = useState<Installment | null>(null);
  const emptyForm = {
    title: '',
    diagnosisId: '',
    billingCycle: 'ONE_TIME' as BillingCycle,
    totalSessions: 10,
    feePerSession: settings.defaultSessionFee,
    // Used by weekly and monthly packages instead of the two above.
    sessionsPerCycle: 3,
    cycleFee: settings.defaultSessionFee * 3,
    cycles: 4,
    startDate: toInputDate(new Date()),
    notes: '',
    generateSchedule: true,
    scheduleFrequencyDays: 2,
    advanceAmount: 0,
    advanceMethod: 'CASH' as const,
    installmentCount: 3,
  };
  const [form, setForm] = useState(emptyForm);

  function openNew() {
    setForm({ ...emptyForm, feePerSession: settings.defaultSessionFee });
    setOpen(true);
  }

  // Existing credit on the account is applied to this package before anything is owed.
  const existingCredit = accountPosition(patient.packages || [], patient.payments || []).credit;

  // A weekly or monthly package is priced per cycle; the sessions and the total follow from it.
  const recurring = isRecurring(form.billingCycle);
  const cyclePlan = recurring
    ? planCycles({
        cycle: form.billingCycle,
        sessionsPerCycle: Number(form.sessionsPerCycle),
        cycleFee: Number(form.cycleFee),
        cycles: Number(form.cycles),
        startDate: form.startDate,
      })
    : null;
  const totalSessions = cyclePlan ? cyclePlan.totalSessions : form.totalSessions;
  const totalFee = cyclePlan ? cyclePlan.totalFee : form.totalSessions * form.feePerSession;
  const settled = form.advanceAmount + existingCredit;
  const balance = Math.max(totalFee - settled, 0);
  const newCredit = Math.max(settled - totalFee, 0);
  const perInstallment =
    form.installmentCount > 0 && balance > 0 ? Math.floor(balance / form.installmentCount) : 0;

  function chooseCycle(billingCycle: BillingCycle) {
    setForm((f) => ({
      ...f,
      billingCycle,
      // One payment per cycle is the starting suggestion; the clinic can ask for a different
      // number, and can move every date and amount once the package exists.
      installmentCount: isRecurring(billingCycle) ? Number(f.cycles) : 3,
      scheduleFrequencyDays: isRecurring(billingCycle)
        ? frequencyForCycle(billingCycle, Number(f.sessionsPerCycle))
        : 2,
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    await api.post('/packages', {
      patientId: patient.id,
      title: form.title,
      diagnosisId: form.diagnosisId || null,
      billingCycle: form.billingCycle,
      ...(recurring
        ? {
            sessionsPerCycle: Number(form.sessionsPerCycle),
            cycleFee: Number(form.cycleFee),
            cycles: Number(form.cycles),
          }
        : {
            totalSessions: Number(form.totalSessions),
            feePerSession: Number(form.feePerSession),
          }),
      startDate: form.startDate,
      notes: form.notes,
      generateSchedule: form.generateSchedule,
      scheduleFrequencyDays: Number(form.scheduleFrequencyDays),
      advanceAmount: Number(form.advanceAmount),
      advanceMethod: form.advanceMethod,
      installmentCount: Number(form.installmentCount),
    });
    setOpen(false);
    setForm(emptyForm);
    reload();
  }

  async function removePkg(p: TreatmentPackage) {
    await api.delete(`/packages/${p.id}`);
    setConfirmingPkg(null);
    reload();
  }

  async function markInstallmentPaid(instId: string) {
    await api.put(`/packages/installments/${instId}`, { status: 'PAID' });
    reload();
  }

  /** The same name the plan shows, for dialogs that talk about one row. */
  function labelFor(inst: Installment | null) {
    if (!inst) return 'installment';
    const pkg = patient.packages?.find((k) => k.id === inst.packageId);
    const rows = (pkg?.installments || [])
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const index = rows.findIndex((r) => r.id === inst.id);
    return index >= 0 ? installmentLabel(index) : 'installment';
  }

  async function removeInstallment(inst: Installment) {
    await api.delete(`/packages/installments/${inst.id}`);
    setConfirmingInst(null);
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openNew}>
          + New Treatment Package
        </button>
      </div>

      {!patient.packages?.length ? (
        <Card>
          <EmptyState message="No treatment packages yet" />
        </Card>
      ) : (
        <div className="space-y-5">
          {patient.packages.map((p) => {
            const paid = sumPayments(p.payments || []);
            const done = (p.visits || []).filter((v) => v.attendance === 'PRESENT').length;
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const pending = (p.visits || []).filter(
              (v) => v.attendance === 'SCHEDULED' && new Date(v.scheduledDate) < startOfToday
            ).length;
            return (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-ink-900">{p.title}</h4>
                      <Badge value={p.status} />
                      {isRecurring(p.billingCycle) && (
                        <span className="badge bg-violet-100 text-violet-700">
                          {CYCLE_LABELS[p.billingCycle!]}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-400">
                      Started {formatDate(p.startDate)} ·{' '}
                      {isRecurring(p.billingCycle)
                        ? `${p.sessionsPerCycle} sessions a ${cycleNoun(p.billingCycle!)} · ${currency(
                            p.cycleFee || 0
                          )} per ${cycleNoun(p.billingCycle!)} · ${p.cycles} ${cycleNoun(
                            p.billingCycle!
                          )}s`
                        : `${p.totalSessions} sessions × ${currency(p.feePerSession)}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pending > 0 && (
                      <button className="btn-secondary !py-1" onClick={() => setCarryFor(p)}>
                        Carry forward ({pending})
                      </button>
                    )}
                    <button className="btn-secondary !py-1" onClick={() => setExtendFor(p)}>
                      + Add sessions
                    </button>
                    <button className="btn-ghost !py-1" onClick={() => setInstFor(p)}>
                      + Installment
                    </button>
                    <IconButton
                      icon="trash"
                      label="Delete package"
                      tone="danger"
                      onClick={() => setConfirmingPkg(p)}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  <StatCard label="Total Fee" value={currency(p.totalFee)} />
                  <StatCard label="Paid" value={currency(paid)} accent="emerald" />
                  {paid > p.totalFee ? (
                    <StatCard
                      label="Overpaid (credit)"
                      value={currency(paid - p.totalFee)}
                      accent="emerald"
                      hint="Held on the patient's account"
                    />
                  ) : (
                    <StatCard
                      label="Balance"
                      value={currency(p.totalFee - paid)}
                      accent="red"
                    />
                  )}
                  <StatCard
                    label="Progress"
                    value={`${done}/${p.totalSessions}`}
                    hint={`${pending} overdue pending`}
                  />
                </div>

                <DueStrip pkg={p} />

                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                      style={{ width: `${Math.min((done / p.totalSessions) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <PaymentPlan
                  pkg={p}
                  paid={paid}
                  onMarkPaid={markInstallmentPaid}
                  onEdit={setEditingInst}
                  onDelete={setConfirmingInst}
                  onAdd={() => setInstFor(p)}
                />
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Treatment Package" wide>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Package title">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Lower back rehab — 10 sessions"
              required
            />
          </Field>
          <Field label="Linked diagnosis">
            <select
              className="input"
              value={form.diagnosisId}
              onChange={(e) => setForm({ ...form, diagnosisId: e.target.value })}
            >
              <option value="">None</option>
              {patient.diagnoses?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
          {/* How the package is sold: in one go, or by the week or month. */}
          <div className="sm:col-span-2">
            <label className="label">How is this package billed?</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['ONE_TIME', 'WEEKLY', 'MONTHLY'] as BillingCycle[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => chooseCycle(c)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    form.billingCycle === c
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <span className="block font-semibold">{CYCLE_LABELS[c]}</span>
                  <span className="block text-xs text-ink-500">
                    {c === 'ONE_TIME'
                      ? 'A set number of sessions, paid as an advance and installments'
                      : c === 'WEEKLY'
                        ? 'So many sessions a week, paid every week'
                        : 'So many sessions a month, paid every month'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {recurring ? (
            <>
              <Field label={`Sessions per ${cycleNoun(form.billingCycle)}`}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.sessionsPerCycle}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sessionsPerCycle: Math.max(1, Number(e.target.value)),
                      scheduleFrequencyDays: frequencyForCycle(
                        form.billingCycle,
                        Math.max(1, Number(e.target.value))
                      ),
                    })
                  }
                  required
                />
              </Field>
              <Field label={`Fee per ${cycleNoun(form.billingCycle)}`}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.cycleFee}
                  onChange={(e) => setForm({ ...form, cycleFee: Number(e.target.value) })}
                  required
                />
              </Field>
              <Field
                label={`How many ${cycleNoun(form.billingCycle)}s?`}
                hint={`One payment falls due every ${cycleNoun(form.billingCycle)}, starting on the start date.`}
              >
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={52}
                  value={form.cycles}
                  onChange={(e) => {
                    const cycles = Math.max(1, Number(e.target.value));
                    setForm((f) => ({
                      ...f,
                      cycles,
                      // Follow the cycles unless the clinic has already chosen its own number.
                      installmentCount: f.installmentCount === f.cycles ? cycles : f.installmentCount,
                    }));
                  }}
                  required
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Total sessions">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.totalSessions}
                  onChange={(e) => setForm({ ...form, totalSessions: Number(e.target.value) })}
                  required
                />
              </Field>
              <Field label="Fee per session">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.feePerSession}
                  onChange={(e) => setForm({ ...form, feePerSession: Number(e.target.value) })}
                  required
                />
              </Field>
            </>
          )}
          <Field label="Start date">
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Advance paid now">
            <input
              className="input"
              type="number"
              min={0}
              value={form.advanceAmount}
              onChange={(e) => setForm({ ...form, advanceAmount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Advance paid by">
            <select
              className="input"
              value={form.advanceMethod}
              onChange={(e) => setForm({ ...form, advanceMethod: e.target.value as any })}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">Mobile wallet</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field
            label="Remaining paid in how many installments?"
            hint={
              recurring
                ? `Leave it at ${form.cycles} for one payment per ${cycleNoun(
                    form.billingCycle
                  )}, or set your own number. Every date and amount can be changed afterwards.`
                : undefined
            }
          >
            <input
              className="input"
              type="number"
              min={0}
              value={form.installmentCount}
              onChange={(e) => setForm({ ...form, installmentCount: Number(e.target.value) })}
              placeholder="0 = no installments"
            />
          </Field>
          <div className="rounded-lg bg-brand-50 p-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
              <input
                type="checkbox"
                checked={form.generateSchedule}
                onChange={(e) => setForm({ ...form, generateSchedule: e.target.checked })}
              />
              Auto-generate session schedule
            </label>
            {form.generateSchedule && (
              <div className="mt-3 flex items-center gap-2 text-sm text-ink-600">
                One session every
                <input
                  className="input !w-20"
                  type="number"
                  min={1}
                  value={form.scheduleFrequencyDays}
                  onChange={(e) =>
                    setForm({ ...form, scheduleFrequencyDays: Number(e.target.value) })
                  }
                />
                day(s)
              </div>
            )}
          </div>
          <div className="rounded-lg border border-brand-100 bg-ink-50 p-4 text-sm sm:col-span-2">
            <div className="flex justify-between py-1">
              <span className="text-ink-600">
                {recurring
                  ? `Package total (${form.cycles} ${cycleNoun(form.billingCycle)}s × ${currency(
                      Number(form.cycleFee)
                    )})`
                  : `Package total (${form.totalSessions} × ${currency(form.feePerSession)})`}
              </span>
              <span className="font-bold text-brand-700">{currency(totalFee)}</span>
            </div>
            {recurring && (
              <div className="flex justify-between py-1">
                <span className="text-ink-600">Sessions booked</span>
                <span className="font-semibold text-ink-900">
                  {totalSessions} ({form.sessionsPerCycle} a {cycleNoun(form.billingCycle)})
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-ink-600">Advance paid now</span>
              <span className="font-semibold text-emerald-600">
                − {currency(form.advanceAmount)}
              </span>
            </div>
            {existingCredit > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-ink-600">Credit already on account</span>
                <span className="font-semibold text-emerald-600">− {currency(existingCredit)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-ink-200 py-1 pt-2">
              <span className="text-ink-600">{newCredit > 0 ? 'Balance' : 'Balance to pay'}</span>
              <span className="font-bold text-ink-900">{currency(balance)}</span>
            </div>
            {newCredit > 0 && (
              <div className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Paid <span className="font-semibold">{currency(newCredit)}</span> more than this
                package costs. The extra stays as credit on the patient's account and comes off
                their next package automatically.
              </div>
            )}
            {recurring && cyclePlan && form.installmentCount === Number(form.cycles) && (
              <div className="mt-2 rounded bg-white px-3 py-2 text-xs text-ink-600">
                {cyclePlan.installments.length} payments of{' '}
                <span className="font-semibold text-ink-900">{currency(Number(form.cycleFee))}</span>
                , one every {cycleNoun(form.billingCycle)} from{' '}
                {formatDate(form.startDate)} to{' '}
                {formatDate(
                  cyclePlan.installments[cyclePlan.installments.length - 1].dueDate.toISOString()
                )}
                . Change any of them on the package afterwards.
              </div>
            )}
            {recurring && form.installmentCount > 0 && form.installmentCount !== Number(form.cycles) && balance > 0 && (
              <div className="mt-2 rounded bg-white px-3 py-2 text-xs text-ink-600">
                Advance of {currency(form.advanceAmount)} now, then {form.installmentCount}{' '}
                installments of about{' '}
                <span className="font-semibold text-ink-900">{currency(perInstallment)}</span>, one
                every {cycleNoun(form.billingCycle)}. Set the exact dates and amounts on the
                package once it is created.
              </div>
            )}
            {!recurring && form.installmentCount > 0 && balance > 0 && (
              <div className="mt-2 rounded bg-white px-3 py-2 text-xs text-ink-600">
                {form.installmentCount} monthly installments of about{' '}
                <span className="font-semibold text-ink-900">{currency(perInstallment)}</span>,
                first one due a month after the start date.
              </div>
            )}
            {form.installmentCount > 0 && balance === 0 && (
              <div className="mt-2 rounded bg-white px-3 py-2 text-xs text-ink-600">
                Nothing left to pay, so no installments will be created.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Package
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmingPkg}
        title="Delete this package?"
        message={
          <>
            {confirmingPkg?.title} and its scheduled sessions will be removed. Payments already
            taken against it stay on the patient's record and will show as credit.
          </>
        }
        confirmLabel="Delete package"
        onCancel={() => setConfirmingPkg(null)}
        onConfirm={() => removePkg(confirmingPkg!)}
      />

      <ExtendPackageModal
        pkg={extendFor}
        visits={patient.visits || []}
        onClose={() => setExtendFor(null)}
        reload={reload}
      />
      <InstallmentModal pkg={instFor} onClose={() => setInstFor(null)} reload={reload} />
      <EditInstallmentModal
        inst={editingInst}
        label={labelFor(editingInst)}
        onClose={() => setEditingInst(null)}
        reload={reload}
      />
      <ConfirmDialog
        open={!!confirmingInst}
        title={`Remove the ${labelFor(confirmingInst)}?`}
        message={
          <>
            The {currency(confirmingInst?.amount || 0)} due on{' '}
            {formatDate(confirmingInst?.dueDate)} comes off the plan, and the ones after it move
            up a number.
            {confirmingInst?.status === 'PAID'
              ? ' It is marked paid, so the payment it recorded is removed too and the money comes off the patient’s total.'
              : ' What the patient owes does not change — only the date it was expected on.'}
          </>
        }
        confirmLabel="Remove"
        onCancel={() => setConfirmingInst(null)}
        onConfirm={() => removeInstallment(confirmingInst!)}
      />
      <CarryForwardModal pkg={carryFor} onClose={() => setCarryFor(null)} reload={reload} />
    </div>
  );
}

/**
 * "The 10 sessions are finished and they need 10 more." Books the extra run and, unless the
 * sessions are being given free, raises the package's session count and total fee to match.
 */
function ExtendPackageModal({
  pkg,
  visits,
  onClose,
  reload,
}: {
  pkg: TreatmentPackage | null;
  visits: Visit[];
  onClose: () => void;
  reload: () => void;
}) {
  const [extraSessions, setExtraSessions] = useState(10);
  const [frequencyDays, setFrequencyDays] = useState(2);
  const [chargeable, setChargeable] = useState(true);
  const [startDate, setStartDate] = useState(toInputDate(new Date()));
  const [feePerSession, setFeePerSession] = useState(0);
  const [busy, setBusy] = useState(false);

  // Sessions that still hold a place in the diary — cancelled and carried-forward ones do not.
  const booked = visits
    .filter(
      (v) =>
        v.packageId === pkg?.id &&
        v.attendance !== 'CANCELLED' &&
        v.attendance !== 'CARRIED_FORWARD'
    )
    .map((v) => v.scheduledDate);
  const lastBooked = lastScheduledDate(booked);

  useEffect(() => {
    if (pkg) {
      setExtraSessions(10);
      setFeePerSession(pkg.feePerSession);
      // More sessions continue the course: they start after the ones already booked, at the
      // cadence this package is actually running at, not from today.
      const freq = inferFrequencyDays(booked);
      setFrequencyDays(freq);
      setStartDate(toInputDate(nextSessionDate(booked, freq)));
    }
    // Only re-derive when a different package is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg?.id]);

  if (!pkg) return null;

  const lastDate = new Date(startDate);
  lastDate.setDate(lastDate.getDate() + (extraSessions - 1) * frequencyDays);
  const extraFee = chargeable ? extraSessions * feePerSession : 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/packages/${pkg!.id}/extend`, {
        extraSessions: Number(extraSessions),
        feePerSession: Number(feePerSession),
        startDate,
        frequencyDays: Number(frequencyDays),
        chargeable,
      });
      onClose();
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add more sessions to this package" wide>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600 sm:col-span-2">
          <span className="font-semibold text-ink-900">{pkg.title}</span> — currently{' '}
          {pkg.totalSessions} sessions at {currency(pkg.feePerSession)} each,{' '}
          {currency(pkg.totalFee)} total.
        </div>

        <Field label="How many more sessions?">
          <input
            className="input"
            type="number"
            min={1}
            max={60}
            value={extraSessions}
            onChange={(e) => setExtraSessions(Math.max(1, Number(e.target.value)))}
            required
          />
        </Field>
        <Field
          label="First new session on"
          hint={
            lastBooked
              ? `The last session on this package is ${formatDate(
                  lastBooked.toISOString()
                )} — the new run starts after it.`
              : undefined
          }
        >
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
        <Field label="One session every (days)">
          <input
            className="input"
            type="number"
            min={1}
            value={frequencyDays}
            onChange={(e) => setFrequencyDays(Math.max(1, Number(e.target.value)))}
          />
        </Field>
        <Field label="Fee per session">
          <input
            className="input"
            type="number"
            min={0}
            value={feePerSession}
            onChange={(e) => setFeePerSession(Number(e.target.value))}
            disabled={!chargeable}
          />
        </Field>

        <label className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-ink-800 sm:col-span-2">
          <input
            type="checkbox"
            checked={chargeable}
            onChange={(e) => setChargeable(e.target.checked)}
          />
          Charge for these sessions (adds them to the package total)
        </label>

        <div className="rounded-lg border border-brand-100 bg-ink-50 p-4 text-sm sm:col-span-2">
          <div className="flex justify-between py-1">
            <span className="text-ink-600">
              {extraSessions} sessions, {formatDate(startDate)} to
            </span>
            <span className="font-semibold text-ink-900">{formatDate(lastDate.toISOString())}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-600">Added to package fee</span>
            <span className="font-semibold text-brand-700">+ {currency(extraFee)}</span>
          </div>
          <div className="flex justify-between border-t border-ink-200 py-1 pt-2">
            <span className="text-ink-600">Package becomes</span>
            <span className="font-bold text-ink-900">
              {pkg.totalSessions + (chargeable ? extraSessions : 0)} sessions ·{' '}
              {currency(pkg.totalFee + extraFee)}
            </span>
          </div>
          {!chargeable && (
            <div className="mt-2 rounded bg-white px-3 py-2 text-xs text-ink-600">
              Free sessions: they are scheduled and attendance is tracked, but nothing is added to
              what the patient owes.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Adding…' : `Add ${extraSessions} sessions`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function InstallmentModal({
  pkg,
  onClose,
  reload,
}: {
  pkg: TreatmentPackage | null;
  onClose: () => void;
  reload: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(toInputDate(new Date()));

  // Whatever is owed but has no date against it is the obvious amount to offer.
  const plan = pkg
    ? planSummary(pkg.totalFee, sumPayments(pkg.payments || []), pkg.installments || [])
    : null;
  const nextNumber = (pkg?.installments?.length || 0) + 1;

  useEffect(() => {
    if (pkg && plan) {
      setAmount(plan.unscheduled);
      setDueDate(toInputDate(new Date()));
    }
    // Only re-fill when a different package is opened, never while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg?.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!pkg) return;
    await api.post(`/packages/${pkg.id}/installments`, { amount: Number(amount), dueDate });
    onClose();
    reload();
  }

  return (
    <Modal open={!!pkg} onClose={onClose} title={`Add the ${ordinal(nextNumber)} installment`}>
      <form onSubmit={save} className="space-y-4">
        {plan && plan.unscheduled > 0 && (
          <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
            {currency(plan.unscheduled)} of the {currency(plan.balance)} balance has no date yet.
          </p>
        )}
        <Field label="Amount">
          <input
            className="input"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            required
          />
        </Field>
        <Field label="Due date">
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Add
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Changing one row of the plan: the date the patient agreed to, or the amount they can manage.
 * A row already paid can still be corrected — the payment it recorded moves with it.
 */
function EditInstallmentModal({
  inst,
  label,
  onClose,
  reload,
}: {
  inst: Installment | null;
  label: string;
  onClose: () => void;
  reload: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (inst) {
      setAmount(inst.amount);
      setDueDate(toInputDate(inst.dueDate));
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!inst) return;
    setBusy(true);
    setError('');
    try {
      await api.put(`/packages/installments/${inst.id}`, { amount: Number(amount), dueDate });
      onClose();
      reload();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'That payment could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!inst} onClose={onClose} title={`Change the ${label}`}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Amount">
          <input
            className="input"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            required
          />
        </Field>
        <Field label="Due date">
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </Field>
        {inst?.status === 'PAID' && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This one is already paid. Changing the amount moves the payment it recorded with it,
            so the day's takings stay correct.
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CarryForwardModal({
  pkg,
  onClose,
  reload,
}: {
  pkg: TreatmentPackage | null;
  onClose: () => void;
  reload: () => void;
}) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  const [newStartDate, setNewStartDate] = useState(toInputDate(nextMonth));
  const [frequencyDays, setFrequencyDays] = useState(2);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!pkg) return;
    await api.post('/visits/carry-forward-pending', {
      packageId: pkg.id,
      newStartDate,
      frequencyDays: Number(frequencyDays),
    });
    onClose();
    reload();
  }

  return (
    <Modal open={!!pkg} onClose={onClose} title="Carry Forward Pending Sessions">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-ink-600">
          All overdue sessions that were missed or never marked will be rescheduled starting from
          the date below.
        </p>
        <Field label="Reschedule starting from">
          <input
            className="input"
            type="date"
            value={newStartDate}
            onChange={(e) => setNewStartDate(e.target.value)}
            required
          />
        </Field>
        <Field label="One session every (days)">
          <input
            className="input"
            type="number"
            min={1}
            value={frequencyDays}
            onChange={(e) => setFrequencyDays(Number(e.target.value))}
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

function Sessions({ patient, reload }: { patient: Patient; reload: () => void }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    api.get('/doctors').then((r) => setDoctors(r.data));
  }, []);

  const emptyForm = {
    packageId: '',
    doctorId: '',
    scheduledDate: toInputDate(new Date()),
    type: 'SESSION' as const,
    fee: settings.defaultSessionFee,
    remarks: '',
    count: 1,
    frequencyDays: 2,
  };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [confirmingVisit, setConfirmingVisit] = useState<Visit | null>(null);
  const [carryVisit, setCarryVisit] = useState<Visit | null>(null);

  const selectedPackage = patient.packages?.find((p) => p.id === form.packageId);
  const alreadyScheduled = selectedPackage
    ? (patient.visits || []).filter((v) => v.packageId === selectedPackage.id).length
    : 0;
  const overBy = selectedPackage
    ? alreadyScheduled + form.count - selectedPackage.totalSessions
    : 0;

  const lastDate = (() => {
    const d = new Date(form.scheduledDate);
    d.setDate(d.getDate() + (form.count - 1) * form.frequencyDays);
    return d;
  })();

  /**
   * The dates that currently hold a place in the diary. Cancelled and carried-forward slots do
   * not, so they must not push the next session out.
   */
  function bookedDates(packageId: string) {
    return (patient.visits || [])
      .filter((v) => (packageId ? v.packageId === packageId : true))
      .filter((v) => v.attendance !== 'CANCELLED' && v.attendance !== 'CARRIED_FORWARD')
      .map((v) => v.scheduledDate);
  }

  /**
   * A new session belongs *after* the course already booked, not today: a package that runs to
   * mid-September would otherwise get the new sessions dropped in among the existing ones and the
   * patient would end up with two appointments on the same day. The gap between them is read from
   * the dates already booked, so a further run keeps the rhythm the patient is used to.
   */
  function scheduleDefaults(packageId: string) {
    const dates = bookedDates(packageId);
    const frequencyDays = inferFrequencyDays(dates);
    return { scheduledDate: toInputDate(nextSessionDate(dates, frequencyDays)), frequencyDays };
  }

  function openNew() {
    setForm({ ...emptyForm, fee: settings.defaultSessionFee, ...scheduleDefaults('') });
    setOpen(true);
  }

  /**
   * Picking a package adopts its per-session fee, since that is what the patient agreed to, and
   * re-dates the run to follow that package's own schedule rather than the patient's other work.
   */
  function choosePackage(packageId: string) {
    const pkg = patient.packages?.find((p) => p.id === packageId);
    setForm((f) => ({
      ...f,
      packageId,
      fee: pkg ? pkg.feePerSession : settings.defaultSessionFee,
      ...scheduleDefaults(packageId),
    }));
  }

  const lastBooked = lastScheduledDate(bookedDates(form.packageId));

  async function mark(visit: Visit, status: string) {
    await api.post(`/visits/${visit.id}/attendance`, { status });
    reload();
  }

  // Errors surface inside the dialog, including the API's refusal to delete a session
  // that has a payment attached to it.
  async function removeVisit(visit: Visit) {
    await api.delete(`/visits/${visit.id}`);
    setConfirmingVisit(null);
    reload();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/visits', {
        patientId: patient.id,
        packageId: form.packageId || null,
        doctorId: form.doctorId || null,
        scheduledDate: form.scheduledDate,
        type: form.type,
        fee: Number(form.fee),
        remarks: form.remarks,
        count: Number(form.count),
        frequencyDays: Number(form.frequencyDays),
      });
      setOpen(false);
      setForm(emptyForm);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes(visit: Visit, treatmentNotes: string) {
    await api.put(`/visits/${visit.id}`, { treatmentNotes });
    reload();
  }

  async function assignDoctor(visit: Visit, doctorId: string) {
    await api.put(`/visits/${visit.id}`, { doctorId: doctorId || null });
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openNew}>
          + Add Session / Visit
        </button>
      </div>

      <Card className="overflow-hidden">
        {!patient.visits?.length ? (
          <EmptyState message="No sessions scheduled" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Session</th>
                  <th className="th">Doctor</th>
                  <th className="th">Fee</th>
                  <th className="th">Attendance</th>
                  <th className="th">Treatment notes</th>
                  <th className="th text-right">Mark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {patient.visits.map((v) => (
                  <tr key={v.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3 text-ink-700">{formatDate(v.scheduledDate)}</td>
                    <td className="px-5 py-3 text-ink-700">
                      {v.sessionNumber ? `#${v.sessionNumber}` : v.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        className="input !w-auto !min-w-[9rem] !py-1 !text-xs"
                        value={v.doctorId || ''}
                        onChange={(e) => assignDoctor(v, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-ink-700">
                      {currency(v.fee)}
                      {v.feeCollected && (
                        <span className="ml-2 text-xs text-emerald-600">paid</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge value={v.attendance} />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        className="input !py-1 !text-xs"
                        defaultValue={v.treatmentNotes || ''}
                        placeholder="Add notes…"
                        onBlur={(e) => {
                          if (e.target.value !== (v.treatmentNotes || ''))
                            saveNotes(v, e.target.value);
                        }}
                      />
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
                      <button
                        className="btn-ghost !px-2 !py-1 text-ink-400"
                        title="Cancel this session (keeps the record)"
                        onClick={() => mark(v, 'CANCELLED')}
                      >
                        Cancel
                      </button>
                      {v.attendance !== 'CARRIED_FORWARD' && (
                        <IconButton
                          icon="forward"
                          label="Carry this session forward to a new date"
                          onClick={() => setCarryVisit(v)}
                        />
                      )}
                      <IconButton
                        icon="trash"
                        label="Delete this session permanently"
                        tone="danger"
                        onClick={() => setConfirmingVisit(v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmingVisit}
        title="Delete this session?"
        message={
          <>
            {confirmingVisit?.sessionNumber
              ? `Session #${confirmingVisit.sessionNumber}`
              : 'This visit'}{' '}
            on {formatDate(confirmingVisit?.scheduledDate)} will be removed along with its
            attendance record. To keep the history instead, use Cancel on the row.
          </>
        }
        confirmLabel="Delete session"
        onCancel={() => setConfirmingVisit(null)}
        onConfirm={() => removeVisit(confirmingVisit!)}
      />

      <CarrySessionModal
        visit={carryVisit}
        bookedDates={bookedDates(carryVisit?.packageId || '')}
        onClose={() => setCarryVisit(null)}
        reload={reload}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Add Session / Visit" wide>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Package" className="sm:col-span-2">
            <select
              className="input"
              value={form.packageId}
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
          <Field label="Assigned doctor" className="sm:col-span-2">
            <select
              className="input"
              value={form.doctorId}
              onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
            >
              <option value="">Not assigned yet</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialization ? ` — ${d.specialization}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="How many sessions?">
            <input
              className="input"
              type="number"
              min={1}
              max={60}
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Math.max(1, Number(e.target.value)) })}
              required
            />
          </Field>
          <Field
            label={form.count > 1 ? 'First session on' : 'Date'}
            hint={
              lastBooked
                ? `Follows the last session booked ${
                    form.packageId ? 'on this package' : 'for this patient'
                  } (${formatDate(lastBooked.toISOString())}) — change it if they are coming sooner.`
                : undefined
            }
          >
            <input
              className="input"
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              required
            />
          </Field>
          {form.count > 1 && (
            <Field label="One session every (days)" className="sm:col-span-2">
              <input
                className="input"
                type="number"
                min={1}
                value={form.frequencyDays}
                onChange={(e) =>
                  setForm({ ...form, frequencyDays: Math.max(1, Number(e.target.value)) })
                }
              />
            </Field>
          )}
          <Field label="Type">
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            >
              <option value="SESSION">Session</option>
              <option value="INITIAL_CONSULT">Initial consultation</option>
              <option value="FOLLOWUP">Follow-up</option>
            </select>
          </Field>
          <Field label="Fee per session">
            <input
              className="input"
              type="number"
              min={0}
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
            />
          </Field>
          <Field label="Remarks" className="sm:col-span-2">
            <textarea
              className="input"
              rows={2}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </Field>

          <div className="rounded-lg border border-brand-100 bg-ink-50 p-4 text-sm sm:col-span-2">
            <div className="flex justify-between py-1">
              <span className="text-ink-600">
                {form.count === 1
                  ? '1 session on'
                  : `${form.count} sessions, ${formatDate(form.scheduledDate)} to`}
              </span>
              <span className="font-semibold text-ink-900">
                {form.count === 1
                  ? formatDate(form.scheduledDate)
                  : formatDate(lastDate.toISOString())}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-600">Total fee for these sessions</span>
              <span className="font-bold text-brand-700">{currency(form.count * form.fee)}</span>
            </div>
            {selectedPackage && overBy > 0 && (
              <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This package is for {selectedPackage.totalSessions} sessions and{' '}
                {alreadyScheduled} are already scheduled. Adding {form.count} more takes it{' '}
                {overBy} over — fine if you are extending the treatment, but the extra sessions
                are not covered by the package fee.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : form.count === 1 ? 'Add session' : `Add ${form.count} sessions`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * A missed session does not disappear, it moves: the original is kept and marked carried forward,
 * and a replacement is booked. The default date puts it after everything else already booked, so
 * a session missed in the middle of a course is picked up at the end of it rather than double-
 * booking a day the patient is already coming in.
 */
function CarrySessionModal({
  visit,
  bookedDates,
  onClose,
  reload,
}: {
  visit: Visit | null;
  bookedDates: string[];
  onClose: () => void;
  reload: () => void;
}) {
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visit) return;
    setError('');
    setNewDate(toInputDate(nextSessionDate(bookedDates, inferFrequencyDays(bookedDates))));
    // Re-dating only needs to happen when a different session is picked up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit?.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!visit) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/visits/${visit.id}/carry-forward`, { newDate });
      onClose();
      reload();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not carry this session forward.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!visit} onClose={onClose} title="Carry this session forward">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-ink-600">
          {visit?.sessionNumber ? `Session #${visit.sessionNumber}` : 'This visit'} from{' '}
          {formatDate(visit?.scheduledDate)} stays in the history marked carried forward, and a
          replacement session is booked on the new date. The package total does not change.
        </p>
        <Field label="New date" hint="Set to follow the sessions already booked.">
          <input
            className="input"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
        </Field>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Moving…' : 'Carry forward'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Payments({ patient, reload }: { patient: Patient; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const emptyForm = {
    amount: 0,
    type: 'ADVANCE' as const,
    method: 'CASH' as const,
    packageId: '',
    date: toInputDate(new Date()),
    notes: '',
    collectedByDoctorId: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);
  // Only commission doctors can hold the clinic's money, so only they are worth offering.
  const [commissionDoctors, setCommissionDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    api
      .get('/doctors')
      .then((r) =>
        setCommissionDoctors((r.data as Doctor[]).filter((d) => d.employmentType === 'COMMISSION'))
      );
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    await api.post('/payments', {
      patientId: patient.id,
      packageId: form.packageId || null,
      amount: Number(form.amount),
      type: form.type,
      method: form.method,
      date: form.date,
      notes: form.notes,
      collectedByDoctorId: form.collectedByDoctorId || null,
    });
    setOpen(false);
    setForm(emptyForm);
    reload();
  }

  async function remove(p: Payment) {
    await api.delete(`/payments/${p.id}`);
    setConfirmingPayment(null);
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Record Payment / Advance
        </button>
      </div>

      <Card className="overflow-hidden">
        {!patient.payments?.length ? (
          <EmptyState message="No payments recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th">Method</th>
                  <th className="th">Amount</th>
                  <th className="th">Notes</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {patient.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3 text-ink-700">{formatDate(p.date)}</td>
                    <td className="px-5 py-3">
                      <Badge value={p.type} />
                    </td>
                    <td className="px-5 py-3 text-ink-600">{p.method.replace(/_/g, ' ')}</td>
                    <td
                      className={`px-5 py-3 font-semibold ${
                        p.type === 'REFUND' ? 'text-red-600' : 'text-ink-900'
                      }`}
                    >
                      {currency(netAmount(p))}
                    </td>
                    <td className="px-5 py-3 text-ink-500">
                      {p.notes || '—'}
                      {!!p.discount && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {currency(p.discount)} off
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <IconButton
                        icon="trash"
                        label="Delete payment"
                        tone="danger"
                        onClick={() => setConfirmingPayment(p)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmingPayment}
        title="Delete this payment?"
        message={
          <>
            {confirmingPayment ? currency(confirmingPayment.amount) : ''} recorded on{' '}
            {formatDate(confirmingPayment?.date)} will be removed. Your revenue and this
            patient's balance both change as a result.
          </>
        }
        confirmLabel="Delete payment"
        onCancel={() => setConfirmingPayment(null)}
        onConfirm={() => remove(confirmingPayment!)}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Record Payment">
        <form onSubmit={save} className="space-y-4">
          <Field label="Amount">
            <input
              className="input"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Type">
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            >
              <option value="CHECKUP_FEE">Checkup fee</option>
              <option value="ADVANCE">Advance</option>
              <option value="SESSION_FEE">Session fee</option>
              <option value="INSTALLMENT">Installment</option>
              <option value="VISIT_FEE">Visit fee</option>
              <option value="REFUND">Refund</option>
            </select>
          </Field>
          <Field label="Method">
            <select
              className="input"
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as any })}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">Mobile wallet</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Against package">
            <select
              className="input"
              value={form.packageId}
              onChange={(e) => setForm({ ...form, packageId: e.target.value })}
            >
              <option value="">None</option>
              {patient.packages?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          {commissionDoctors.length > 0 && (
            <Field
              label="Who took the money?"
              hint="A commission doctor who takes payment at the chair is holding the clinic's share — it shows up in their settlement."
            >
              <select
                className="input"
                value={form.collectedByDoctorId}
                onChange={(e) => setForm({ ...form, collectedByDoctorId: e.target.value })}
              >
                <option value="">The front desk</option>
                {commissionDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
