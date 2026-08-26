import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Field, Modal } from './ui';
import { Diagnosis, Doctor } from '../types';
import {
  BODY_REGIONS,
  ConditionTemplate,
  SIDES,
  findCondition,
  searchConditions,
} from '../../../shared/conditions';

export interface DiagnosisFormValues {
  title: string;
  date: string;
  doctorId: string;
  bodyRegion: string;
  side: string;
  painScore: number | '';
  details: string;
  treatmentPlan: string;
  remarks: string;
}

/**
 * Condition picker. Typing filters the clinic's condition library and picking one fills the
 * treatment plan and body region, so the twentieth "lower back pain" of the month costs a
 * couple of keystrokes instead of a paragraph. Anything not in the library can still be
 * typed freely — the list is a shortcut, not a whitelist.
 */
function ConditionPicker({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (c: ConditionTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const matches = searchConditions(value);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  function choose(c: ConditionTemplate) {
    onChange(c.name);
    onPick(c);
    setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => (h + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => (h - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(matches[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder="Start typing — e.g. back pain, frozen shoulder, sciatica"
        autoComplete="off"
        required
      />

      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-ink-200 bg-white py-1 shadow-card">
          {matches.map((c, i) => (
            <li key={c.name}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(c)}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === highlight ? 'bg-brand-50' : 'hover:bg-ink-50'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{c.name}</span>
                  <span className="block text-xs text-ink-400">
                    {c.region} · usually {c.sessions} sessions
                  </span>
                </span>
                <span className="mt-0.5 shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                  fills plan
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-ink-100 px-4 py-2 text-xs text-ink-400">
            Not listed? Just type it — the plan is yours to write.
          </li>
        </ul>
      )}
    </div>
  );
}

/** 0–10 numeric rating, the standard way physios record how much it hurts. */
function PainScale({ value, onChange }: { value: number | ''; onChange: (v: number | '') => void }) {
  const labels = ['No pain', 'Mild', 'Moderate', 'Severe', 'Worst imaginable'];
  const label =
    value === ''
      ? 'Not recorded'
      : value === 0
        ? labels[0]
        : value <= 3
          ? labels[1]
          : value <= 6
            ? labels[2]
            : value <= 9
              ? labels[3]
              : labels[4];

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 11 }).map((_, n) => {
          const selected = value === n;
          const tone =
            n <= 3 ? 'bg-emerald-500' : n <= 6 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(selected ? '' : n)}
              aria-label={`Pain ${n} out of 10`}
              className={`h-9 w-9 rounded-lg text-sm font-semibold transition-colors ${
                selected
                  ? `${tone} text-white`
                  : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 text-xs text-ink-400">
        {label}
        {value !== '' && ' — click again to clear'}
      </div>
    </div>
  );
}

export default function DiagnosisForm({
  open,
  editing,
  patientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Diagnosis | null;
  patientId: string;
  onClose: () => void;
  /** Passes back the template used, so the caller can offer to build the package next. */
  onSaved: (diagnosis: Diagnosis, template: ConditionTemplate | null) => void;
}) {
  const emptyForm: DiagnosisFormValues = {
    title: '',
    date: new Date().toISOString().slice(0, 10),
    doctorId: '',
    bodyRegion: '',
    side: 'Not applicable',
    painScore: '',
    details: '',
    treatmentPlan: '',
    remarks: '',
  };

  const [form, setForm] = useState<DiagnosisFormValues>(emptyForm);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [template, setTemplate] = useState<ConditionTemplate | null>(null);
  const [planTouched, setPlanTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) api.get('/doctors').then((r) => setDoctors(r.data));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        title: editing.title,
        date: (editing.date || '').slice(0, 10),
        doctorId: editing.doctorId || '',
        bodyRegion: editing.bodyRegion || '',
        side: editing.side || 'Not applicable',
        painScore: editing.painScore ?? '',
        details: editing.details || '',
        treatmentPlan: editing.treatmentPlan || '',
        remarks: editing.remarks || '',
      });
      setPlanTouched(true);
      setTemplate(findCondition(editing.title) || null);
    } else {
      setForm(emptyForm);
      setPlanTouched(false);
      setTemplate(null);
    }
  }, [open, editing]);

  /** Filling in from a template must never overwrite something already written by hand. */
  function applyTemplate(c: ConditionTemplate) {
    setTemplate(c);
    setForm((f) => ({
      ...f,
      bodyRegion: f.bodyRegion || c.region,
      treatmentPlan: planTouched && f.treatmentPlan ? f.treatmentPlan : c.plan,
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        patientId,
        title: form.title,
        date: form.date,
        doctorId: form.doctorId || null,
        doctorName: doctors.find((d) => d.id === form.doctorId)?.name || null,
        bodyRegion: form.bodyRegion || null,
        side: form.side === 'Not applicable' ? null : form.side,
        painScore: form.painScore === '' ? null : Number(form.painScore),
        details: form.details || null,
        treatmentPlan: form.treatmentPlan || null,
        remarks: form.remarks || null,
      };
      const res = editing
        ? await api.put(`/diagnoses/${editing.id}`, payload)
        : await api.post('/diagnoses', payload);
      onSaved(res.data, editing ? null : template);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save this diagnosis.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit diagnosis' : 'New diagnosis'}
      wide
    >
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Diagnosis / condition" className="sm:col-span-2">
          <ConditionPicker
            value={form.title}
            onChange={(title) => setForm({ ...form, title })}
            onPick={applyTemplate}
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

        <Field label="Attending doctor">
          <select
            className="input"
            value={form.doctorId}
            onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
          >
            <option value="">Not assigned</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.specialization ? ` — ${d.specialization}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Body region">
          <select
            className="input"
            value={form.bodyRegion}
            onChange={(e) => setForm({ ...form, bodyRegion: e.target.value })}
          >
            <option value="">Not recorded</option>
            {BODY_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Side">
          <select
            className="input"
            value={form.side}
            onChange={(e) => setForm({ ...form, side: e.target.value })}
          >
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Pain today (0–10)" className="sm:col-span-2">
          <PainScale
            value={form.painScore}
            onChange={(painScore) => setForm({ ...form, painScore })}
          />
        </Field>

        <Field label="Clinical details" className="sm:col-span-2">
          <textarea
            className="input"
            rows={3}
            value={form.details}
            onChange={(e) => setForm({ ...form, details: e.target.value })}
            placeholder="History, onset, aggravating and relieving factors, findings on examination"
          />
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="label !mb-0">Treatment plan</label>
            {template && (
              <button
                type="button"
                className="text-xs font-medium text-brand-600 hover:underline"
                onClick={() => {
                  setForm((f) => ({ ...f, treatmentPlan: template.plan }));
                  setPlanTouched(false);
                }}
              >
                Reset to the standard plan for {template.name.toLowerCase()}
              </button>
            )}
          </div>
          <textarea
            className="input"
            rows={5}
            value={form.treatmentPlan}
            onChange={(e) => {
              setPlanTouched(true);
              setForm({ ...form, treatmentPlan: e.target.value });
            }}
            placeholder="Pick a condition above to fill this in, or write your own"
          />
          {template && !planTouched && (
            <p className="mt-1 text-xs text-emerald-700">
              Filled from the standard plan for {template.name.toLowerCase()} — edit it as needed.
            </p>
          )}
        </div>

        <Field label="Remarks" className="sm:col-span-2">
          <textarea
            className="input"
            rows={2}
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            placeholder="Precautions, referrals, anything to tell the treating therapist"
          />
        </Field>

        {template && !editing && (
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-ink-700 sm:col-span-2">
            A course for this condition usually runs{' '}
            <span className="font-semibold text-ink-900">{template.sessions} sessions</span>, one
            every {template.frequencyDays} day{template.frequencyDays === 1 ? '' : 's'}. You can
            set the package up straight after saving.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Update diagnosis' : 'Save diagnosis'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
