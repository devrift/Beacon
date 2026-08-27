import type { Appearance, Theme, ThemeTokens } from './types';
import {
  FONT_SCALE_VALUES,
  RADIUS_VALUES,
  TOKEN_FIELDS,
  UI_FONT_STACKS,
} from './types';
import { hexToHsl, hexToRgb, hslToHex, mixHex, normalizeHex, readableOn } from './color';

// ─────────────────────────────────────────────────────────────────────────────
// Turning a theme into live CSS.
//
// Every token becomes a custom property on :root, plus an `-rgb` channel triplet
// so stylesheets can build translucent variants (`rgb(var(--accent-rgb) / 0.12)`)
// without us pre-computing every alpha step.
// ─────────────────────────────────────────────────────────────────────────────

const VAR_NAMES: Record<keyof ThemeTokens, string> = {
  bg: '--bg',
  panel: '--panel',
  surface: '--surface',
  raised: '--raised',
  hover: '--hover',
  active: '--active',
  border: '--border',
  borderStrong: '--border-strong',
  text: '--text',
  textDim: '--text-dim',
  textMute: '--text-mute',
  accent: '--accent',
  accentFg: '--accent-fg',
  ok: '--ok',
  warn: '--warn',
  danger: '--danger',
};

/** Tokens that also get an `-rgb` triplet, because we composite them with alpha. */
const RGB_TOKENS: (keyof ThemeTokens)[] = [
  'accent',
  'danger',
  'ok',
  'warn',
  'text',
  'bg',
  'border',
];

const STYLE_TAG_ID = 'beacon-custom-css';

export function applyTheme(theme: Theme, appearance: Appearance): void {
  const root = document.documentElement;
  const { tokens } = theme;

  for (const field of TOKEN_FIELDS) {
    const value = normalizeHex(tokens[field.key]) ?? tokens[field.key];
    root.style.setProperty(VAR_NAMES[field.key], value);
  }

  for (const key of RGB_TOKENS) {
    const { r, g, b } = hexToRgb(tokens[key]);
    root.style.setProperty(`${VAR_NAMES[key]}-rgb`, `${r} ${g} ${b}`);
  }

  // Shadows read as a darkening of the canvas, so they stay believable in light
  // themes instead of turning into grey smudges.
  const shadowStrength = theme.mode === 'dark' ? 0.5 : 0.12;
  root.style.setProperty('--shadow-color', `rgb(0 0 0 / ${shadowStrength})`);

  // Named --geo-* rather than --radius-*: Tailwind 4 owns the --radius-*
  // namespace, and pointing it at itself would resolve to nothing.
  const radius = RADIUS_VALUES[appearance.radius];
  root.style.setProperty('--geo-sm', radius.sm);
  root.style.setProperty('--geo-md', radius.md);
  root.style.setProperty('--geo-lg', radius.lg);
  root.style.setProperty('--geo-xl', radius.xl);

  root.style.setProperty('--font-scale', FONT_SCALE_VALUES[appearance.fontScale]);
  root.style.setProperty('--ui-font', UI_FONT_STACKS[appearance.uiFont]);
  root.style.setProperty('--row-gap', appearance.density === 'compact' ? '2px' : '10px');
  root.style.setProperty('--row-pad', appearance.density === 'compact' ? '2px' : '5px');

  root.dataset.themeMode = theme.mode;
  root.dataset.themeId = theme.id;
  root.dataset.focusMode = appearance.focusMode ? 'on' : 'off';
  root.dataset.animations = appearance.animations ? 'on' : 'off';
  root.style.colorScheme = theme.mode;

  applyCustomCss(appearance.customCss);
}

/** Power-user escape hatch. Injected verbatim — it is the user's own document. */
export function applyCustomCss(css: string): void {
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!css.trim()) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generating a theme from one colour.
//
// The Theme Studio's opening move: pick a colour, get a complete theme. Greys
// are pulled a few degrees toward the accent's hue and given a trace of its
// saturation, which is what makes a palette read as one material rather than a
// coloured button dropped onto neutral grey.
// ─────────────────────────────────────────────────────────────────────────────

