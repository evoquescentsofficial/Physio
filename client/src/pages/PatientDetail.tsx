import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Modal,
  StatCard,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import { Diagnosis, Doctor, Patient, Payment, TreatmentPackage, Visit } from '../types';
import { useSettings } from '../context/SettingsContext';

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
  const totalPaid = payments.reduce((s, p) => s + (p.type === 'REFUND' ? -p.amount : p.amount), 0);
  // Only packages create a debt; checkup and single-session fees are settled as they happen.
  // Advances and installments count even without a package — that is money on account.
  const packageValue = (patient.packages || [])
    .filter((p) => p.status !== 'CANCELLED')
    .reduce((s, p) => s + p.totalFee, 0);
  const paidOnAccount = payments
    .filter((p) => p.packageId || p.type === 'ADVANCE' || p.type === 'INSTALLMENT')
    .reduce((s, p) => s + (p.type === 'REFUND' ? -p.amount : p.amount), 0);
  const accountBalance = packageValue - paidOnAccount;
  const balanceDue = Math.max(accountBalance, 0);
  const creditBalance = Math.max(-accountBalance, 0);
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
 * First-visit checkup fee is a separate charge from session/package fees, so it gets a
 * one-click prompt that disappears once the fee has been recorded for this patient.
 */
function CheckupFeeBanner({ patient, reload }: { patient: Patient; reload: () => void }) {
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const alreadyPaid = (patient.payments || []).some((p) => p.type === 'CHECKUP_FEE');

  if (alreadyPaid) return null;

  async function record() {
    setBusy(true);
    try {
      await api.post('/payments', {
        patientId: patient.id,
        amount: settings.checkupFee,
        type: 'CHECKUP_FEE',
        method: 'CASH',
        notes: 'First visit checkup fee',
      });
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4">
      <div>
        <div className="font-semibold text-teal-900">Checkup fee not recorded</div>
        <div className="text-sm text-teal-700">
          Charge the first-visit checkup fee of {currency(settings.checkupFee)} before starting a
          treatment package.
        </div>
      </div>
      <button className="btn-primary !bg-teal-600 hover:!bg-teal-700" onClick={record} disabled={busy}>
        {busy ? 'Recording…' : `Record ${currency(settings.checkupFee)}`}
      </button>
    </div>
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

function Diagnoses({ patient, reload }: { patient: Patient; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Diagnosis | null>(null);
  const emptyForm = {
    title: '',
    date: toInputDate(new Date()),
    details: '',
    treatmentPlan: '',
    remarks: '',
    doctorName: '',
  };
  const [form, setForm] = useState(emptyForm);

  async function save(e: FormEvent) {
    e.preventDefault();
    const payload = { ...form, patientId: patient.id };
    if (editing) await api.put(`/diagnoses/${editing.id}`, payload);
    else await api.post('/diagnoses', payload);
    setOpen(false);
    reload();
  }

  async function remove(d: Diagnosis) {
    if (!confirm('Delete this diagnosis?')) return;
    await api.delete(`/diagnoses/${d.id}`);
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          + Add Diagnosis
        </button>
      </div>

      {!patient.diagnoses?.length ? (
        <Card>
          <EmptyState message="No diagnoses recorded yet" />
        </Card>
      ) : (
        <div className="space-y-4">
          {patient.diagnoses.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-ink-900">{d.title}</h4>
                  <div className="text-xs text-ink-400">
                    {formatDate(d.date)}
                    {d.doctorName ? ` · Dr. ${d.doctorName}` : ''}
                  </div>
                </div>
                <div>
                  <button
                    className="btn-ghost !py-1"
                    onClick={() => {
                      setEditing(d);
                      setForm({
                        title: d.title,
                        date: toInputDate(d.date),
                        details: d.details || '',
                        treatmentPlan: d.treatmentPlan || '',
                        remarks: d.remarks || '',
                        doctorName: d.doctorName || '',
                      });
                      setOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-ghost !py-1 text-red-600 hover:bg-red-50"
                    onClick={() => remove(d)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  ['Details', d.details],
                  ['Treatment plan', d.treatmentPlan],
                  ['Remarks', d.remarks],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {label}
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm text-ink-700">
                      {value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Diagnosis' : 'Add Diagnosis'}
        wide
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Diagnosis / condition">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Attending doctor" className="sm:col-span-2">
            <input
              className="input"
              value={form.doctorName}
              onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
            />
          </Field>
          <Field label="Clinical details" className="sm:col-span-2">
            <textarea
              className="input"
              rows={3}
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
            />
          </Field>
          <Field label="Treatment plan" className="sm:col-span-2">
            <textarea
              className="input"
              rows={3}
              value={form.treatmentPlan}
              onChange={(e) => setForm({ ...form, treatmentPlan: e.target.value })}
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
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Packages({ patient, reload }: { patient: Patient; reload: () => void }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [instFor, setInstFor] = useState<TreatmentPackage | null>(null);
  const [carryFor, setCarryFor] = useState<TreatmentPackage | null>(null);
  const [extendFor, setExtendFor] = useState<TreatmentPackage | null>(null);
  const emptyForm = {
    title: '',
    diagnosisId: '',
    totalSessions: 10,
    feePerSession: settings.defaultSessionFee,
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
  const existingCredit = (() => {
    const value = (patient.packages || [])
      .filter((p) => p.status !== 'CANCELLED')
      .reduce((s, p) => s + p.totalFee, 0);
    const paid = (patient.payments || [])
      .filter((p) => p.packageId || p.type === 'ADVANCE' || p.type === 'INSTALLMENT')
      .reduce((s, p) => s + (p.type === 'REFUND' ? -p.amount : p.amount), 0);
    return Math.max(paid - value, 0);
  })();

  const totalFee = form.totalSessions * form.feePerSession;
  const settled = form.advanceAmount + existingCredit;
  const balance = Math.max(totalFee - settled, 0);
  const newCredit = Math.max(settled - totalFee, 0);
  const perInstallment =
    form.installmentCount > 0 && balance > 0 ? Math.floor(balance / form.installmentCount) : 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    await api.post('/packages', {
      patientId: patient.id,
      title: form.title,
      diagnosisId: form.diagnosisId || null,
      totalSessions: Number(form.totalSessions),
      feePerSession: Number(form.feePerSession),
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
    if (!confirm('Delete this package and its scheduled sessions?')) return;
    await api.delete(`/packages/${p.id}`);
    reload();
  }

  async function markInstallmentPaid(instId: string) {
    await api.put(`/packages/installments/${instId}`, { status: 'PAID' });
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
            const paid = (p.payments || []).reduce((s, x) => s + x.amount, 0);
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
                    </div>
                    <div className="text-xs text-ink-400">
                      Started {formatDate(p.startDate)} · {p.totalSessions} sessions ×{' '}
                      {currency(p.feePerSession)}
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
                    <button
                      className="btn-ghost !py-1 text-red-600 hover:bg-red-50"
                      onClick={() => removePkg(p)}
                    >
                      Delete
                    </button>
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

                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                      style={{ width: `${Math.min((done / p.totalSessions) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {!!p.installments?.length && (
                  <div className="mt-5">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      Installments
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase text-ink-400">
                          <tr>
                            <th className="py-2">Due date</th>
                            <th className="py-2">Amount</th>
                            <th className="py-2">Status</th>
                            <th className="py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {p.installments.map((inst) => (
                            <tr key={inst.id}>
                              <td className="py-2 text-ink-700">{formatDate(inst.dueDate)}</td>
                              <td className="py-2 text-ink-700">{currency(inst.amount)}</td>
                              <td className="py-2">
                                <Badge
                                  value={
                                    inst.status === 'PENDING' &&
                                    new Date(inst.dueDate) < new Date()
                                      ? 'OVERDUE'
                                      : inst.status
                                  }
                                />
                              </td>
                              <td className="py-2 text-right">
                                {inst.status !== 'PAID' && (
                                  <button
                                    className="btn-ghost !py-1 text-brand-600"
                                    onClick={() => markInstallmentPaid(inst.id)}
                                  >
                                    Mark paid
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
          <Field label="Remaining paid in how many installments?">
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
                Package total ({form.totalSessions} × {currency(form.feePerSession)})
              </span>
              <span className="font-bold text-brand-700">{currency(totalFee)}</span>
            </div>
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
            {form.installmentCount > 0 && balance > 0 && (
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

      <ExtendPackageModal pkg={extendFor} onClose={() => setExtendFor(null)} reload={reload} />
      <InstallmentModal pkg={instFor} onClose={() => setInstFor(null)} reload={reload} />
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
  onClose,
  reload,
}: {
  pkg: TreatmentPackage | null;
  onClose: () => void;
  reload: () => void;
}) {
  const [extraSessions, setExtraSessions] = useState(10);
  const [frequencyDays, setFrequencyDays] = useState(2);
  const [chargeable, setChargeable] = useState(true);
  const [startDate, setStartDate] = useState(toInputDate(new Date()));
  const [feePerSession, setFeePerSession] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pkg) {
      setExtraSessions(10);
      setFeePerSession(pkg.feePerSession);
      setStartDate(toInputDate(new Date()));
    }
  }, [pkg]);

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
        <Field label="First new session on">
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

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!pkg) return;
    await api.post(`/packages/${pkg.id}/installments`, { amount: Number(amount), dueDate });
    onClose();
    reload();
  }

  return (
    <Modal open={!!pkg} onClose={onClose} title="Add Installment">
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

  function openNew() {
    setForm({ ...emptyForm, fee: settings.defaultSessionFee });
    setOpen(true);
  }

  /** Picking a package adopts its per-session fee, since that is what the patient agreed to. */
  function choosePackage(packageId: string) {
    const pkg = patient.packages?.find((p) => p.id === packageId);
    setForm((f) => ({
      ...f,
      packageId,
      fee: pkg ? pkg.feePerSession : settings.defaultSessionFee,
    }));
  }

  async function mark(visit: Visit, status: string) {
    await api.post(`/visits/${visit.id}/attendance`, { status });
    reload();
  }

  async function removeVisit(visit: Visit) {
    const label = visit.sessionNumber ? `session #${visit.sessionNumber}` : 'this visit';
    if (!confirm(`Delete ${label} on ${formatDate(visit.scheduledDate)}? This cannot be undone.`))
      return;
    try {
      await api.delete(`/visits/${visit.id}`);
      reload();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not delete this session.');
    }
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
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Session</th>
                  <th className="px-5 py-3 font-semibold">Doctor</th>
                  <th className="px-5 py-3 font-semibold">Fee</th>
                  <th className="px-5 py-3 font-semibold">Attendance</th>
                  <th className="px-5 py-3 font-semibold">Treatment notes</th>
                  <th className="px-5 py-3 text-right font-semibold">Mark</th>
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
                      <button
                        className="btn-ghost !px-2 !py-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete this session permanently"
                        onClick={() => removeVisit(v)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
          <Field label={form.count > 1 ? 'First session on' : 'Date'}>
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

function Payments({ patient, reload }: { patient: Patient; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const emptyForm = {
    amount: 0,
    type: 'ADVANCE' as const,
    method: 'CASH' as const,
    packageId: '',
    date: toInputDate(new Date()),
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

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
    });
    setOpen(false);
    setForm(emptyForm);
    reload();
  }

  async function remove(p: Payment) {
    if (!confirm('Delete this payment record?')) return;
    await api.delete(`/payments/${p.id}`);
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
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Method</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Notes</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
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
                    <td className="px-5 py-3 font-semibold text-ink-900">{currency(p.amount)}</td>
                    <td className="px-5 py-3 text-ink-500">{p.notes || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="btn-ghost !py-1 text-red-600 hover:bg-red-50"
                        onClick={() => remove(p)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
