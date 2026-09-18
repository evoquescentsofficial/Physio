import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Field, FormSection, Modal, ModalActions, SegmentedControl } from './ui';
import FormIcon from './FormIcon';
import { Attachment, Diagnosis, Doctor } from '../types';
import {
  BODY_REGIONS,
  ConditionTemplate,
  SIDES,
  findCondition,
  searchConditions,
} from '../../../shared/conditions';
import {
  DEFAULT_DIAGNOSIS_OPTIONS,
  DEFAULT_EXERCISE_OPTIONS,
  DEFAULT_MODALITY_OPTIONS,
} from '../../../shared/prescription';
import { useSettings } from '../context/SettingsContext';
import AttachmentList from './AttachmentList';

export interface PrescriptionFormValues {
  title: string;
  date: string;
  doctorId: string;
  bodyRegion: string;
  side: string;
  painScore: number | '';
  history: string;
  evaluation: string;
  details: string;
  treatmentPlan: string;
  instructions: string;
  referredTo: string;
  labFindings: string;
  medications: string;
  remarks: string;
  checkedDiagnoses: string[];
  exercises: string[];
  modalities: string[];
  /** A per-patient dosage override for ticked exercises, keyed by exercise name. */
  exerciseNotes: Record<string, string>;
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
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
          <FormIcon name="search" className="h-[15px] w-[15px]" />
        </span>
        <input
          className="input pl-9"
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
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-ink-100 bg-white py-1.5 shadow-2xl">
          {matches.map((c, i) => (
            <li key={c.name}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(c)}
                className={`mx-1.5 flex w-[calc(100%-0.75rem)] items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
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
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }).map((_, n) => {
          const selected = value === n;
          const tone = n <= 3 ? 'bg-emerald-500' : n <= 6 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(selected ? '' : n)}
              aria-label={`Pain ${n} out of 10`}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                selected
                  ? `${tone} text-white shadow-soft scale-105`
                  : 'bg-white text-ink-500 border border-ink-200 hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-ink-500">
        <span className="font-medium text-ink-700">{label}</span>
        {value !== '' && <span className="text-ink-400"> — click again to clear</span>}
      </div>
    </div>
  );
}

/** One of the pad's tick-box columns. Anything ticked that is no longer on the list still shows. */
function TickColumn({
  title,
  options,
  selected,
  onToggle,
  onAdd,
  notes,
  onNoteChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onAdd: (item: string) => void;
  /** Per-item free text, e.g. a patient-specific dosage. Only the exercises column uses this. */
  notes?: Record<string, string>;
  onNoteChange?: (item: string, value: string) => void;
}) {
  const [extra, setExtra] = useState('');
  const known = new Set(options);
  const shown = [...options, ...selected.filter((s) => !known.has(s))];

  function add() {
    const value = extra.trim();
    if (!value) return;
    onAdd(value);
    setExtra('');
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/70 px-3.5 py-2.5">
        <span className="text-[13px] font-bold text-ink-800">{title}</span>
        {selected.length > 0 && (
          <span className="ml-auto rounded-full bg-brand-100 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
            {selected.length}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        {shown.map((item) => {
          const checked = selected.includes(item);
          return (
            <div key={item}>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
                  checked ? 'bg-brand-50 text-brand-900' : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={checked}
                  onChange={() => onToggle(item)}
                />
                {item}
              </label>
              {checked && onNoteChange && (
                <input
                  className="input mb-1 ml-7 !w-[calc(100%-1.75rem)] !py-1 !text-xs"
                  value={notes?.[item] || ''}
                  onChange={(e) => onNoteChange(item, e.target.value)}
                  placeholder="Dosage for this patient (leave blank for the usual)"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          );
        })}
        <div className="flex gap-1.5 pt-1.5">
          <input
            className="input !py-1.5 !text-xs"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add another…"
          />
          <button type="button" className="btn-secondary !px-2.5 !py-1.5 !text-xs" onClick={add}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The clinic's paper prescription pad, on screen: history, examination, diagnosis, the three
 * tick-box columns, instructions, referral, investigations and medications — in the order they
 * appear on the printed form, so filling it in feels like filling in the paper.
 */
export default function PrescriptionForm({
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
  const { settings } = useSettings();

  const emptyForm: PrescriptionFormValues = {
    title: '',
    date: new Date().toISOString().slice(0, 10),
    doctorId: '',
    bodyRegion: '',
    side: 'Not applicable',
    painScore: '',
    history: '',
    evaluation: '',
    details: '',
    treatmentPlan: '',
    instructions: '',
    referredTo: '',
    labFindings: '',
    medications: '',
    remarks: '',
    checkedDiagnoses: [],
    exercises: [],
    modalities: [],
    exerciseNotes: {},
  };

  const [form, setForm] = useState<PrescriptionFormValues>(emptyForm);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [template, setTemplate] = useState<ConditionTemplate | null>(null);
  const [planTouched, setPlanTouched] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const diagnosisOptions = settings.diagnosisOptions?.length
    ? settings.diagnosisOptions
    : DEFAULT_DIAGNOSIS_OPTIONS;
  const exerciseOptions = settings.exerciseOptions?.length
    ? settings.exerciseOptions
    : DEFAULT_EXERCISE_OPTIONS;
  const modalityOptions = settings.modalityOptions?.length
    ? settings.modalityOptions
    : DEFAULT_MODALITY_OPTIONS;

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
        history: editing.history || '',
        evaluation: editing.evaluation || '',
        details: editing.details || '',
        treatmentPlan: editing.treatmentPlan || '',
        instructions: editing.instructions || '',
        referredTo: editing.referredTo || '',
        labFindings: editing.labFindings || '',
        medications: editing.medications || '',
        remarks: editing.remarks || '',
        checkedDiagnoses: editing.checkedDiagnoses || [],
        exercises: editing.exercises || [],
        modalities: editing.modalities || [],
        exerciseNotes: editing.exerciseNotes || {},
      });
      setAttachments(editing.attachments || []);
      setPlanTouched(true);
      setTemplate(findCondition(editing.title) || null);
    } else {
      setForm(emptyForm);
      setAttachments([]);
      setPlanTouched(false);
      setTemplate(null);
    }
    // Re-filling on every keystroke would fight the typist; only a different record refills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  /** Filling in from a template must never overwrite something already written by hand. */
  function applyTemplate(c: ConditionTemplate) {
    setTemplate(c);
    setForm((f) => ({
      ...f,
      bodyRegion: f.bodyRegion || c.region,
      treatmentPlan: planTouched && f.treatmentPlan ? f.treatmentPlan : c.plan,
      // Ticking the matching box saves doing it by hand for the common conditions.
      checkedDiagnoses: f.checkedDiagnoses.length
        ? f.checkedDiagnoses
        : diagnosisOptions.filter((o) => c.name.toLowerCase().includes(o.toLowerCase())),
    }));
  }

  function toggle(field: 'checkedDiagnoses' | 'exercises' | 'modalities', item: string) {
    setForm((f) => {
      const nowSelected = f[field].includes(item);
      // Untick an exercise and its per-patient dosage note goes with it — it would otherwise
      // linger unseen and reappear if the same exercise were ticked again later.
      const exerciseNotes =
        field === 'exercises' && nowSelected
          ? Object.fromEntries(Object.entries(f.exerciseNotes).filter(([k]) => k !== item))
          : f.exerciseNotes;
      return {
        ...f,
        [field]: nowSelected ? f[field].filter((i) => i !== item) : [...f[field], item],
        exerciseNotes,
      };
    });
  }

  function add(field: 'checkedDiagnoses' | 'exercises' | 'modalities', item: string) {
    setForm((f) => (f[field].includes(item) ? f : { ...f, [field]: [...f[field], item] }));
  }

  function setExerciseNote(item: string, value: string) {
    setForm((f) => ({ ...f, exerciseNotes: { ...f.exerciseNotes, [item]: value } }));
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
        history: form.history || null,
        evaluation: form.evaluation || null,
        details: form.details || null,
        treatmentPlan: form.treatmentPlan || null,
        instructions: form.instructions || null,
        referredTo: form.referredTo || null,
        labFindings: form.labFindings || null,
        medications: form.medications || null,
        remarks: form.remarks || null,
        checkedDiagnoses: form.checkedDiagnoses,
        exercises: form.exercises,
        modalities: form.modalities,
        // Only ever send notes for exercises still ticked, and only the ones actually
        // written in — a blank box means "use the clinic's usual dosage".
        exerciseNotes: Object.fromEntries(
          Object.entries(form.exerciseNotes).filter(
            ([name, note]) => form.exercises.includes(name) && note.trim()
          )
        ),
      };
      const res = editing
        ? await api.put(`/diagnoses/${editing.id}`, payload)
        : await api.post('/diagnoses', payload);
      onSaved(res.data, editing ? null : template);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save this assessment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit assessment & prescription' : 'New assessment & prescription'}
      description={
        editing
          ? 'Update the diagnosis, treatment plan and instructions for this record.'
          : 'History, examination, diagnosis and treatment plan — just like the paper pad.'
      }
      icon={<FormIcon name="stethoscope" />}
      size="xl"
    >
      <form onSubmit={save} className="space-y-5">
        <FormSection icon={<FormIcon name="calendar" />} title="Visit info">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </FormSection>

        <FormSection icon={<FormIcon name="stethoscope" />} title="History & examination">
          <div className="space-y-4">
            <Field label="History">
              <textarea
                className="input"
                rows={2}
                value={form.history}
                onChange={(e) => setForm({ ...form, history: e.target.value })}
                placeholder="How it started, how long ago, what makes it worse or better, past episodes"
              />
            </Field>
            <Field label="Initial evaluation & examination">
              <textarea
                className="input"
                rows={3}
                value={form.evaluation}
                onChange={(e) => setForm({ ...form, evaluation: e.target.value })}
                placeholder="Range of motion, strength, special tests, posture, gait"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection icon={<FormIcon name="target" />} title="Diagnosis">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Diagnosis" className="sm:col-span-2">
              <ConditionPicker
                value={form.title}
                onChange={(title) => setForm({ ...form, title })}
                onPick={applyTemplate}
              />
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
              <SegmentedControl
                value={form.side}
                onChange={(side) => setForm({ ...form, side })}
                options={SIDES.map((s) => ({ label: s, value: s }))}
              />
            </Field>
            <Field label="Pain today (0–10)" className="sm:col-span-2">
              <PainScale
                value={form.painScore}
                onChange={(painScore) => setForm({ ...form, painScore })}
              />
            </Field>
          </div>
        </FormSection>

        {/* The three tick-box columns, exactly as they run across the paper. */}
        <FormSection icon={<FormIcon name="activity" />} title="Treatment protocol">
          <div className="grid gap-4 sm:grid-cols-3">
            <TickColumn
              title="Diagnosis"
              options={diagnosisOptions}
              selected={form.checkedDiagnoses}
              onToggle={(i) => toggle('checkedDiagnoses', i)}
              onAdd={(i) => add('checkedDiagnoses', i)}
            />
            <TickColumn
              title="Therapeutic exercises"
              options={exerciseOptions}
              selected={form.exercises}
              onToggle={(i) => toggle('exercises', i)}
              onAdd={(i) => add('exercises', i)}
              notes={form.exerciseNotes}
              onNoteChange={setExerciseNote}
            />
            <TickColumn
              title="Modalities"
              options={modalityOptions}
              selected={form.modalities}
              onToggle={(i) => toggle('modalities', i)}
              onAdd={(i) => add('modalities', i)}
            />
          </div>
        </FormSection>

        <FormSection icon={<FormIcon name="clipboard" />} title="Treatment plan" tone="brand">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-ink-500">What the course of treatment will involve</span>
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
            rows={4}
            value={form.treatmentPlan}
            onChange={(e) => {
              setPlanTouched(true);
              setForm({ ...form, treatmentPlan: e.target.value });
            }}
            placeholder="Pick a condition above to fill this in, or write your own"
          />
          {template && !planTouched && (
            <p className="mt-1.5 text-xs text-emerald-700">
              Filled from the standard plan for {template.name.toLowerCase()} — edit it as needed.
            </p>
          )}
        </FormSection>

        <FormSection icon={<FormIcon name="message" />} title="Instructions & referrals">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instructions" className="sm:col-span-2">
              <textarea
                className="input"
                rows={2}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="What the patient should do at home: rest, posture, ice, exercises, precautions"
              />
            </Field>
            <Field label="Referred to">
              <input
                className="input"
                value={form.referredTo}
                onChange={(e) => setForm({ ...form, referredTo: e.target.value })}
                placeholder="Orthopaedic surgeon, neurologist, imaging centre…"
              />
            </Field>
            <Field label="Medications">
              <input
                className="input"
                value={form.medications}
                onChange={(e) => setForm({ ...form, medications: e.target.value })}
                placeholder="Prescribed or already being taken"
              />
            </Field>
            <Field label="Lab investigations / radiological findings" className="sm:col-span-2">
              <textarea
                className="input"
                rows={2}
                value={form.labFindings}
                onChange={(e) => setForm({ ...form, labFindings: e.target.value })}
                placeholder="X-ray, MRI, blood work — what was asked for and what it showed"
              />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <textarea
                className="input"
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Anything to tell the treating therapist"
              />
            </Field>
          </div>
        </FormSection>

        {/* Reports can only be attached to a record that exists, so this appears when editing. */}
        <FormSection icon={<FormIcon name="paperclip" />} title="Reports & scans">
          {editing ? (
            <AttachmentList
              patientId={patientId}
              diagnosisId={editing.id}
              attachments={attachments}
              onChange={setAttachments}
            />
          ) : (
            <p className="rounded-lg bg-white px-4 py-3 text-sm text-ink-500">
              Save this assessment first, then reopen it to attach X-rays, MRI reports or lab PDFs.
            </p>
          )}
        </FormSection>

        {template && !editing && (
          <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5 text-sm text-ink-700">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-soft">
              <FormIcon name="calendar" className="h-4 w-4" />
            </span>
            <span>
              A course for this condition usually runs{' '}
              <span className="font-semibold text-ink-900">{template.sessions} sessions</span>, one
              every {template.frequencyDays} day{template.frequencyDays === 1 ? '' : 's'}. You can
              set the package up straight after saving.
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <ModalActions>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Update assessment' : 'Save assessment'}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
