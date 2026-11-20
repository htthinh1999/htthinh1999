// Pure functions that turn raw API data into the view model the cards render.
// No I/O here, so everything is unit-testable with plain fixtures.

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// Same buckets WakaTime-style readmes use, so the story stays familiar.
export const PERIODS = [
  { key: 'morning', label: 'Morning', from: 6, to: 12 },
  { key: 'daytime', label: 'Daytime', from: 12, to: 18 },
  { key: 'evening', label: 'Evening', from: 18, to: 24 },
  { key: 'night', label: 'Night', from: 0, to: 6 },
];

const DAY_MS = 86_400_000;

export function buildModel(raw, config, now = new Date()) {
  const timeZone = config.timeZone ?? 'UTC';
  const year = Number(localDate(now, timeZone).slice(0, 4));
  const { user, contributionYears, repositories, commitTimestamps } = raw;

  const days = mergeCalendarDays(contributionYears);
  const thisYear = contributionYears.find((y) => y.year === year);

  return {
    generatedAt: now.toISOString(),
    login: user.login,
    name: user.name || user.login,
    memberSince: Number(user.createdAt.slice(0, 4)),
    year,
    contributions: {
      thisYear: thisYear?.contributionCalendar.totalContributions ?? 0,
      allTime: contributionYears.reduce((sum, y) => sum + y.contributionCalendar.totalContributions, 0),
      commitsThisYear: thisYear?.totalCommitContributions ?? 0,
      pullRequestsThisYear: thisYear?.totalPullRequestContributions ?? 0,
      reviewsThisYear: thisYear?.totalPullRequestReviewContributions ?? 0,
    },
    streaks: computeStreaks(days, localDate(now, timeZone)),
    totals: {
      pullRequests: user.pullRequests.totalCount,
      issues: user.issues.totalCount,
      followers: user.followers.totalCount,
      stars: repositories.reduce((sum, repo) => sum + repo.stargazerCount, 0),
      publicRepos: user.publicRepos.totalCount,
      privateRepos: user.privateRepos.totalCount,
    },
    languages: rankLanguages(repositories, config.languages),
    rhythm: computeRhythm(commitTimestamps, timeZone, now),
  };
}

/** Flattens yearly calendars into a sorted, de-duplicated [{ date, count }] list. */
export function mergeCalendarDays(contributionYears) {
  const byDate = new Map();
  for (const year of contributionYears) {
    for (const week of year.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        byDate.set(day.date, Math.max(byDate.get(day.date) ?? 0, day.contributionCount));
      }
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Current and longest streak of consecutive days with ≥1 contribution.
 * A streak stays "current" through today even if today has no contributions
 * yet — it only breaks once a full day passes without one.
 */
export function computeStreaks(days, today) {
  const counts = new Map(days.map((d) => [d.date, d.count]));

  let longest = { length: 0, start: null, end: null };
  let run = null;
  let previous = null;
  for (const { date, count } of days) {
    if (count > 0) {
      const continues = run && previous && addDays(previous, 1) === date;
      run = continues ? { ...run, length: run.length + 1, end: date } : { length: 1, start: date, end: date };
      if (run.length > longest.length) longest = run;
    } else {
      run = null;
    }
    previous = date;
  }

  let cursor = (counts.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  const end = cursor;
  let length = 0;
  while ((counts.get(cursor) ?? 0) > 0) {
    length += 1;
    cursor = addDays(cursor, -1);
  }
  const current =
    length > 0 ? { length, start: addDays(cursor, 1), end } : { length: 0, start: null, end: null };

  return { current, longest };
}

/**
 * Ranks languages across repositories. Score blends total bytes with the
 * number of repositories using the language (sizeWeight / countWeight), which
 * stops one large generated file from dominating the chart.
 */
export function rankLanguages(repositories, options = {}) {
  const { exclude = [], limit = 8, sizeWeight = 0.5, countWeight = 0.5 } = options;
  const excluded = new Set(exclude.map((name) => name.toLowerCase()));
  const stats = new Map();
  let repoCount = 0;

  for (const repo of repositories) {
    let counted = false;
    for (const edge of repo.languages?.edges ?? []) {
      const { name, color } = edge.node;
      if (excluded.has(name.toLowerCase()) || edge.size <= 0) continue;
      const entry = stats.get(name) ?? { name, color: color || '#8b949e', bytes: 0, repos: 0 };
      entry.bytes += edge.size;
      entry.repos += 1;
      stats.set(name, entry);
      counted = true;
    }
    if (counted) repoCount += 1;
  }

  const scored = [...stats.values()]
    .map((entry) => ({ ...entry, score: entry.bytes ** sizeWeight * entry.repos ** countWeight }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const total = scored.reduce((sum, entry) => sum + entry.score, 0);
  if (total === 0) return { repoCount, items: [] };

  const top = scored.slice(0, limit).map(({ name, color, score }) => ({
    name,
    color,
    percent: (score / total) * 100,
  }));
  const rest = scored.slice(limit).reduce((sum, entry) => sum + entry.score, 0);
  if (rest > 0) top.push({ name: 'Other', color: null, percent: (rest / total) * 100 });

  return { repoCount, items: top };
}

/** Commit punch card (weekday × hour) in the configured time zone. */
export function computeRhythm(timestamps, timeZone, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  });

  const punch = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let total = 0;
  for (const timestamp of timestamps) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) continue;
    let weekday = -1;
    let hour = -1;
    for (const part of formatter.formatToParts(date)) {
      if (part.type === 'weekday') weekday = WEEKDAYS.indexOf(part.value);
      if (part.type === 'hour') hour = Number(part.value) % 24;
    }
    if (weekday < 0 || hour < 0) continue;
    punch[weekday][hour] += 1;
    total += 1;
  }

  const share = (count) => (total ? (count / total) * 100 : 0);
  const byWeekday = punch.map((hours) => hours.reduce((a, b) => a + b, 0));
  const byHour = Array.from({ length: 24 }, (_, h) => punch.reduce((sum, row) => sum + row[h], 0));

  const periods = PERIODS.map((p) => {
    const count = byHour.slice(p.from, p.to).reduce((a, b) => a + b, 0);
    return { ...p, count, percent: share(count) };
  });
  const before6pm = periods
    .filter((p) => p.key === 'morning' || p.key === 'daytime')
    .reduce((sum, p) => sum + p.count, 0);
  const persona =
    before6pm >= total - before6pm
      ? { key: 'early-bird', label: 'Early bird', detail: `${share(before6pm).toFixed(1)}% of commits land before 6 pm` }
      : { key: 'night-owl', label: 'Night owl', detail: `${share(total - before6pm).toFixed(1)}% of commits land after 6 pm` };

  const peakIndex = byWeekday.indexOf(Math.max(...byWeekday));
  const peakHour = byHour.indexOf(Math.max(...byHour));

  return {
    total,
    timeZone,
    utcOffset: utcOffsetLabel(timeZone, now),
    punch,
    byWeekday,
    byHour,
    periods,
    persona,
    peakDay: { index: peakIndex, name: WEEKDAY_NAMES[peakIndex], percent: share(byWeekday[peakIndex]) },
    peakHour,
  };
}

export function localDate(date, timeZone) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addDays(isoDate, delta) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

function utcOffsetLabel(timeZone, date) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  return (part?.value ?? 'GMT').replace('GMT', 'UTC');
}
