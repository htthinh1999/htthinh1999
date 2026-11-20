// Animated profile header: greeting, name, a typewriter cycling through roles
// and a drifting bokeh field (a nod to the original particle GIF), in ~20 KB.
// Typing uses SMIL so it runs inside <img>; prefers-reduced-motion shows a
// static first role instead.

import { icon } from './icons.mjs';
import { escapeXml } from './render.mjs';
import { FONT_MONO, FONT_SANS } from './theme.mjs';

const WIDTH = 900;
const HEIGHT = 240;
const TEXT_X = 56;
const TYPE_X = 80; // typed text starts after the "›" prompt
const TYPE_Y = 172;
const FONT_SIZE = 18;
const CHAR_W = 10.8; // 0.6em — textLength pins every monospace font to this grid

const TIMING = { lead: 400, type: 60, hold: 1900, erase: 28, pause: 350 };

/** Builds a discrete keyframe timeline shared by every animated element. */
export function typingTimeline(roles) {
  const events = []; // { t (ms), role, chars }
  let t = 0;
  roles.forEach((role, index) => {
    const n = [...role].length;
    t += index === 0 ? TIMING.lead : TIMING.pause;
    for (let k = 1; k <= n; k += 1) {
      t += TIMING.type;
      events.push({ t, role: index, chars: k });
    }
    t += TIMING.hold;
    for (let k = n - 1; k >= 0; k -= 1) {
      t += TIMING.erase;
      events.push({ t, role: index, chars: k });
    }
  });
  const total = t + TIMING.pause;
  return { events: [{ t: 0, role: 0, chars: 0 }, ...events], total };
}

function animate(attribute, values, keyTimes, total) {
  return `<animate attributeName="${attribute}" dur="${(total / 1000).toFixed(2)}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${values.join(';')}"/>`;
}

function particles(theme) {
  // Deterministic bokeh field on the right; a mask fades it out toward the text.
  let seed = 47586956;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dots = [];
  for (let i = 0; i < 34; i += 1) {
    const x = 420 + Math.sqrt(rand()) * 470;
    const y = 8 + rand() * (HEIGHT - 16);
    const r = 3 + rand() ** 2.2 * 42;
    const opacity = (theme.name === 'dark' ? 0.16 + rand() * 0.5 : 0.38 + rand() * 0.5).toFixed(2);
    const duration = (8 + rand() * 10).toFixed(1);
    const wait = (-rand() * 14).toFixed(1);
    const variant = ['a', 'b', 'c'][i % 3];
    dots.push(
      `<circle class="p ${variant}" style="animation-duration:${duration}s;animation-delay:${wait}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#bokeh)" opacity="${opacity}"/>`,
    );
  }
  return `<g mask="url(#fade)">\n${dots.join('\n')}\n</g>`;
}

