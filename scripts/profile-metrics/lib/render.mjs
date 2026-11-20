// SVG card renderers. Output is static, self-contained SVG (no scripts, no
// external fonts or images) so it renders identically through GitHub's image
// proxy. Each card is rendered once per theme and swapped with <picture>.

import { icon } from './icons.mjs';
import { WEEKDAYS } from './model.mjs';
import { FONT_MONO, FONT_SANS } from './theme.mjs';

const number = new Intl.NumberFormat('en-US');
const fmt = (n) => number.format(n);
const pct = (n) => `${n.toFixed(1)}%`;

export function escapeXml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

export function frame({ width, height, theme, title, desc, body, extraStyle = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(desc)}</desc>
<style>
.title{font:600 15px ${FONT_SANS};fill:${theme.title}}
.aside{font:400 12px ${FONT_SANS};fill:${theme.muted}}
.label{font:400 12.5px ${FONT_SANS};fill:${theme.text}}
.value{font:600 13px ${FONT_SANS};fill:${theme.title};font-variant-numeric:tabular-nums}
.muted{font:400 12px ${FONT_SANS};fill:${theme.muted}}
.tiny{font:400 10.5px ${FONT_SANS};fill:${theme.muted}}
.mono{font:400 10.5px ${FONT_MONO};fill:${theme.muted}}
.hero{font:700 40px ${FONT_SANS};fill:${theme.title};font-variant-numeric:tabular-nums;letter-spacing:-1px}
.strong{font:600 13px ${FONT_SANS};fill:${theme.title}}
.headline{font:600 19px ${FONT_SANS};fill:${theme.title}}
.peak{fill:${theme.accent};font-weight:700}
.fade{animation:fade .5s ease-out both}
.grow{transform-box:fill-box;transform-origin:left center;animation:grow .8s cubic-bezier(.2,.7,.2,1) both}
.pop{transform-box:fill-box;transform-origin:center;animation:pop .45s cubic-bezier(.2,.7,.2,1) both}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.fade,.grow,.pop{animation:none}}${extraStyle}
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${theme.bg}" stroke="${theme.border}"/>
${body}
</svg>
`;
}

export function cardHeader({ theme, width, iconName, title, aside }) {
  return [
    icon(iconName, { x: 24, y: 23, size: 16, fill: theme.accent }),
    `<text x="48" y="36" class="title">${escapeXml(title)}</text>`,
    aside ? `<text x="${width - 24}" y="36" text-anchor="end" class="aside">${escapeXml(aside)}</text>` : '',
  ].join('\n');
}

export const delay = (ms) => `style="animation-delay:${ms}ms"`;

// ─── Overview ────────────────────────────────────────────────────────────────

export function renderOverview(model, theme) {
  const width = 440;
  const height = 220;
  const { contributions, streaks, totals, year, memberSince } = model;

  const rows = [
    { icon: 'commit', label: `Commits in ${year}`, value: fmt(contributions.commitsThisYear) },
    { icon: 'graph', label: 'Total contributions', value: fmt(contributions.allTime) },
    { icon: 'pullRequest', label: 'Pull requests', value: fmt(totals.pullRequests) },
    { icon: 'star', label: 'Stars earned', value: fmt(totals.stars) },
    { icon: 'repo', label: 'Public repositories', value: fmt(totals.publicRepos) },
    totals.privateRepos > 0
      ? { icon: 'repo', label: 'Private repositories', value: fmt(totals.privateRepos) }
      : { icon: 'issue', label: 'Issues opened', value: fmt(totals.issues) },
  ];

  const listX = 222;
  const list = rows
    .map((row, i) => {
      const y = 72 + i * 25;
      return `<g class="fade" ${delay(150 + i * 60)}>
${icon(row.icon, { x: listX, y: y - 11, size: 14, fill: theme.muted })}
<text x="${listX + 22}" y="${y}" class="label">${escapeXml(row.label)}</text>
<text x="${width - 24}" y="${y}" text-anchor="end" class="value">${row.value}</text>
</g>`;
    })
    .join('\n');

  const streakLine = (y, iconName, color, length, caption, wait) => `<g class="fade" ${delay(wait)}>
${icon(iconName, { x: 24, y: y - 12, size: 15, fill: color })}
<text x="47" y="${y}"><tspan class="strong">${fmt(length)} ${length === 1 ? 'day' : 'days'}</tspan><tspan class="muted" dx="5">${caption}</tspan></text>
</g>`;

  const body = `${cardHeader({ theme, width, iconName: 'pulse', title: 'GitHub activity', aside: `since ${memberSince}` })}
