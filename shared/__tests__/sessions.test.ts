import { describe, expect, it } from 'vitest';
import {
  attemptOf,
  canCarryForward,
  carryChain,
  carryForwardBlockedReason,
  holdsAPlace,
  movedFrom,
  movedTo,
  nextSessionNumber,
  sessionProgress,
} from '../sessions';

const day = (iso: string) => `${iso}T00:00:00.000Z`;

/** A ten-session course booked every other day from the 1st. */
function course(overrides: Partial<Record<number, Partial<Visit>>> = {}): Visit[] {
  return Array.from({ length: 10 }).map((_, i) => ({
    id: `v${i + 1}`,
    sessionNumber: i + 1,
    attendance: 'SCHEDULED',
    scheduledDate: day(`2026-09-${String(1 + i * 2).padStart(2, '0')}`),
    packageId: 'pkg1',
    carriedFromId: null,
    ...(overrides[i + 1] || {}),
  }));
}

interface Visit {
  id: string;
  sessionNumber: number | null;
  attendance: string;
  scheduledDate: string;
  packageId: string | null;
  carriedFromId: string | null;
}

/** What the API does when a session is carried forward, so the tests exercise the real shape. */
function carry(visits: Visit[], id: string, newDate: string, newId = `${id}c`): Visit[] {
  const source = visits.find((v) => v.id === id)!;
  return [
    ...visits.map((v) => (v.id === id ? { ...v, attendance: 'CARRIED_FORWARD' } : v)),
    {
      id: newId,
      // The replacement is the same session of the course, on another day.
      sessionNumber: source.sessionNumber,
      attendance: 'SCHEDULED',
      scheduledDate: day(newDate),
      packageId: source.packageId,
      carriedFromId: source.id,
    },
  ];
}

describe('which rows hold a place in the course', () => {
  it('counts a booked, attended or missed session', () => {
    expect(holdsAPlace({ attendance: 'SCHEDULED' })).toBe(true);
    expect(holdsAPlace({ attendance: 'PRESENT' })).toBe(true);
    expect(holdsAPlace({ attendance: 'ABSENT' })).toBe(true);
  });

  it('does not count one that was moved or called off', () => {
    expect(holdsAPlace({ attendance: 'CARRIED_FORWARD' })).toBe(false);
    expect(holdsAPlace({ attendance: 'CANCELLED' })).toBe(false);
  });
});

describe('what can be carried forward', () => {
  it('allows a booked or missed session', () => {
    expect(canCarryForward({ attendance: 'SCHEDULED' })).toBe(true);
    expect(canCarryForward({ attendance: 'ABSENT' })).toBe(true);
  });

  it('refuses one that already happened, was moved, or was cancelled', () => {
    for (const attendance of ['PRESENT', 'CARRIED_FORWARD', 'CANCELLED']) {
      expect(canCarryForward({ attendance })).toBe(false);
      expect(carryForwardBlockedReason({ attendance })).toBeTruthy();
    }
    expect(carryForwardBlockedReason({ attendance: 'SCHEDULED' })).toBeNull();
  });
});

describe('numbering when sessions move', () => {
  it('starts at 1 for a package with nothing booked', () => {
    expect(nextSessionNumber([])).toBe(1);
  });

  it('continues from the last session', () => {
    expect(nextSessionNumber(course())).toBe(11);
  });

  it('does not skip a number because a session was moved', () => {
    // Session 7 moved to a later date: the course still ends at 10.
    const moved = carry(course(), 'v7', '2026-10-01');
    expect(nextSessionNumber(moved)).toBe(11);
  });

  it('does not skip after the same session is moved twice', () => {
    let visits = carry(course(), 'v7', '2026-10-01', 'v7b');
    visits = carry(visits, 'v7b', '2026-10-10', 'v7c');
    expect(nextSessionNumber(visits)).toBe(11);
  });

  it('ignores cancelled sessions at the end of a course', () => {
    const visits = course({ 10: { attendance: 'CANCELLED' } });
    expect(nextSessionNumber(visits)).toBe(10);
  });
});

describe('a course with a session moved once', () => {
  const visits = carry(
    course({ 1: { attendance: 'PRESENT' }, 2: { attendance: 'PRESENT' }, 3: { attendance: 'ABSENT' } }),
    'v3',
    '2026-10-01'
  );
  const now = new Date('2026-09-10T12:00:00.000Z');

  it('still counts ten sessions, not eleven', () => {
    const p = sessionProgress(visits, 10, now);
    expect(p.booked).toBe(10);
    expect(p.total).toBe(10);
    expect(p.unbooked).toBe(0);
  });

  it('every session lands in exactly one bucket', () => {
    const p = sessionProgress(visits, 10, now);
    expect(p.done + p.upcoming + p.overdue + p.missed + p.unbooked).toBe(p.total);
  });

  it('records that one session was moved without counting it twice', () => {
    const p = sessionProgress(visits, 10, now);
    expect(p.carriedForward).toBe(1);
    expect(p.done).toBe(2);
    // The absent one was moved, so it is no longer outstanding.
    expect(p.missed).toBe(0);
  });
});

