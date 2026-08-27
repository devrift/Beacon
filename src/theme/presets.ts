import type { Theme, ThemeTokens } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// The eight themes Beacon ships with.
//
// Each one is designed as a whole rather than a hue-rotation of the others: the
// greys are tinted to agree with the accent, so a theme reads as one material.
// None of them are neon. `graphite` is the default and is intentionally free of
// chroma — the app has no colour of its own until you give it one.
// ─────────────────────────────────────────────────────────────────────────────

function theme(
  id: string,
  name: string,
  blurb: string,
  mode: 'dark' | 'light',
  tokens: ThemeTokens,
): Theme {
  return { id, name, blurb, mode, builtIn: true, tokens };
}

export const PRESET_THEMES: Theme[] = [
  theme('graphite', 'Obsidian', 'Cool black, bone light. The app brings no colour of its own.', 'dark', {
    bg: '#0a0b0d',
    panel: '#0a0b0d',
    surface: '#0a0b0d',
    raised: '#13151a',
    hover: '#15171c',
    active: '#1c1f26',
    border: '#1c1e24',
    borderStrong: '#2a2d36',
    text: '#eceef2',
    textDim: '#9aa0ab',
    textMute: '#666c78',
    accent: '#e8e6e1',
    accentFg: '#0a0b0d',
    ok: '#5eb08c',
    warn: '#cfa64a',
    danger: '#dd6a63',
  }),

  theme('ink', 'Ink', 'Warm charcoal and brass. Reads like paper at night.', 'dark', {
    bg: '#0b0a09',
    panel: '#0f0e0c',
    surface: '#13120f',
    raised: '#1a1815',
    hover: '#201e1a',
    active: '#282520',
    border: '#26231f',
    borderStrong: '#332f29',
    text: '#f4f1ea',
    textDim: '#a39d93',
    textMute: '#746f66',
    accent: '#c89b5c',
    accentFg: '#17140f',
    ok: '#6fae86',
    warn: '#d2a247',
    danger: '#d4645a',
  }),

  theme('slate', 'Slate', 'Cool grey-green. Quiet and long-session friendly.', 'dark', {
    bg: '#080b0c',
    panel: '#0b0f10',
    surface: '#0f1315',
    raised: '#151a1c',
    hover: '#1a2023',
    active: '#21282b',
    border: '#1e2528',
    borderStrong: '#2a3336',
    text: '#edf2f2',
    textDim: '#94a2a5',
    textMute: '#667578',
    accent: '#7fb79b',
    accentFg: '#0a1512',
    ok: '#5fbf95',
    warn: '#d3a54d',
    danger: '#db6259',
  }),

  theme('amethyst', 'Amethyst', 'Violet-tinted dark. Colour without shouting.', 'dark', {
    bg: '#09080d',
    panel: '#0d0b12',
    surface: '#110f17',
    raised: '#17141f',
    hover: '#1d1927',
    active: '#241f30',
    border: '#241f30',
    borderStrong: '#322b42',
    text: '#f2f0f7',
    textDim: '#9e98ae',
    textMute: '#6e6880',
    accent: '#9b7bf7',
    accentFg: '#0b0814',
    ok: '#5cc08d',
    warn: '#d6a648',
    danger: '#e06168',
  }),

  theme('ember', 'Ember', 'Near-black with a rust accent. Warm but not loud.', 'dark', {
    bg: '#0a0908',
    panel: '#0e0c0b',
    surface: '#12100e',
    raised: '#191614',
    hover: '#201c19',
    active: '#28231f',
    border: '#262220',
    borderStrong: '#342e2a',
    text: '#f5f1ee',
    textDim: '#a39a94',
    textMute: '#736b66',
    accent: '#d2603f',
    accentFg: '#140805',
    ok: '#63b58a',
    warn: '#d8a44a',
    danger: '#dc5a50',
  }),

  theme('nocturne', 'Nocturne', 'True black for OLED. Maximum contrast, zero glow.', 'dark', {
    bg: '#000000',
    panel: '#050506',
    surface: '#08080a',
    raised: '#0e0e11',
    hover: '#141418',
    active: '#1b1b20',
    border: '#1a1a1f',
    borderStrong: '#26262c',
    text: '#f7f7f8',
    textDim: '#9a9aa4',
    textMute: '#67676f',
    accent: '#ffffff',
    accentFg: '#000000',
    ok: '#46c286',
    warn: '#d8a63f',
    danger: '#e45c55',
  }),

  theme('paper', 'Paper', 'Warm white with ink-black accents. Daylight reading.', 'light', {
    bg: '#faf9f6',
    panel: '#f4f2ed',
    surface: '#ffffff',
    raised: '#ffffff',
    hover: '#efede7',
    active: '#e6e3db',
    border: '#e2dfd7',
    borderStrong: '#cfcbc1',
    text: '#171614',
    textDim: '#5f5c55',
    textMute: '#8a867d',
    accent: '#1f1e1b',
    accentFg: '#faf9f6',
    ok: '#2f855a',
    warn: '#b7791f',
    danger: '#c53030',
  }),

  theme('frost', 'Frost', 'Cool light grey with a measured blue.', 'light', {
    bg: '#f6f8fa',
    panel: '#ffffff',
    surface: '#ffffff',
    raised: '#ffffff',
    hover: '#edf1f5',
    active: '#e1e8ef',
    border: '#e3e8ed',
    borderStrong: '#cbd3db',
    text: '#10151a',
    textDim: '#55606b',
    textMute: '#808b96',
    accent: '#3b6fd4',
    accentFg: '#ffffff',
    ok: '#1f9254',
    warn: '#b3711a',
    danger: '#c3352b',
  }),
];

export const DEFAULT_THEME_ID = 'graphite';

export function findPreset(id: string): Theme | undefined {
  return PRESET_THEMES.find((t) => t.id === id);
}
