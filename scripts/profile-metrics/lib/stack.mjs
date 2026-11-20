// Tech-stack card: category rows of monochrome "chips". Rendered in the same
// design system as the metric cards instead of relying on a badge service.

import { BRAND_ICONS } from './brand-icons.mjs';
import { delay, escapeXml, frame } from './render.mjs';
import { FONT_SANS } from './theme.mjs';

const WIDTH = 900;
const ROW_H = 40;
const CHIP_H = 28;
const GAP = 8;
const CHIPS_X = 184;
const FONT_SIZE = 12.5;

// Simple Icons slug per technology. Marks Simple Icons no longer ships
// (e.g. C#, SQL Server) fall back to a neutral accent dot.
const ICON_FOR = {
  '.net': 'dotnet',
  'asp.net core': 'dotnet',
  flutter: 'flutter',
  dart: 'dart',
  typescript: 'typescript',
  javascript: 'javascript',
  kubernetes: 'kubernetes',
  helm: 'helm',
  docker: 'docker',
  terraform: 'terraform',
  'google cloud': 'googlecloud',
  cloudflare: 'cloudflare',
  'github actions': 'githubactions',
  'argo cd': 'argo',
  jenkins: 'jenkins',
  mysql: 'mysql',
  'node.js': 'nodedotjs',
};

// Approximate advance widths (Helvetica metrics, em/1000) for chip sizing.
const WIDTHS = {
  ' ': 278, '.': 278, ',': 278, '#': 556, '&': 667, '-': 333, '/': 278, '+': 584,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
};

export function textWidth(text, size = FONT_SIZE) {
  let units = 0;
  for (const ch of text) units += WIDTHS[ch] ?? (/\d/.test(ch) ? 556 : 600);
  return (units / 1000) * size * 1.04; // weight 500 runs slightly wider
}

function chip(name, x, y, theme) {
  const slug = ICON_FOR[name.toLowerCase()];
  const labelX = slug ? x + 32 : x + 26;
  const width = labelX - x + textWidth(name) + 13;
  const mark = slug
    ? `<path transform="translate(${x + 11} ${y + 7}) scale(${(14 / 24).toFixed(4)})" fill="${theme.text}" d="${BRAND_ICONS[slug]}"/>`
    : `<circle cx="${x + 15}" cy="${y + CHIP_H / 2}" r="3.5" fill="${theme.accent}"/>`;
  return {
    width,
    svg: `<rect x="${x}" y="${y}" width="${width.toFixed(1)}" height="${CHIP_H}" rx="${CHIP_H / 2}" fill="${theme.surface}" stroke="${theme.border}"/>
${mark}
<text x="${labelX}" y="${y + 18.5}" class="chip">${escapeXml(name)}</text>`,
  };
}

export function renderStack(groups, theme) {
  const rows = [];
  let y = 22; // the README's "Tech stack" heading titles this card
  let index = 0;
  for (const group of groups) {
    const parts = [];
    let x = CHIPS_X;
    const top = y;
    for (const name of group.items) {
      const probe = chip(name, x, y, theme);
      if (x > CHIPS_X && x + probe.width > WIDTH - 24) {
        x = CHIPS_X;
        y += ROW_H;
      }
      const placed = chip(name, x, y, theme);
      parts.push(`<g class="fade" ${delay(80 + index * 35)}>${placed.svg}</g>`);
      x += placed.width + GAP;
      index += 1;
    }
    rows.push(`<text x="24" y="${top + 18.5}" class="cat">${escapeXml(group.label.toUpperCase())}</text>\n${parts.join('\n')}`);
    y += ROW_H;
  }
  const height = y + 10;

  return frame({
    width: WIDTH,
    height,
    theme,
    title: 'Tech stack',
    desc: groups.map((g) => `${g.label}: ${g.items.join(', ')}`).join('. '),
    extraStyle: `
.cat{font:600 11px ${FONT_SANS};fill:${theme.muted};letter-spacing:.8px}
.chip{font:500 ${FONT_SIZE}px ${FONT_SANS};fill:${theme.text}}`,
    body: rows.join('\n'),
  });
}