<g class="fade">
<text x="22" y="102" class="hero">${fmt(contributions.thisYear)}</text>
<text x="24" y="125" class="muted">contributions in ${year}</text>
</g>
${streakLine(162, 'flame', theme.accent, streaks.current.length, 'current streak', 300)}
${streakLine(188, 'trophy', theme.muted, streaks.longest.length, 'longest streak', 380)}
<line x1="204" y1="56" x2="204" y2="196" stroke="${theme.border}"/>
${list}`;

  return frame({
    width,
    height,
    theme,
    title: `${model.name}'s GitHub activity`,
    desc: `${fmt(contributions.thisYear)} contributions in ${year}; current streak ${streaks.current.length} days, longest ${streaks.longest.length} days; ${rows.map((r) => `${r.label}: ${r.value}`).join('; ')}.`,
    body,
  });
}

// ─── Languages ───────────────────────────────────────────────────────────────

export function renderLanguages(model, theme) {
  const width = 440;
  const height = 220;
  const { items, repoCount } = model.languages;
  const header = cardHeader({
    theme,
    width,
    iconName: 'code',
    title: 'Most used languages',
    aside: `${fmt(repoCount)} ${repoCount === 1 ? 'repository' : 'repositories'}`,
  });

  if (items.length === 0) {
    return frame({
      width,
      height,
      theme,
      title: 'Most used languages',
      desc: 'No language data yet.',
      body: `${header}\n<text x="${width / 2}" y="125" text-anchor="middle" class="muted">No language data yet</text>`,
    });
  }

  const colorOf = (item) => item.color ?? theme.muted;
  const barX = 24;
  const barW = width - 48;
  let cursor = barX;
  const segments = items
    .map((item) => {
      const w = (item.percent / 100) * barW;
      const rect = `<rect x="${cursor.toFixed(2)}" y="56" width="${w.toFixed(2)}" height="8" fill="${colorOf(item)}"/>`;
      cursor += w;
      return rect;
    })
    .join('');
  // 2px gaps between segments, drawn in the card background colour.
  let gapCursor = barX;
  const gaps = items
    .slice(0, -1)
    .map((item) => {
      gapCursor += (item.percent / 100) * barW;
      return `<rect x="${(gapCursor - 1).toFixed(2)}" y="56" width="2" height="8" fill="${theme.bg}"/>`;
    })
    .join('');

  const colW = (width - 48 - 32) / 2;
  const legend = items
    .slice(0, 8)
    .map((item, i) => {
      const col = Math.floor(i / 4);
      const row = i % 4;
      const x = 24 + col * (colW + 32);
      const y = 98 + row * 27;
      return `<g class="fade" ${delay(200 + i * 50)}>
<circle cx="${x + 5}" cy="${y - 4.5}" r="5" fill="${colorOf(item)}"/>
<text x="${x + 18}" y="${y}" class="label">${escapeXml(item.name)}</text>
<text x="${x + colW}" y="${y}" text-anchor="end" class="muted">${pct(item.percent)}</text>
</g>`;
    })
    .join('\n');

  const body = `${header}
<defs><clipPath id="bar"><rect x="${barX}" y="56" width="${barW}" height="8" rx="4"/></clipPath></defs>
<rect x="${barX}" y="56" width="${barW}" height="8" rx="4" fill="${theme.track}"/>
<g clip-path="url(#bar)"><g class="grow">${segments}${gaps}</g></g>
${legend}
<text x="24" y="${height - 16}" class="tiny">Weighted by code size and repository count · forks excluded</text>`;

  return frame({
    width,
    height,
    theme,
    title: 'Most used languages',
    desc: items.map((item) => `${item.name} ${pct(item.percent)}`).join(', '),
    body,
  });
}

// ─── Commit rhythm ───────────────────────────────────────────────────────────

