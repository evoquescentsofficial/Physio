import { describe, expect, it } from 'vitest';
import { inferFrequencyDays, lastScheduledDate, nextSessionDate } from '../scheduling';

/** Dates go in and come back as `YYYY-MM-DD`, the way the date inputs deal in them. */
const day = (iso: string) => `${iso}T00:00:00.000Z`;
const asDay = (d: Date) => d.toISOString().slice(0, 10);

describe('inferFrequencyDays', () => {
  it('falls back when there is nothing to read a rhythm from', () => {
    expect(inferFrequencyDays([])).toBe(2);
    expect(inferFrequencyDays([day('2026-09-01')])).toBe(2);
    expect(inferFrequencyDays([], 3)).toBe(3);
  });

  it('reads the cadence off an evenly booked course', () => {
    const dates = ['2026-09-01', '2026-09-04', '2026-09-07', '2026-09-10'].map(day);
    expect(inferFrequencyDays(dates)).toBe(3);
  });

  it('is not thrown off by one rescheduled session', () => {
    // Every 2 days, except the fourth session which slipped by a week.
    const dates = ['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-12', '2026-09-14'].map(day);
    expect(inferFrequencyDays(dates)).toBe(2);
  });

  it('ignores same-day duplicates and long breaks', () => {
    const dates = ['2026-09-01', '2026-09-01', '2026-12-01'].map(day);
    expect(inferFrequencyDays(dates)).toBe(2);
  });

  it('takes the dates unsorted', () => {
    const dates = ['2026-09-07', '2026-09-01', '2026-09-04'].map(day);
    expect(inferFrequencyDays(dates)).toBe(3);
  });
});

describe('nextSessionDate', () => {
  const now = new Date('2026-08-26T09:00:00.000Z');

  it('books after the course already scheduled, not today', () => {
    const dates = ['2026-09-08', '2026-09-10', '2026-09-12', '2026-09-14'].map(day);
    expect(asDay(nextSessionDate(dates, 2, now))).toBe('2026-09-16');
  });

  it('never lands in the past when the course is already finished', () => {
    const dates = ['2026-07-01', '2026-07-03'].map(day);
    expect(asDay(nextSessionDate(dates, 2, now))).toBe('2026-08-26');
  });

  it('starts today when nothing is booked yet', () => {
    expect(asDay(nextSessionDate([], 2, now))).toBe('2026-08-26');
  });

  it('follows the last date even when the list is unordered', () => {
    const dates = ['2026-09-14', '2026-09-08', '2026-09-10'].map(day);
    expect(asDay(nextSessionDate(dates, 3, now))).toBe('2026-09-17');
  });

  it('treats a zero or negative gap as one day, so it always moves forward', () => {
    const dates = [day('2026-09-14')];
    expect(asDay(nextSessionDate(dates, 0, now))).toBe('2026-09-15');
  });

  it('crosses a month boundary correctly', () => {
    const dates = [day('2026-08-30')];
    expect(asDay(nextSessionDate(dates, 3, now))).toBe('2026-09-02');
  });
});

describe('lastScheduledDate', () => {
  it('is null when nothing is booked', () => {
    expect(lastScheduledDate([])).toBeNull();
  });

  it('returns the latest date regardless of order', () => {
    const dates = ['2026-09-10', '2026-09-14', '2026-09-08'].map(day);
    expect(asDay(lastScheduledDate(dates)!)).toBe('2026-09-14');
  });
});
