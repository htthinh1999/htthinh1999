// Design tokens shared by every generated SVG.
// Neutrals follow GitHub's Primer palette so the cards sit naturally on the
// profile page; the accent carries the profile's crimson brand colour.

export const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
export const FONT_MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

export const THEMES = {
  dark: {
    name: 'dark',
    bg: '#0d1117',
    surface: '#161b22',
    border: '#30363d',
    title: '#f0f6fc',
    text: '#c9d1d9',
    muted: '#8b949e',
    track: '#21262d',
    accent: '#ff6b81',
    accentStrong: '#ff8fa0',
    accentSoft: '#ff6b8126',
    empty: '#30363d',
  },
  light: {
    name: 'light',
    bg: '#ffffff',
    surface: '#f6f8fa',
    border: '#d0d7de',
    title: '#1f2328',
    text: '#1f2328',
    muted: '#59636e',
    track: '#eaeef2',
    accent: '#d6264a',
    accentStrong: '#b5173a',
    accentSoft: '#d6264a1f',
    empty: '#d0d7de',
  },
};

export const THEME_NAMES = Object.keys(THEMES);
