import { FormEvent, useEffect, useState } from 'react';
import { Card, Field, PageHeader, currency } from '../components/ui';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(settings);
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
        subtitle="Clinic details and default fees used across the app"
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
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
              />
            </Field>
            <Field label="Address">
              <textarea
                className="input"
                rows={3}
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
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

          <div className="mt-5 flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
            {saved && <span className="text-sm font-medium text-emerald-600">Saved ✓</span>}
          </div>
        </Card>
      </form>
    </div>
  );
}