export function deriveThemeFromAccent(
  accentHex: string,
  mode: 'dark' | 'light',
  name = 'Custom',
): Theme {
  const accent = normalizeHex(accentHex) ?? '#8b8b95';
  const { h, s } = hexToHsl(accent);

  // Neutrals carry a whisper of the accent's chroma. Too much and every surface
  // looks tinted; none at all and the accent looks pasted on.
  const tint = Math.min(s, mode === 'dark' ? 14 : 10);
  const grey = (lightness: number) => hslToHex({ h, s: tint, l: lightness });

  const tokens: ThemeTokens =
    mode === 'dark'
      ? {
          bg: grey(3.5),
          panel: grey(5),
          surface: grey(6.5),
          raised: grey(9),
          hover: grey(12),
          active: grey(16),
          border: grey(14),
          borderStrong: grey(21),
          text: hslToHex({ h, s: Math.min(s, 8), l: 96 }),
          textDim: hslToHex({ h, s: Math.min(s, 10), l: 64 }),
          textMute: hslToHex({ h, s: Math.min(s, 10), l: 45 }),
          accent,
          accentFg: readableOn(accent),
          ok: '#4fbf88',
          warn: '#d9a63c',
          danger: '#e0605a',
        }
      : {
          bg: grey(97.5),
          panel: grey(100),
          surface: grey(100),
          raised: grey(100),
          hover: grey(94),
          active: grey(90),
          border: grey(91),
          borderStrong: grey(82),
          text: hslToHex({ h, s: Math.min(s, 14), l: 9 }),
          textDim: hslToHex({ h, s: Math.min(s, 12), l: 38 }),
          textMute: hslToHex({ h, s: Math.min(s, 10), l: 56 }),
          accent,
          accentFg: readableOn(accent),
          ok: '#1f9254',
          warn: '#b3711a',
          danger: '#c3352b',
        };

  return {
    id: `custom-${Date.now().toString(36)}`,
    name,
    blurb: mode === 'dark' ? 'Your theme, dark.' : 'Your theme, light.',
    mode,
    builtIn: false,
    tokens,
  };
}

/** Nudges every surface lighter or darker at once — the Studio's contrast dial. */
export function adjustThemeContrast(theme: Theme, amount: number): Theme {
  const target = theme.mode === 'dark' ? '#ffffff' : '#000000';
  const surfaceKeys: (keyof ThemeTokens)[] = [
    'bg',
    'panel',
    'surface',
    'raised',
    'hover',
    'active',
    'border',
    'borderStrong',
  ];
  const tokens = { ...theme.tokens };
  for (const key of surfaceKeys) {
    tokens[key] = mixHex(tokens[key], target, amount);
  }
  return { ...theme, tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Share codes.
//
// A theme is small enough to travel as a string, so sharing needs no server:
// copy the code, paste it anywhere, import it. Prefixed and versioned so we can
// change the payload later without silently mis-reading old codes.
// ─────────────────────────────────────────────────────────────────────────────

const CODE_PREFIX = 'beacon1:';

export function encodeTheme(theme: Theme): string {
  const payload = JSON.stringify({
    n: theme.name,
    b: theme.blurb,
    m: theme.mode,
    t: theme.tokens,
  });
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return CODE_PREFIX + base64;
}

export type DecodeResult = { ok: true; theme: Theme } | { ok: false; error: string };

export function decodeTheme(code: string): DecodeResult {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: 'Paste a theme code to import.' };
  if (!trimmed.startsWith(CODE_PREFIX)) {
    return { ok: false, error: "That does not look like a Beacon theme code — they start with 'beacon1:'." };
  }

  const base64 = trimmed.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  let parsed: unknown;
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, error: 'That code is damaged. Copy it again, all of it.' };
  }

  const record = parsed as { n?: unknown; b?: unknown; m?: unknown; t?: unknown };
  const rawTokens = record.t as Record<string, unknown> | undefined;
  if (!rawTokens || typeof rawTokens !== 'object') {
    return { ok: false, error: 'That code has no colours in it.' };
  }

  const tokens = {} as ThemeTokens;
  const missing: string[] = [];
  for (const field of TOKEN_FIELDS) {
    const value = rawTokens[field.key];
    const hex = typeof value === 'string' ? normalizeHex(value) : null;
    if (!hex) {
      missing.push(field.label);
      continue;
    }
    tokens[field.key] = hex;
  }
  if (missing.length > 0) {
    return { ok: false, error: `That theme is missing ${missing.slice(0, 3).join(', ')}.` };
  }

  const mode = record.m === 'light' ? 'light' : 'dark';
  return {
    ok: true,
    theme: {
      id: `custom-${Date.now().toString(36)}`,
      name: typeof record.n === 'string' && record.n.trim() ? record.n.trim().slice(0, 40) : 'Imported theme',
      blurb: typeof record.b === 'string' ? record.b.slice(0, 80) : 'Imported.',
      mode,
      builtIn: false,
      tokens,
    },
  };
}
