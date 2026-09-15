import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Logo from '../components/Logo';
import { Attachment, Diagnosis, Doctor, Patient, TreatmentPackage } from '../types';
import { useSettings } from '../context/SettingsContext';
import { currency, formatDate } from '../components/ui';
import { netAmount } from '../../../shared/money';
import {
  DEFAULT_DIAGNOSIS_OPTIONS,
  DEFAULT_EXERCISE_OPTIONS,
  DEFAULT_FORM_TITLE,
  DEFAULT_MODALITY_OPTIONS,
  ageFromDob,
} from '../../../shared/prescription';

/** A written section of the form. Empty ones are dropped so the sheet never prints blank space. */
function Section({ label, value }: { label: string; value?: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="flex flex-wrap gap-x-2 border-b border-ink-300 py-1">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-700">
        {label}:
      </span>
      <span className="min-w-0 flex-1 basis-48 whitespace-pre-wrap text-[12px] leading-snug text-ink-900">
        {value}
      </span>
    </div>
  );
}

/** One of the pad's tick-box columns, printed with every option so the paper reads the same. */
function TickColumn({
  title,
  options,
  selected,
}: {
  title: string;
  options: string[];
  selected: string[];
}) {
  const known = new Set(options);
  const shown = [...options, ...selected.filter((s) => !known.has(s))];
  if (shown.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5 inline-block rounded-full bg-ink-900 px-3 py-0.5 text-[11px] font-bold text-white">
        {title}
      </div>
      <ul className="space-y-0.5">
        {shown.map((item) => {
          const ticked = selected.includes(item);
          return (
            <li key={item} className="flex items-center gap-1.5 text-[11.5px] leading-tight">
              <span
                className={`flex h-3 w-3 shrink-0 items-center justify-center border border-ink-700 text-[9px] font-black leading-none ${
                  ticked ? 'bg-ink-900 text-white' : 'text-transparent'
                }`}
              >
                ✓
              </span>
              <span className={ticked ? 'font-semibold text-ink-900' : 'text-ink-600'}>{item}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The clinic's prescription pad, printed.
 *
 * Laid out for A4: letterhead with the doctors' credentials, the patient line, the written
 * sections, the tick-box columns, the sessions already booked, what the package costs and what
 * is still owed, then the signature and contact strip. On screen it is the same sheet, so what
 * is checked here is what comes out of the printer.
 */
export default function Prescription() {
  const { id, diagnosisId } = useParams<{ id: string; diagnosisId: string }>();
  const { settings } = useSettings();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`/patients/${id}`), api.get('/doctors')])
      .then(([p, d]) => {
        if (cancelled) return;
        setPatient(p.data);
        setDoctors(d.data);
      })
      .catch(() => !cancelled && setError('This record could not be opened.'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <div className="p-6 text-sm text-red-700">{error}</div>;
  if (!patient) return <div className="p-6 text-sm text-ink-400">Loading…</div>;

  const diagnosis: Diagnosis | undefined = patient.diagnoses?.find((d) => d.id === diagnosisId);
  if (!diagnosis) {
    return (
      <div className="p-6 text-sm text-ink-600">
        That assessment is no longer on this patient's file.{' '}
        <Link className="text-brand-700 hover:underline" to={`/patients/${id}`}>
          Back to the patient
        </Link>
      </div>
    );
  }

  // The package this assessment led to, so the printed sheet carries the money the patient asks
  // about at the desk. Falls back to their most recent package when nothing was linked.
  const pkg: TreatmentPackage | undefined =
    patient.packages?.find((p) => p.diagnosisId === diagnosis.id) || patient.packages?.[0];

  const sessions = (patient.visits || [])
    .filter((v) => (pkg ? v.packageId === pkg.id : true))
    .slice()
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  const paid = pkg
    ? (pkg.payments || []).reduce((sum, p) => sum + netAmount(p), 0)
    : 0;
  const balance = pkg ? pkg.totalFee - paid : 0;

  const letterhead = doctors.filter((d) => d.onLetterhead);
  const signingDoctor =
    doctors.find((d) => d.id === diagnosis.doctorId) || letterhead[0] || null;

  const attachments: Attachment[] = diagnosis.attachments || [];
  const diagnosisOptions = settings.diagnosisOptions?.length
    ? settings.diagnosisOptions
    : DEFAULT_DIAGNOSIS_OPTIONS;
  const exerciseOptions = settings.exerciseOptions?.length
    ? settings.exerciseOptions
    : DEFAULT_EXERCISE_OPTIONS;
  const modalityOptions = settings.modalityOptions?.length
    ? settings.modalityOptions
    : DEFAULT_MODALITY_OPTIONS;
  const age = ageFromDob(patient.dob);

  // Two columns of dates, the way the paper sheet is ruled.
  const rows = Math.max(6, Math.ceil(sessions.length / 2));
  const leftDates = sessions.slice(0, rows);
  const rightDates = sessions.slice(rows, rows * 2);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/patients/${id}`} className="text-sm text-brand-700 hover:underline">
          ← Back to {patient.name}
        </Link>
        <div className="flex items-center gap-3">
          {/* Some browsers refuse a print dialog a page asks for, and do so silently. */}
          <span className="text-xs text-ink-400">
            Nothing happens? Press Ctrl+P (⌘P on a Mac)
          </span>
          <button className="btn-primary" onClick={() => window.print()}>
            Print this prescription
          </button>
        </div>
      </div>

      <div className="print-sheet mx-auto max-w-[210mm] bg-white p-8 text-ink-900 shadow-card print:max-w-none print:p-0 print:shadow-none">
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-6 border-b-4 border-ink-900 pb-3">
          <div className="flex max-w-[45%] items-center gap-3">
            <Logo className="h-14 w-14 shrink-0" color="#111827" />
            <div>
              <div className="text-xl font-black uppercase leading-tight tracking-tight">
                {settings.clinicName}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600">
                Physiotherapy &amp; Rehab Center
              </div>
            </div>
          </div>
          {letterhead.length > 0 && (
            <div className="flex gap-6">
              {letterhead.slice(0, 2).map((d) => (
                <div
                  key={d.id}
                  className="max-w-[10.5rem] border-l border-ink-300 pl-3 text-[9.5px] leading-snug"
                >
                  <div className="text-[12px] font-bold leading-tight">{d.name}</div>
                  {(d.credentials || d.qualification || '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line, i) => (
                      <div key={i} className="text-ink-700">
                        {line}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </header>

        <h1 className="my-3 text-center text-lg font-black uppercase tracking-tight">
          {settings.formTitle || DEFAULT_FORM_TITLE}
        </h1>

        {/* Name, date, age and sex on one line, as on the pad */}
        <div className="mb-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b-2 border-ink-900 pb-1.5 text-[12px]">
          <span className="flex-1">
            <span className="text-[11px] font-bold uppercase text-ink-700">Name: </span>
            <span className="font-semibold">{patient.name}</span>
            {patient.attendantName ? (
              <span className="text-ink-600"> (with {patient.attendantName})</span>
            ) : null}
          </span>
          <span>
            <span className="text-[11px] font-bold uppercase text-ink-700">Date: </span>
            {formatDate(diagnosis.date)}
          </span>
          <span>
            <span className="text-[11px] font-bold uppercase text-ink-700">Age / Sex: </span>
            {[age, patient.gender].filter(Boolean).join(' / ') || '—'}
          </span>
        </div>

        <Section label="History" value={diagnosis.history} />
        <Section label="Initial evaluation & examination" value={diagnosis.evaluation} />
        <Section label="Diagnosis" value={diagnosis.title} />
        <Section
          label="Site"
          value={[diagnosis.bodyRegion, diagnosis.side].filter(Boolean).join(' · ') || null}
        />
        <Section
          label="Pain"
          value={diagnosis.painScore != null ? `${diagnosis.painScore} / 10` : null}
        />

        {/* Tick-box columns */}
        <div className="print-keep my-3 grid grid-cols-3 gap-4">
          <TickColumn
            title="Diagnosis"
            options={diagnosisOptions}
            selected={diagnosis.checkedDiagnoses || []}
          />
          <TickColumn
            title="Therapeutic exercises"
            options={exerciseOptions}
            selected={diagnosis.exercises || []}
          />
          <TickColumn
            title="Modalities"
            options={modalityOptions}
            selected={diagnosis.modalities || []}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: the written prescription */}
          <div>
            <Section label="Treatment plan" value={diagnosis.treatmentPlan} />
            <Section label="Instructions" value={diagnosis.instructions} />
            <Section label="Referred to" value={diagnosis.referredTo} />
            <Section
              label="Lab investigations / radiological findings"
              value={diagnosis.labFindings}
            />
            <Section label="Medications" value={diagnosis.medications} />
            <Section label="Remarks" value={diagnosis.remarks} />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-x-2 border-b border-ink-300 py-1">
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-700">
                  Reports on file:
                </span>
                <span className="min-w-0 flex-1 basis-48 text-[12px] leading-snug">
                  {attachments.map((a) => a.filename).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Right: the sessions booked and what they cost */}
          <div className="print-keep">
            <div className="mb-1 text-[12px] font-bold underline">Physiotherapy sessions</div>
            <table className="w-full border border-ink-700 text-[11px]">
              <thead>
                <tr>
                  <th className="w-1/2 border border-ink-700 px-2 py-0.5 text-left font-bold">
                    Date
                  </th>
                  <th className="border border-ink-700 px-2 py-0.5 text-left font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }).map((_, i) => (
                  <tr key={i}>
                    <td className="h-5 border border-ink-700 px-2">
                      {leftDates[i] ? formatDate(leftDates[i].scheduledDate) : ''}
                    </td>
                    <td className="h-5 border border-ink-700 px-2">
                      {rightDates[i] ? formatDate(rightDates[i].scheduledDate) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 text-[12px] font-black uppercase">Packages</div>
            <div className="flex flex-wrap gap-x-6 text-[11.5px]">
              <span>
                <span className="font-semibold">Consultation fee:</span>{' '}
                {currency(settings.checkupFee)}
              </span>
              <span>
                <span className="font-semibold">No. of sessions:</span>{' '}
                {pkg ? pkg.totalSessions : '—'}
              </span>
            </div>
            <div className="mt-1.5 rounded-lg border-2 border-ink-700 px-3 py-2 text-[12px]">
              <div className="flex justify-between border-b border-ink-300 py-0.5">
                <span className="font-semibold">Total amount:</span>
                <span>{pkg ? currency(pkg.totalFee) : '—'}</span>
              </div>
              <div className="flex justify-between border-b border-ink-300 py-0.5">
                <span className="font-semibold">Paid:</span>
                <span>{pkg ? currency(paid) : '—'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="font-semibold">Balance:</span>
                <span className="font-bold">{pkg ? currency(balance) : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signature and timings */}
        <div className="print-keep mt-6 flex flex-wrap items-end justify-between gap-4">
          <div className="text-[12px]">
            <div className="mb-1 h-6 w-56 border-b border-ink-900" />
            <span className="font-bold">Signature</span>
            {signingDoctor && (
              <span className="text-ink-600"> — {signingDoctor.name}</span>
            )}
          </div>
          {settings.timings && (
            <div className="rounded-full bg-ink-900 px-3 py-1 text-[11px] font-semibold text-white">
              {settings.timings}
            </div>
          )}
        </div>

        {/* Contact strip */}
        <footer className="mt-4 border-t-4 border-ink-900 pt-2 text-[11px]">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-semibold">
            {settings.phone && <span>☎ {settings.phone}</span>}
            {settings.address && <span>⌂ {settings.address}</span>}
            {settings.email && <span>✉ {settings.email}</span>}
          </div>
          {(settings.website || settings.instagram) && (
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-5 bg-ink-900 py-1 text-[10.5px] text-white">
              {settings.website && <span>{settings.website}</span>}
              {settings.instagram && <span>{settings.instagram}</span>}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
