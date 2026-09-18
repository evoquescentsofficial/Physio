/**
 * What each therapeutic exercise actually means for a patient at home: plain instructions and
 * a sensible dosage, keyed by the exercise's name on the prescription pad.
 *
 * The "Therapeutic exercises" tick column mixes things a patient does themselves with things
 * the therapist does to them — mobilisation and manipulation are hands-on techniques performed
 * in clinic, not home exercises. `homeExercise: false` marks those, so the handout says so
 * plainly instead of asking a patient to attempt a manual technique alone at home.
 *
 * Anything ticked that is not in this library (a custom-typed exercise, or a clinic-specific
 * one added in Settings) still appears on the handout — just without a pre-written dosage,
 * so there is room for the therapist to write it in by hand.
 */

export interface ExerciseEntry {
  instructions: string;
  dosage: string;
  homeExercise: boolean;
}

export const EXERCISE_LIBRARY: Record<string, ExerciseEntry> = {
  'Passive Movements': {
    instructions:
      'A family member gently moves the affected joint through its full range while you stay relaxed. The joint should never be forced past a comfortable range.',
    dosage: '10 slow repetitions, once or twice a day',
    homeExercise: true,
  },
  Stretching: {
    instructions:
      'Ease into each stretch until you feel a gentle pull, not pain, and hold still — do not bounce.',
    dosage: 'Hold 20–30 seconds, 3 times, twice a day',
    homeExercise: true,
  },
  'Active Therapy': {
    instructions:
      'Move the joint through its full pain-free range using your own muscles, at a slow, controlled pace.',
    dosage: '10–15 repetitions, 2–3 sets, once a day',
    homeExercise: true,
  },
  'Cardio Vascular Therapy': {
    instructions:
      'Light aerobic activity — a brisk walk or stationary cycling — at a pace where you can still hold a conversation.',
    dosage: '15–20 minutes, 4–5 times a week',
    homeExercise: true,
  },
  'Postural Alignment': {
    instructions:
      'Practise sitting and standing tall — ears over shoulders, shoulders over hips. A mirror helps at first.',
    dosage: 'Check yourself for 1–2 minutes, several times through the day',
    homeExercise: true,
  },
  'Spinal Stabilisation': {
    instructions:
      'Gently brace your core (as if bracing for a light tap on the stomach) without holding your breath or moving your spine.',
    dosage: '10 repetitions, held 5 seconds each, 2 sets a day',
    homeExercise: true,
  },
  Mobilisation: {
    instructions:
      'Graded hands-on pressure applied by your therapist to ease a stiff joint or spinal segment.',
    dosage: 'Performed by your therapist during your visit — nothing to repeat at home',
    homeExercise: false,
  },
  'Thrust & Manipulation': {
    instructions: 'A quick, precise movement applied by your therapist to a joint or spinal segment.',
    dosage: 'Performed by your therapist during your visit — nothing to repeat at home',
    homeExercise: false,
  },
};

/** Used when neither the clinic nor the built-in library says anything about this exercise. */
export const GENERIC_FALLBACK: ExerciseEntry = {
  instructions: 'Follow the technique your therapist showed you in clinic.',
  dosage: 'As instructed by your therapist',
  homeExercise: true,
};

/** A clinic's own rewrite of the standard library, one whole entry per exercise it has touched. */
export type ExerciseOverrides = Record<string, ExerciseEntry>;

/**
 * What the clinic has decided this exercise means, if they have said anything at all —
 * their own wording replaces the standard entry outright rather than merging field by field,
 * so editing one line can never leave a stale sentence from the built-in default sitting
 * next to it.
 */
export function exerciseEntry(name: string, clinicOverrides?: ExerciseOverrides | null): ExerciseEntry {
  return clinicOverrides?.[name] || EXERCISE_LIBRARY[name] || GENERIC_FALLBACK;
}

/**
 * The entry to print for one patient: the clinic's own wording (or the standard default),
 * with the dosage swapped out if this patient's assessment recorded one of their own — the
 * "15 reps instead of 10 for this patient" case. Only the dosage is ever patient-specific;
 * how to do the exercise, and whether it's a home exercise at all, is not something a single
 * patient's chart should be able to override.
 */
export function resolveExerciseForPatient(
  name: string,
  clinicOverrides: ExerciseOverrides | null | undefined,
  patientDosage: string | null | undefined
): ExerciseEntry {
  const base = exerciseEntry(name, clinicOverrides);
  const custom = patientDosage?.trim();
  return custom ? { ...base, dosage: custom } : base;
}

/**
 * SQLite has no JSON column, so a name-keyed map — the clinic's exercise overrides, or one
 * diagnosis's per-patient dosage notes — travels as JSON text, exactly like the tick-box lists
 * in shared/prescription.ts. Anything unreadable is treated as "nothing recorded".
 */
export function parseJsonMap<T>(value: unknown): Record<string, T> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, T>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeJsonMap<T>(map: Record<string, T> | null | undefined): string | null {
  if (!map || Object.keys(map).length === 0) return null;
  return JSON.stringify(map);
}
