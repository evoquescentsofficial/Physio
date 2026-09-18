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

/** A plain fallback for a ticked exercise the library does not know — still shown, not skipped. */
export function exerciseEntry(name: string): ExerciseEntry {
  return (
    EXERCISE_LIBRARY[name] || {
      instructions: 'Follow the technique your therapist showed you in clinic.',
      dosage: 'As instructed by your therapist',
      homeExercise: true,
    }
  );
}
