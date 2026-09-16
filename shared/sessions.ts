/**
 * Counting the sessions of a course, and what happens when one is moved.
 *
 * A session that is carried forward is not a new session. It is the same session of the
 * course — the seventh — happening on a different day because the patient could not come.
 * That single idea decides everything here:
 *
 *  - The replacement **keeps the original's number**. A ten-session course has sessions 1 to
 *    10 no matter how many times one of them is moved.
 *  - The original row **stays** and keeps its number too, marked as carried forward, so the
 *    history still shows the patient was booked that day and did not come.
 *  - Only one of the two **holds a place** in the course. The carried original does not, or
 *    a course of 10 would read as 11 sessions the moment one was moved.
 *
 * Getting this wrong is what made the session list confusing: two rows numbered #12, a
 * package "8 sessions" claiming 18 were booked, and no way to see that one row was the other
 * one moved.
 */

export interface CountableVisit {
  id?: string;
  sessionNumber?: number | null;
  attendance: string;
  scheduledDate: string | Date;
  packageId?: string | null;
  carriedFromId?: string | null;
}

/**
 * Whether this row occupies one of the course's sessions.
 *
 * A carried-forward row has been superseded by its replacement, and a cancelled one was
 * called off. Neither is a session the patient still has coming.
 */
export function holdsAPlace(visit: { attendance: string }): boolean {
  return visit.attendance !== 'CARRIED_FORWARD' && visit.attendance !== 'CANCELLED';
}

/** A session can only be moved if it has not happened and has not already been moved. */
export function canCarryForward(visit: { attendance: string }): boolean {
  return visit.attendance === 'SCHEDULED' || visit.attendance === 'ABSENT';
}

/** Why a session cannot be moved, in the words the front desk would use. */
export function carryForwardBlockedReason(visit: { attendance: string }): string | null {
  switch (visit.attendance) {
    case 'PRESENT':
      return 'This session already happened, so there is nothing to move.';
    case 'CARRIED_FORWARD':
      return 'This session has already been moved. Carry forward the session it became instead.';
    case 'CANCELLED':
      return 'This session was cancelled. Add a new session instead of moving this one.';
    default:
      return null;
  }
}

/**
 * The number to give the next session added to a package.
 *
 * Counted from the rows that hold a place, so moving session 7 does not make the next one 9.
 */
export function nextSessionNumber(visits: CountableVisit[]): number {
  const numbers = visits
    .filter(holdsAPlace)
    .map((v) => v.sessionNumber ?? 0)
    .filter((n) => n > 0);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

export interface SessionProgress {
  /** Sessions the patient attended. */
  done: number;
  /** Sessions with a date in the diary that have not happened yet. */
  upcoming: number;
  /** Booked, in the past, and never marked either way. */
  overdue: number;
  /** Marked absent and not yet moved to another day. */
  missed: number;
  /** Sessions that hold a place in the course: done + upcoming + overdue + missed. */
  booked: number;
  /** Sessions of the course with no date against them yet. */
  unbooked: number;
  /** How many times a session has been moved to another day. */
  carriedForward: number;
  /** Sessions called off altogether. */
  cancelled: number;
  total: number;
}

/**
 * Where a course stands. Every session of it lands in exactly one bucket, which is what makes
 * the figures add up on screen: done + upcoming + overdue + missed + unbooked = total.
 */
export function sessionProgress(
  visits: CountableVisit[],
  totalSessions: number,
  now: Date = new Date()
): SessionProgress {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const counting = visits.filter(holdsAPlace);
  const done = counting.filter((v) => v.attendance === 'PRESENT').length;
  const missed = counting.filter((v) => v.attendance === 'ABSENT').length;
  const scheduled = counting.filter((v) => v.attendance === 'SCHEDULED');
  const overdue = scheduled.filter((v) => new Date(v.scheduledDate) < today).length;
  const upcoming = scheduled.length - overdue;
  const booked = counting.length;

  return {
    done,
    upcoming,
    overdue,
    missed,
    booked,
    unbooked: Math.max(0, totalSessions - booked),
    carriedForward: visits.filter((v) => v.attendance === 'CARRIED_FORWARD').length,
    cancelled: visits.filter((v) => v.attendance === 'CANCELLED').length,
    total: totalSessions,
  };
}

/**
 * The history of one session across every date it was moved to, oldest first.
 *
 * Session 7 booked for the 5th, missed, moved to the 12th, missed again, moved to the 20th is
 * one session and three rows. Following `carriedFromId` back from the row in hand gives the
 * whole story, which is what lets the screen say "attempt 3 of session 7" rather than showing
 * three identical-looking rows.
 */
export function carryChain<T extends CountableVisit>(visit: T, all: T[]): T[] {
  const byId = new Map(all.filter((v) => v.id).map((v) => [v.id as string, v]));
  const seen = new Set<string>();

  // Walk backwards to the first attempt.
  let first: T = visit;
  while (first.carriedFromId && byId.has(first.carriedFromId)) {
    if (seen.has(first.carriedFromId)) break; // a cycle would otherwise hang the page
    seen.add(first.carriedFromId);
    first = byId.get(first.carriedFromId) as T;
  }

  // Then forwards, following whichever row was carried from the one in hand.
  const chain: T[] = [first];
  const walked = new Set<string>(first.id ? [first.id] : []);
  for (;;) {
    const current = chain[chain.length - 1];
    const next = all.find((v) => v.carriedFromId && v.carriedFromId === current.id);
    if (!next || (next.id && walked.has(next.id))) break;
    if (next.id) walked.add(next.id);
    chain.push(next);
  }
  return chain;
}

/** Which attempt this row is, and how many there have been. 1 of 1 means it was never moved. */
export function attemptOf<T extends CountableVisit>(visit: T, all: T[]) {
  const chain = carryChain(visit, all);
  const index = chain.findIndex((v) => v.id === visit.id);
  return { attempt: index < 0 ? 1 : index + 1, attempts: chain.length };
}

/** The row this one was moved to, when it was carried forward. */
export function movedTo<T extends CountableVisit>(visit: T, all: T[]): T | undefined {
  return all.find((v) => v.carriedFromId && v.carriedFromId === visit.id);
}

/** The row this one came from, when it is a replacement. */
export function movedFrom<T extends CountableVisit>(visit: T, all: T[]): T | undefined {
  if (!visit.carriedFromId) return undefined;
  return all.find((v) => v.id === visit.carriedFromId);
}
