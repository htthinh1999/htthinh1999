import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  addDays,
  computeRhythm,
  computeStreaks,
  localDate,
  mergeCalendarDays,
  rankLanguages,
} from '../lib/model.mjs';

const days = (start, counts) => counts.map((count, i) => ({ date: addDays(start, i), count }));

describe('computeStreaks', () => {
  test('counts a streak that includes today', () => {
    const result = computeStreaks(days('2026-11-15', [0, 1, 2, 3, 1, 4]), '2026-11-20');
    assert.deepEqual(result.current, { length: 5, start: '2026-11-16', end: '2026-11-20' });
  });

  test('keeps the streak alive when today has no contributions yet', () => {
    const result = computeStreaks(days('2026-11-15', [1, 1, 1, 1, 1, 0]), '2026-11-20');
    assert.deepEqual(result.current, { length: 5, start: '2026-11-15', end: '2026-11-19' });
  });

  test('breaks the streak after a full idle day', () => {
    const result = computeStreaks(days('2026-11-15', [1, 1, 1, 1, 0, 0]), '2026-11-20');
    assert.equal(result.current.length, 0);
  });

  test('finds the longest streak across a year boundary', () => {
    const result = computeStreaks(days('2025-12-29', [1, 1, 1, 1, 1, 0, 2, 2]), '2026-01-05');
    assert.deepEqual(result.longest, { length: 5, start: '2025-12-29', end: '2026-01-02' });
  });

  test('does not join runs separated by a missing date', () => {
    const gappy = [
      { date: '2026-01-01', count: 1 },
      { date: '2026-01-02', count: 1 },
      { date: '2026-01-04', count: 1 },
    ];
    assert.equal(computeStreaks(gappy, '2026-01-10').longest.length, 2);
  });

  test('handles an empty calendar', () => {
    const result = computeStreaks([], '2026-01-10');
    assert.equal(result.current.length, 0);
    assert.equal(result.longest.length, 0);
  });
});

describe('mergeCalendarDays', () => {
  test('flattens, sorts and de-duplicates overlapping years', () => {
    const year = (dates) => ({
      contributionCalendar: {
        weeks: [{ contributionDays: dates.map(([date, contributionCount]) => ({ date, contributionCount })) }],
      },
    });
    const merged = mergeCalendarDays([
      year([['2026-01-01', 3], ['2025-12-31', 1]]),
      year([['2025-12-31', 2], ['2025-12-30', 0]]),
    ]);
    assert.deepEqual(merged, [
      { date: '2025-12-30', count: 0 },
      { date: '2025-12-31', count: 2 },
      { date: '2026-01-01', count: 3 },
    ]);
  });
});

describe('computeRhythm', () => {
  test('buckets commits in the configured time zone', () => {
    // 2026-11-16 is a Monday. 23:30 UTC Monday = 06:30 Tuesday in UTC+7.
    const rhythm = computeRhythm(['2026-11-16T23:30:00Z'], 'Asia/Ho_Chi_Minh');
    assert.equal(rhythm.total, 1);
    assert.equal(rhythm.punch[1][6], 1); // Tuesday, 06:00
    assert.equal(rhythm.peakDay.name, 'Tuesday');
    assert.equal(rhythm.periods.find((p) => p.key === 'morning').count, 1);
    assert.equal(rhythm.utcOffset, 'UTC+7');
  });

  test('labels night owls and early birds', () => {
    const late = ['2026-11-16T15:00:00Z', '2026-11-16T16:00:00Z', '2026-11-16T03:00:00Z']; // 22h, 23h, 10h local
    assert.equal(computeRhythm(late, 'Asia/Ho_Chi_Minh').persona.key, 'night-owl');
    const early = ['2026-11-16T01:00:00Z', '2026-11-16T02:00:00Z', '2026-11-16T14:00:00Z']; // 08h, 09h, 21h
    assert.equal(computeRhythm(early, 'Asia/Ho_Chi_Minh').persona.key, 'early-bird');
  });

  test('period shares add up to 100%', () => {
    const stamps = Array.from({ length: 50 }, (_, i) => new Date(Date.UTC(2026, 0, 1, i * 7 % 24)).toISOString());
    const total = computeRhythm(stamps, 'Europe/Berlin').periods.reduce((sum, p) => sum + p.percent, 0);
    assert.ok(Math.abs(total - 100) < 1e-9);
  });

  test('ignores unparsable timestamps', () => {
    assert.equal(computeRhythm(['not-a-date'], 'UTC').total, 0);
  });
});

describe('rankLanguages', () => {
  const repo = (...langs) => ({
    languages: { edges: langs.map(([name, size]) => ({ size, node: { name, color: '#123456' } })) },
  });

  test('excludes configured languages case-insensitively', () => {
    const { items } = rankLanguages([repo(['C#', 100], ['TSQL', 1e9])], { exclude: ['tsql'] });
    assert.deepEqual(items.map((i) => i.name), ['C#']);
  });

  test('blends bytes with repository count', () => {
    // One huge repo vs. a language used across many repos.
    const repos = [repo(['Java', 1_000_000]), ...Array.from({ length: 16 }, () => repo(['C#', 20_000]))];
    const bytesOnly = rankLanguages(repos, { sizeWeight: 1, countWeight: 0 }).items;
    const blended = rankLanguages(repos, { sizeWeight: 0.5, countWeight: 0.5 }).items;
    assert.equal(bytesOnly[0].name, 'Java');
    assert.equal(blended[0].name, 'C#');
  });

  test('groups the tail into "Other" and sums to 100%', () => {
    const repos = [repo(['A', 50], ['B', 40], ['C', 30], ['D', 20], ['E', 10])];
    const { items, repoCount } = rankLanguages(repos, { limit: 3 });
    assert.equal(repoCount, 1);
    assert.deepEqual(items.map((i) => i.name), ['A', 'B', 'C', 'Other']);
    assert.ok(Math.abs(items.reduce((sum, i) => sum + i.percent, 0) - 100) < 1e-9);
  });

  test('returns no items when there is no data', () => {
    assert.deepEqual(rankLanguages([], {}), { repoCount: 0, items: [] });
  });
});

test('localDate formats in the requested zone', () => {
  assert.equal(localDate(new Date('2026-11-20T18:00:00Z'), 'Asia/Ho_Chi_Minh'), '2026-11-21');
  assert.equal(localDate(new Date('2026-11-20T18:00:00Z'), 'UTC'), '2026-11-20');
});
