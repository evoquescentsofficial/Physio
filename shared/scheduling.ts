/**
 * Working out when the next session should fall.
 *
 * A package usually has its whole course already booked, so "add more sessions" means
 * *after* the course finishes, not today — booking from today would drop new sessions in
 * among the ones already scheduled and give the patient two appointments on the same day.
 */

const DAY_MS = 86400000;

/**
 * Day boundaries are taken in UTC, because that is how dates travel through the rest of the app:
 * a `<input type="date">` value like `2026-09-14` parses as UTC midnight, and `toInputDate()`
 * formats through `toISOString()`. Doing the arithmetic in UTC keeps a date that goes out to the
 * form coming back as the same day. (The clinic-timezone question is tracked in the README.)
 */
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/**
 * How many days apart this package's sessions are actually booked, read from the schedule
 * rather than assumed. Uses the most common gap so one rescheduled session does not skew it.
 */
export function inferFrequencyDays(dates: (string | Date)[], fallback = 2): number {
  const sorted = dates
    .map((d) => startOfDay(new Date(d)).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (sorted.length < 2) return fallback;

  const gaps = new Map<number, number>();
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((sorted[i] - sorted[i - 1]) / DAY_MS);
    if (gap < 1 || gap > 60) continue; // same-day duplicates and long breaks are not the cadence
    gaps.set(gap, (gaps.get(gap) || 0) + 1);
  }
  if (gaps.size === 0) return fallback;

  // Most frequent gap wins; a tie goes to the shorter one, which is the usual booking rhythm.
  let best = fallback;
  let bestCount = 0;
  for (const [gap, count] of gaps) {
    if (count > bestCount || (count === bestCount && gap < best)) {
      best = gap;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The date a further session should start from: one gap after the last one already booked,
 * and never in the past — a default that puts an appointment behind today is never useful.
 */
export function nextSessionDate(
  existingDates: (string | Date)[],
  frequencyDays: number,
  now: Date = new Date()
): Date {
  const today = startOfDay(now);
  const times = existingDates
    .map((d) => startOfDay(new Date(d)).getTime())
    .filter((t) => !Number.isNaN(t));

  if (times.length === 0) return today;

  const last = new Date(Math.max(...times));
  const next = startOfDay(last);
  next.setUTCDate(next.getUTCDate() + Math.max(1, frequencyDays));

  return next < today ? today : next;
}

/** The last date in a schedule, or null when nothing is booked yet. */
export function lastScheduledDate(dates: (string | Date)[]): Date | null {
  const times = dates
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)) : null;
}