describe('the buckets', () => {
  const now = new Date('2026-09-10T12:00:00.000Z');

  it('separates overdue from upcoming by today', () => {
    const p = sessionProgress(course(), 10, now);
    // Booked on the 1st, 3rd, 5th, 7th and 9th — all before the 10th.
    expect(p.overdue).toBe(5);
    expect(p.upcoming).toBe(5);
  });

  it('treats a session booked for today as upcoming, not overdue', () => {
    const visits = course({ 1: { scheduledDate: day('2026-09-10') } });
    const p = sessionProgress(visits, 10, now);
    expect(p.overdue).toBe(4);
    expect(p.upcoming).toBe(6);
  });

  it('shows sessions still to be booked', () => {
    const p = sessionProgress(course().slice(0, 6), 10, now);
    expect(p.booked).toBe(6);
    expect(p.unbooked).toBe(4);
  });

  it('does not report negative unbooked when extra sessions were added', () => {
    const p = sessionProgress(course(), 8, now);
    expect(p.unbooked).toBe(0);
  });

  it('counts a cancelled session as neither booked nor outstanding', () => {
    const p = sessionProgress(course({ 4: { attendance: 'CANCELLED' } }), 10, now);
    expect(p.cancelled).toBe(1);
    expect(p.booked).toBe(9);
    expect(p.unbooked).toBe(1);
  });
});

describe('following a session that moved several times', () => {
  let visits = carry(course(), 'v7', '2026-10-01', 'v7b');
  visits = carry(visits, 'v7b', '2026-10-10', 'v7c');
  const get = (id: string) => visits.find((v) => v.id === id)!;

  it('links the whole chain in order', () => {
    const chain = carryChain(get('v7c'), visits);
    expect(chain.map((v) => v.id)).toEqual(['v7', 'v7b', 'v7c']);
  });

  it('gives the same chain from any row in it', () => {
    expect(carryChain(get('v7'), visits).map((v) => v.id)).toEqual(['v7', 'v7b', 'v7c']);
    expect(carryChain(get('v7b'), visits).map((v) => v.id)).toEqual(['v7', 'v7b', 'v7c']);
  });

  it('numbers the attempts', () => {
    expect(attemptOf(get('v7'), visits)).toEqual({ attempt: 1, attempts: 3 });
    expect(attemptOf(get('v7b'), visits)).toEqual({ attempt: 2, attempts: 3 });
    expect(attemptOf(get('v7c'), visits)).toEqual({ attempt: 3, attempts: 3 });
  });

  it('keeps one session number across every attempt', () => {
    expect(carryChain(get('v7c'), visits).every((v) => v.sessionNumber === 7)).toBe(true);
  });

  it('still counts as one session of the course', () => {
    const p = sessionProgress(visits, 10, new Date('2026-09-10T12:00:00.000Z'));
    expect(p.booked).toBe(10);
    expect(p.carriedForward).toBe(2);
  });

  it('points each row at where it went and where it came from', () => {
    expect(movedTo(get('v7'), visits)?.id).toBe('v7b');
    expect(movedFrom(get('v7b'), visits)?.id).toBe('v7');
    expect(movedTo(get('v7c'), visits)).toBeUndefined();
    expect(movedFrom(get('v7'), visits)).toBeUndefined();
  });

  it('is a chain of one for a session that never moved', () => {
    expect(attemptOf(get('v2'), visits)).toEqual({ attempt: 1, attempts: 1 });
  });
});

describe('bulk carry-forward of a whole month', () => {
  // Four overdue sessions moved into next month, two days apart.
  let visits = course({ 1: { attendance: 'PRESENT' }, 2: { attendance: 'PRESENT' } });
  ['v3', 'v4', 'v5', 'v6'].forEach((id, i) => {
    visits = carry(visits, id, `2026-10-${String(1 + i * 2).padStart(2, '0')}`, `${id}b`);
  });

  it('leaves the course the same size', () => {
    const p = sessionProgress(visits, 10, new Date('2026-09-20T12:00:00.000Z'));
    expect(p.booked).toBe(10);
    expect(p.carriedForward).toBe(4);
    expect(p.unbooked).toBe(0);
  });

  it("keeps each session's own number", () => {
    const moved = visits.filter((v) => v.carriedFromId);
    expect(moved.map((v) => v.sessionNumber).sort((a, b) => (a || 0) - (b || 0))).toEqual([3, 4, 5, 6]);
  });

  it('does not move the same session twice', () => {
    const carried = visits.filter((v) => v.attendance === 'CARRIED_FORWARD');
    expect(new Set(carried.map((v) => v.id)).size).toBe(carried.length);
  });

  it('numbers a further session after the course, not after the moved rows', () => {
    expect(nextSessionNumber(visits)).toBe(11);
  });
});

describe('a broken chain does not break the screen', () => {
  it('survives a replacement whose original was deleted', () => {
    const orphan = {
      id: 'x1',
      sessionNumber: 3,
      attendance: 'SCHEDULED',
      scheduledDate: day('2026-10-01'),
      packageId: 'pkg1',
      carriedFromId: 'gone',
    };
    expect(carryChain(orphan, [orphan]).map((v) => v.id)).toEqual(['x1']);
    expect(attemptOf(orphan, [orphan])).toEqual({ attempt: 1, attempts: 1 });
    expect(movedFrom(orphan, [orphan])).toBeUndefined();
  });

  it('does not hang on a row that points at itself', () => {
    const loop = {
      id: 'x1',
      sessionNumber: 3,
      attendance: 'SCHEDULED',
      scheduledDate: day('2026-10-01'),
      packageId: 'pkg1',
      carriedFromId: 'x1',
    };
    expect(carryChain(loop, [loop]).length).toBeLessThanOrEqual(2);
  });
});