export function renderHeader(header, theme) {
  const roles = header.roles.map((role) => role.normalize('NFC'));
  const { events, total } = typingTimeline(roles);
  const keyTimes = events.map((e) => (e.t / total).toFixed(5)).join(';');

  const typed = roles
    .map((role, index) => {
      const n = [...role].length;
      const widths = events.map((e) => (e.role === index ? (e.chars * CHAR_W).toFixed(1) : 0));
      return `<clipPath id="clip${index}"><rect x="${TYPE_X}" y="${TYPE_Y - 22}" height="30" width="0">${animate('width', widths, keyTimes, total)}</rect></clipPath>
<text class="type" x="${TYPE_X}" y="${TYPE_Y}" textLength="${(n * CHAR_W).toFixed(1)}" lengthAdjust="spacingAndGlyphs" clip-path="url(#clip${index})">${escapeXml(role)}</text>`;
    })
    .join('\n');

  const caretX = events.map((e) => (TYPE_X + 2 + e.chars * CHAR_W).toFixed(1));
  const first = roles[0];
  const isDark = theme.name === 'dark';

  const meta = [];
  let mx = TEXT_X;
  if (header.location) {
    meta.push(icon('location', { x: mx, y: 196, size: 14, fill: theme.muted }));
    meta.push(`<text x="${mx + 20}" y="207" class="meta">${escapeXml(header.location)}</text>`);
    mx += 20 + [...header.location].length * 7.4 + 22;
  }
  if (header.website) {
    meta.push(icon('link', { x: mx, y: 196, size: 14, fill: theme.muted }));
    meta.push(`<text x="${mx + 20}" y="207" class="meta">${escapeXml(header.website)}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(header.name)}</title>
<desc id="desc">${escapeXml(`${header.greeting} ${header.name}. ${roles.join('. ')}. ${header.location ?? ''}`)}</desc>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${theme.bg}"/>
<stop offset="1" stop-color="${isDark ? '#1f0b0a' : '#fff4f2'}"/>
</linearGradient>
<radialGradient id="glow" cx="0.82" cy="0.2" r="0.55">
<stop offset="0" stop-color="${theme.accent}" stop-opacity="${isDark ? 0.22 : 0.08}"/>
<stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="bokeh">
<stop offset="0" stop-color="${theme.accentStrong}"/>
<stop offset="0.55" stop-color="${theme.accent}" stop-opacity="${isDark ? 0.55 : 0.8}"/>
<stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="fadeGradient" x1="0" y1="0" x2="1" y2="0">
<stop offset="0.42" stop-color="#fff" stop-opacity="0"/>
<stop offset="0.7" stop-color="#fff" stop-opacity="1"/>
</linearGradient>
<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fadeGradient)"/></mask>
<clipPath id="frame"><rect width="${WIDTH}" height="${HEIGHT}" rx="16"/></clipPath>
</defs>
<style>
.greet{font:500 15px ${FONT_MONO};fill:${theme.accent}}
.name{font:700 44px ${FONT_SANS};fill:${theme.title};letter-spacing:-0.5px}
.type{font:400 ${FONT_SIZE}px ${FONT_MONO};fill:${theme.text}}
.prompt{font:700 ${FONT_SIZE}px ${FONT_MONO};fill:${theme.accent}}
.meta{font:400 13px ${FONT_SANS};fill:${theme.muted}}
.caret{fill:${theme.accent};animation:blink 1.05s steps(1) infinite}
.static{display:none}
.p{transform-box:fill-box;transform-origin:center;animation:drift-a 12s ease-in-out infinite}
.b{animation-name:drift-b}
.c{animation-name:drift-c}
@keyframes blink{50%{opacity:0}}
@keyframes drift-a{0%,100%{transform:translate(0,0)}50%{transform:translate(-10px,-14px)}}
@keyframes drift-b{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(8px,-10px) scale(1.12)}}
@keyframes drift-c{0%,100%{transform:translate(0,0);opacity:${isDark ? 0.25 : 0.45}}50%{transform:translate(-4px,10px);opacity:${isDark ? 0.6 : 0.85}}}
@media (prefers-reduced-motion:reduce){.p,.caret{animation:none}.typed{display:none}.static{display:inline}}
</style>
<g clip-path="url(#frame)">
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
${particles(theme)}
</g>
<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16" stroke="${theme.border}"/>
<text x="${TEXT_X}" y="76" class="greet">${escapeXml(header.greeting)}</text>
<text x="${TEXT_X - 2}" y="126" class="name">${escapeXml(header.name)}</text>
<text x="${TEXT_X}" y="${TYPE_Y}" class="prompt">›</text>
<g class="typed">
${typed}
<rect class="caret" x="${TYPE_X + 2}" y="${TYPE_Y - 15}" width="9" height="19" rx="1">${animate('x', caretX, keyTimes, total)}</rect>
</g>
<g class="static">
<text class="type" x="${TYPE_X}" y="${TYPE_Y}" textLength="${([...first].length * CHAR_W).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${escapeXml(first)}</text>
<rect x="${(TYPE_X + 2 + [...first].length * CHAR_W).toFixed(1)}" y="${TYPE_Y - 15}" width="9" height="19" rx="1" fill="${theme.accent}"/>
</g>
${meta.join('\n')}
</svg>
`;
}