export function renderRhythm(model, theme) {
  const width = 900;
  const height = 300;
  const r = model.rhythm;
  const updated = new Intl.DateTimeFormat('en-US', {
    timeZone: r.timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(model.generatedAt));

  const header = cardHeader({
    theme,
    width,
    iconName: 'clock',
    title: 'Commit rhythm',
    aside: `${fmt(r.total)} commits · ${r.timeZone} (${r.utcOffset})`,
  });
  const footer = `<text x="${width - 24}" y="${height - 16}" text-anchor="end" class="tiny">Updated ${escapeXml(updated)} · authored commits on default branches</text>`;

  if (r.total === 0) {
    return frame({
      width,
      height,
      theme,
      title: 'Commit rhythm',
      desc: 'No commits analysed yet.',
      body: `${header}\n<text x="${width / 2}" y="160" text-anchor="middle" class="muted">No commits analysed yet</text>\n${footer}`,
    });
  }

  // Punch card: weekday rows × 24 hour columns.
  const x0 = 64;
  const cw = 22;
  const y0 = 96;
  const rh = 24;
  const max = Math.max(...r.punch.flat());

  const bands = [
    { label: 'NIGHT', from: 0, to: 6 },
    { label: 'MORNING', from: 6, to: 12 },
    { label: 'DAYTIME', from: 12, to: 18 },
    { label: 'EVENING', from: 18, to: 24 },
  ]
    .map((band, i) => {
      const x = x0 + band.from * cw;
      const w = (band.to - band.from) * cw;
      const fill = i % 2 === 0 ? `<rect x="${x}" y="${y0 - 34}" width="${w}" height="${rh * 7 + 22}" rx="6" fill="${theme.surface}"/>` : '';
      return `${fill}<text x="${x + w / 2}" y="${y0 - 19}" text-anchor="middle" class="tiny" letter-spacing="1">${band.label}</text>`;
    })
    .join('\n');

  const dots = [];
  r.punch.forEach((hours, d) => {
    hours.forEach((count, h) => {
      const cx = x0 + h * cw + cw / 2;
      const cy = y0 + d * rh;
      if (count === 0) {
        dots.push(`<circle cx="${cx}" cy="${cy}" r="1.6" fill="${theme.empty}"/>`);
        return;
      }
      const t = Math.sqrt(count / max);
      const radius = (1.8 + 7.7 * t).toFixed(2);
      const opacity = (0.22 + 0.78 * t).toFixed(2);
      dots.push(
        `<circle class="pop" ${delay(h * 25 + d * 10)} cx="${cx}" cy="${cy}" r="${radius}" fill="${theme.accent}" fill-opacity="${opacity}"/>`,
      );
    });
  });

  const dayLabels = WEEKDAYS.map((day, d) => {
    const isPeak = d === r.peakDay.index;
    return `<text x="24" y="${y0 + d * rh + 4}" class="mono${isPeak ? ' peak' : ''}">${day}</text>`;
  }).join('\n');

  const hourLabels = Array.from({ length: 8 }, (_, i) => i * 3)
    .map((h) => `<text x="${x0 + h * cw + cw / 2}" y="${y0 + rh * 6 + 30}" text-anchor="middle" class="mono">${String(h).padStart(2, '0')}</text>`)
    .join('\n');

  // Summary panel.
  const px = 640;
  const personaIcon = r.persona.key === 'early-bird' ? 'sun' : 'moon';
  const barX = 744;
  const barW = 84;
  const maxPeriod = Math.max(...r.periods.map((p) => p.percent));
  const periodRows = r.periods
    .map((p, i) => {
      const y = 148 + i * 26;
      const range = `${String(p.from).padStart(2, '0')}–${String(p.to % 24).padStart(2, '0')}`;
      const w = Math.max(2, (p.percent / 100) * barW);
      const isTop = p.percent === maxPeriod;
      return `<g class="fade" ${delay(300 + i * 70)}>
<text x="${px}" y="${y}" class="label">${p.label}</text>
<text x="${px + 64}" y="${y}" class="mono">${range}</text>
<rect x="${barX}" y="${y - 8}" width="${barW}" height="6" rx="3" fill="${theme.track}"/>
<rect class="grow" ${delay(350 + i * 70)} x="${barX}" y="${y - 8}" width="${w.toFixed(2)}" height="6" rx="3" fill="${isTop ? theme.accent : theme.muted}"/>
<text x="${width - 24}" y="${y}" text-anchor="end" class="${isTop ? 'value' : 'muted'}">${pct(p.percent)}</text>
</g>`;
    })
    .join('\n');

  const body = `${header}
${bands}
${dayLabels}
${hourLabels}
${dots.join('\n')}
<line x1="${px - 24}" y1="62" x2="${px - 24}" y2="${y0 + rh * 6 + 34}" stroke="${theme.border}"/>
<g class="fade" ${delay(200)}>
${icon(personaIcon, { x: px, y: 72, size: 20, fill: theme.accent })}
<text x="${px + 30}" y="89" class="headline">${escapeXml(r.persona.label)}</text>
<text x="${px}" y="114" class="muted">${escapeXml(r.persona.detail)}</text>
</g>
${periodRows}
<g class="fade" ${delay(650)}>
${icon('calendar', { x: px, y: 241, size: 14, fill: theme.muted })}
<text x="${px + 22}" y="252" class="muted">Most productive on <tspan class="strong">${r.peakDay.name}</tspan> · ${pct(r.peakDay.percent)}</text>
</g>
${footer}`;

  return frame({
    width,
    height,
    theme,
    title: 'Commit rhythm',
    desc: `${fmt(r.total)} commits in ${r.timeZone}. ${r.persona.label}: ${r.persona.detail}. ${r.periods.map((p) => `${p.label} ${pct(p.percent)}`).join(', ')}. Most productive on ${r.peakDay.name}.`,
    body,
  });
}

export const CARDS = {
  overview: renderOverview,
  languages: renderLanguages,
  rhythm: renderRhythm,
};
