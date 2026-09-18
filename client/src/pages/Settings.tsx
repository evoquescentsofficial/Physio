import { FormEvent, useEffect, useState } from 'react';
import { Card, Field, PageHeader, currency } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { DEFAULT_DEPARTMENTS } from '../../../shared/commission';
import {
  DEFAULT_DIAGNOSIS_OPTIONS,
  DEFAULT_EXERCISE_OPTIONS,
  DEFAULT_FORM_TITLE,
  DEFAULT_MODALITY_OPTIONS,
  linesToList,
} from '../../../shared/prescription';
import {
  EXERCISE_LIBRARY,
  ExerciseEntry,
  ExerciseOverrides,
  GENERIC_FALLBACK,
} from '../../../shared/exerciseLibrary';

function isDefaultEntry(name: string, entry: ExerciseEntry) {
  const base = EXERCISE_LIBRARY[name] || GENERIC_FALLBACK;
  return (
    entry.instructions === base.instructions &&
    entry.dosage === base.dosage &&
    entry.homeExercise === base.homeExercise
  );
}

/** One exercise's editable entry for the home exercise handout, defaulting to the built-in copy. */
function ExerciseLibraryRow({
  name,
  entry,
  onChange,
}: {
  name: string;
  entry: ExerciseEntry;
  onChange: (patch: Partial<ExerciseEntry>) => void;
}) {
  const customized = !isDefaultEntry(name, entry);
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-ink-900">{name}</span>
        {customized && (
          <span className="badge bg-brand-100 text-brand-700">Customized</span>
        )}
      </div>
      <div className="space-y-3">
        <Field label="Instructions (what the patient reads)">
          <textarea
            className="input !text-xs"
            rows={2}
            value={entry.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dosage">
            <input
              className="input !text-xs"
              value={entry.dosage}
              onChange={(e) => onChange({ dosage: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-xs text-ink-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={!entry.homeExercise}
              onChange={(e) => onChange({ homeExercise: !e.target.checked })}
            />
            Done by the therapist in clinic, not a home exercise
          </label>
        </div>
      </div>
    </div>
  );
}

/** The tick-box columns are edited as plain lines — one option per line, in printing order. */
function ListEditor({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input font-mono !text-xs"
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fallback.join('\n')}
      />
      <p className="mt-1 text-xs text-ink-500">
        {hint} Leave it empty to use the standard list ({fallback.length} items).
      </p>
    </div>
  );
}

export default function Settings() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState(settings);
  const [lists, setLists] = useState({
    diagnosis: '',
    exercises: '',
    modalities: '',
    departments: '',
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [libraryDrafts, setLibraryDrafts] = useState<ExerciseOverrides>({});

  useEffect(() => {
    setForm(settings);
    setLists({
      diagnosis: (settings.diagnosisOptions || []).join('\n'),
      exercises: (settings.exerciseOptions || []).join('\n'),
      modalities: (settings.modalityOptions || []).join('\n'),
      departments: (settings.departmentOptions || []).join('\n'),
    });
    setLibraryDrafts(settings.exerciseLibrary || {});
  }, [settings]);

  // The rows shown track whatever is currently in the exercise names box, live — add a new
  // exercise there and it gets an instructions row immediately, no save round-trip needed.
  const exerciseNames = linesToList(lists.exercises).length
    ? linesToList(lists.exercises)
    : DEFAULT_EXERCISE_OPTIONS;

  function libraryEntry(name: string): ExerciseEntry {
    return libraryDrafts[name] || EXERCISE_LIBRARY[name] || GENERIC_FALLBACK;
  }

  function updateLibraryEntry(name: string, patch: Partial<ExerciseEntry>) {
    setLibraryDrafts((prev) => ({ ...prev, [name]: { ...libraryEntry(name), ...patch } }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Only exercises actually rewritten are saved — anything left matching the built-in
      // copy is omitted, so it keeps tracking the standard library rather than freezing a
      // copy of it the clinic never meant to customize.
      const exerciseLibrary: ExerciseOverrides = {};
      for (const name of exerciseNames) {
        const entry = libraryEntry(name);
        if (!isDefaultEntry(name, entry)) exerciseLibrary[name] = entry;
      }

      await save({
        clinicName: form.clinicName,
        phone: form.phone || null,
        address: form.address || null,
        checkupFee: Number(form.checkupFee),
        defaultSessionFee: Number(form.defaultSessionFee),
        email: form.email || null,
        website: form.website || null,
        instagram: form.instagram || null,
        timings: form.timings || null,
        formTitle: form.formTitle || null,
        diagnosisOptions: linesToList(lists.diagnosis),
        exerciseOptions: linesToList(lists.exercises),
        modalityOptions: linesToList(lists.modalities),
        departmentOptions: linesToList(lists.departments),
        exerciseLibrary,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Clinic details, default fees, and what appears on the printed prescription"
      />

      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 font-semibold text-ink-900">Clinic details</h3>
            <div className="space-y-4">
              <Field label="Clinic name">
                <input
                  className="input"
                  value={form.clinicName}
                  onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                  required
                />
              </Field>
              <Field label="Phone">
                <input
                  className="input"
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0301-8737071 / 0342-7076622"
                />
              </Field>
              <Field label="Address">
                <textarea
                  className="input"
                  rows={2}
                  value={form.address || ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  className="input"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-1 font-semibold text-ink-900">Default fees</h3>
            <p className="mb-4 text-sm text-ink-500">
              These pre-fill the forms so staff type less. Any fee can still be changed for an
              individual patient.
            </p>
            <div className="space-y-4">
              <Field label="Checkup fee (first visit)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.checkupFee}
                  onChange={(e) => setForm({ ...form, checkupFee: Number(e.target.value) })}
                />
              </Field>
              <Field label="Default fee per session">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.defaultSessionFee}
                  onChange={(e) => setForm({ ...form, defaultSessionFee: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="mt-5 rounded-lg bg-brand-50 p-4 text-sm text-ink-700">
              A 10-session package at this rate would total{' '}
              <span className="font-bold text-brand-700">
                {currency(form.defaultSessionFee * 10)}
              </span>
              .
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="mb-1 font-semibold text-ink-900">Printed prescription</h3>
          <p className="mb-4 text-sm text-ink-500">
            What goes on the assessment sheet when it is printed. The doctors shown across the top
            are the ones marked <span className="font-medium">“show on prescription”</span> in the
            Doctors section.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Heading">
              <input
                className="input"
                value={form.formTitle || ''}
                onChange={(e) => setForm({ ...form, formTitle: e.target.value })}
                placeholder={DEFAULT_FORM_TITLE}
              />
            </Field>
            <Field label="Timings">
              <input
                className="input"
                value={form.timings || ''}
                onChange={(e) => setForm({ ...form, timings: e.target.value })}
                placeholder="6pm to 9pm (Monday to Saturday) · Sunday closed"
              />
            </Field>
            <Field label="Website / Facebook">
              <input
                className="input"
                value={form.website || ''}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="www.fb.com/physiofitnesscentre"
              />
            </Field>
            <Field label="Instagram">
              <input
                className="input"
                value={form.instagram || ''}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                placeholder="@physio_fitness_centre"
              />
            </Field>
          </div>

          <h4 className="mb-1 mt-6 font-semibold text-ink-900">Departments</h4>
          <p className="mb-4 text-sm text-ink-500">
            The parts of the clinic a doctor can be assigned to. One per line.
          </p>
          <div className="max-w-md">
            <ListEditor
              label="Departments"
              hint="A doctor can belong to more than one."
              value={lists.departments}
              fallback={DEFAULT_DEPARTMENTS}
              onChange={(v) => setLists({ ...lists, departments: v })}
            />
          </div>

          <h4 className="mb-1 mt-6 font-semibold text-ink-900">Tick-box columns</h4>
          <p className="mb-4 text-sm text-ink-500">
            The three columns on the prescription. Add or remove lines here and every new
            assessment offers the new list.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <ListEditor
              label="Diagnosis"
              hint="The conditions ticked most often."
              value={lists.diagnosis}
              fallback={DEFAULT_DIAGNOSIS_OPTIONS}
              onChange={(v) => setLists({ ...lists, diagnosis: v })}
            />
            <ListEditor
              label="Therapeutic exercises"
              hint="What the therapist does in the session."
              value={lists.exercises}
              fallback={DEFAULT_EXERCISE_OPTIONS}
              onChange={(v) => setLists({ ...lists, exercises: v })}
            />
            <ListEditor
              label="Modalities"
              hint="Machines and applications used."
              value={lists.modalities}
              fallback={DEFAULT_MODALITY_OPTIONS}
              onChange={(v) => setLists({ ...lists, modalities: v })}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 font-semibold text-ink-900">Home exercise instructions</h3>
          <p className="mb-4 text-sm text-ink-500">
            What the printed home exercise handout says for each exercise above. Shown pre-filled
            with the standard wording — edit a field to override it for this clinic, or leave it
            as-is to keep using the standard one.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {exerciseNames.map((name) => (
              <ExerciseLibraryRow
                key={name}
                name={name}
                entry={libraryEntry(name)}
                onChange={(patch) => updateLibraryEntry(name, patch)}
              />
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
          {saved && <span className="text-sm font-medium text-emerald-600">Saved ✓</span>}
        </div>
      </form>
    </div>
  );
}
