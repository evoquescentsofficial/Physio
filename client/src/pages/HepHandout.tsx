import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Logo from '../components/Logo';
import { Diagnosis, Patient } from '../types';
import { useSettings } from '../context/SettingsContext';
import { formatDate } from '../components/ui';
import { resolveExerciseForPatient } from '../../../shared/exerciseLibrary';

/**
 * The home exercise program (HEP), printed — what the patient actually takes away from the
 * assessment. Pulled from the same "Therapeutic exercises" tick column as the prescription
 * pad, but written for the patient rather than the clinic file: plain instructions and a
 * dosage for each one, in the same order they were ticked.
 */
export default function HepHandout() {
  const { id, diagnosisId } = useParams<{ id: string; diagnosisId: string }>();
  const { settings } = useSettings();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/patients/${id}`)
      .then((p) => !cancelled && setPatient(p.data))
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

  const exercises = diagnosis.exercises || [];

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/patients/${id}`} className="text-sm text-brand-700 hover:underline">
          ← Back to {patient.name}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-400">Nothing happens? Press Ctrl+P (⌘P on a Mac)</span>
          <button className="btn-primary" onClick={() => window.print()}>
            Print this handout
          </button>
        </div>
      </div>

      <div className="print-sheet mx-auto max-w-[210mm] bg-white p-8 text-ink-900 shadow-card print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center gap-3 border-b-4 border-brand-700 pb-3">
          <Logo className="h-12 w-12 shrink-0" color="#1d45c9" />
          <div>
            <div className="text-lg font-black uppercase leading-tight tracking-tight text-brand-800">
              {settings.clinicName}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
              Your home exercise program
            </div>
          </div>
        </header>

        <div className="mb-1 mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b-2 border-ink-900 pb-1.5 text-[12px]">
          <span className="flex-1">
            <span className="text-[11px] font-bold uppercase text-ink-700">Name: </span>
            <span className="font-semibold">{patient.name}</span>
          </span>
          <span>
            <span className="text-[11px] font-bold uppercase text-ink-700">Date: </span>
            {formatDate(diagnosis.date)}
          </span>
          <span>
            <span className="text-[11px] font-bold uppercase text-ink-700">For: </span>
            {diagnosis.title}
          </span>
        </div>

        <p className="mt-3 rounded-lg bg-brand-50 px-4 py-2.5 text-[12px] leading-snug text-ink-700">
          Do the exercises below exactly as shown, in order. Stop and contact the clinic if any
          exercise causes sharp or worsening pain.
        </p>

        {exercises.length === 0 ? (
          <p className="mt-6 rounded-lg bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
            No exercises were prescribed on this assessment.
          </p>
        ) : (
          <ol className="print-keep mt-4 space-y-3">
            {exercises.map((name, i) => {
              const entry = resolveExerciseForPatient(
                name,
                settings.exerciseLibrary,
                diagnosis.exerciseNotes?.[name]
              );
              return (
                <li
                  key={name}
                  className={`flex gap-3 rounded-xl border px-4 py-3 ${
                    entry.homeExercise ? 'border-ink-200' : 'border-ink-100 bg-ink-50'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[12px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-ink-900">{name}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-ink-700">
                      {entry.instructions}
                    </div>
                    <div
                      className={`mt-1 text-[11.5px] font-semibold ${
                        entry.homeExercise ? 'text-brand-700' : 'text-ink-400'
                      }`}
                    >
                      {entry.dosage}
                      {diagnosis.exerciseNotes?.[name]?.trim() && (
                        <span className="ml-1 font-normal italic text-ink-400">
                          (set for this patient)
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {diagnosis.instructions && (
          <div className="print-keep mt-5 border-t border-ink-200 pt-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-700">
              Additional instructions from your therapist
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug text-ink-800">
              {diagnosis.instructions}
            </p>
          </div>
        )}

        <footer className="mt-6 border-t-4 border-brand-700 pt-2 text-[11px]">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-semibold text-ink-700">
            {settings.phone && <span>☎ {settings.phone}</span>}
            {settings.address && <span>⌂ {settings.address}</span>}
            {settings.email && <span>✉ {settings.email}</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
