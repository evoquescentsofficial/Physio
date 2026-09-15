import { FormEvent, useEffect, useState } from 'react';
import { Card, Field, PageHeader, currency } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import {
  DEFAULT_DIAGNOSIS_OPTIONS,
  DEFAULT_EXERCISE_OPTIONS,
  DEFAULT_FORM_TITLE,
  DEFAULT_MODALITY_OPTIONS,
  linesToList,
} from '../../../shared/prescription';

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
  const [lists, setLists] = useState({ diagnosis: '', exercises: '', modalities: '' });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(settings);
    setLists({
      diagnosis: (settings.diagnosisOptions || []).join('\n'),
      exercises: (settings.exerciseOptions || []).join('\n'),
      modalities: (settings.modalityOptions || []).join('\n'),
    });
  }, [settings]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
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
