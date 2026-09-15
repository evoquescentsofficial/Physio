/**
 * The clinic's prescription pad, as data.
 *
 * These are the tick-box columns printed on the paper form. They are defaults rather than a
 * fixed list — the clinic can edit all three in Settings — so everything here is a starting
 * point that gets overridden by whatever is stored against the clinic.
 */

export const DEFAULT_DIAGNOSIS_OPTIONS = [
  'Low Back Pain',
  'Cervical Pain',
  'Frozen Shoulder',
  'Knee Pain',
  'Stroke',
  'Sciatica',
  'Facial Palsy',
  'Arthritis',
];

export const DEFAULT_EXERCISE_OPTIONS = [
  'Passive Movements',
  'Stretching',
  'Active Therapy',
  'Cardio Vascular Therapy',
  'Postural Alignment',
  'Spinal Stabilisation',
  'Mobilisation',
  'Thrust & Manipulation',
];

export const DEFAULT_MODALITY_OPTIONS = [
  'Ultrasound',
  'TENS',
  'Hot Pack',
  'Cold Pack',
  'Traction — Cervical',
  'Traction — Lumbar',
  'Taping',
  'EMS',
];

/** The printed heading, changeable per clinic. */
export const DEFAULT_FORM_TITLE = 'Physical Therapy Assessment & Prescription';

/**
 * SQLite has no array column, so lists travel as JSON text. Anything unreadable is treated as
 * "nothing recorded" rather than throwing — a corrupt row must not stop a patient's file opening.
 */
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function serializeList(items: string[] | null | undefined): string | null {
  const clean = (items || []).map((i) => i.trim()).filter(Boolean);
  return clean.length ? JSON.stringify(clean) : null;
}

/** One option per line is how the lists are edited in Settings — the textarea is the source. */
export function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Age as the clinic writes it on the form: whole years, and months for babies, who are a real
 * part of a physiotherapy caseload (torticollis, developmental delay).
 */
export function ageFromDob(dob: string | Date | null | undefined, now: Date = new Date()): string {
  if (!dob) return '';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '';

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return '';
  if (years === 0) return `${months} month${months === 1 ? '' : 's'}`;
  return `${years}`;
}
