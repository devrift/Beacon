// ─────────────────────────────────────────────────────────────────────────────
// Theme token schema.
//
// Beacon's visual identity is deliberately colourless by default: the app ships
// a monochrome theme and every drop of colour in the UI comes from whichever
// theme the user picks or builds. That means the token set below is the single
// source of truth for the entire surface of the app — if a component hardcodes
// a colour, theming is broken.
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

export interface ThemeTokens {
  /** App base canvas — the layer everything else sits on. */
  bg: string;
  /** Rail and sidebars. */
  panel: string;
  /** The inset conversation sheet and cards. */
  surface: string;
  /** Popovers, modals, composer — the layer closest to the user. */
  raised: string;
  /** Hover feedback on interactive rows. */
  hover: string;
  /** Active / pressed / selected rows. */
  active: string;
  /** Hairline dividers. */
  border: string;
  /** Stronger dividers and input outlines. */
  borderStrong: string;
  /** Primary reading text. */
  text: string;
  /** Secondary text — metadata, descriptions. */
  textDim: string;
  /** Tertiary text — timestamps, placeholders, disabled. */
  textMute: string;
  /** The one brand colour. Drives actions, focus rings, active glyphs. */
  accent: string;
  /** Text/icon colour that sits legibly on top of `accent`. */
  accentFg: string;
  /** Success, online presence. */
  ok: string;
  /** Warning, idle presence. */
  warn: string;
  /** Destructive, do-not-disturb presence. */
  danger: string;
}

export interface Theme {
  id: string;
  name: string;
  /** One short line shown in the theme picker. Sentence case, no selling. */
  blurb: string;
  mode: ThemeMode;
  /** True for the eight themes that ship with Beacon; false for user themes. */
  builtIn: boolean;
  tokens: ThemeTokens;
}

// ─── Studio metadata ─────────────────────────────────────────────────────────
// Drives the Theme Studio's editor. Grouped so the panel reads as a short list
// of decisions rather than seventeen colour pickers.

export type TokenGroup = 'surfaces' | 'text' | 'accent' | 'status';

export interface TokenField {
  key: keyof ThemeTokens;
  label: string;
  help: string;
  group: TokenGroup;
}

export const TOKEN_GROUPS: { id: TokenGroup; label: string; blurb: string }[] = [
  { id: 'surfaces', label: 'Surfaces', blurb: 'The layers the app is built from, back to front.' },
  { id: 'text', label: 'Text', blurb: 'Reading hierarchy, brightest to quietest.' },
  { id: 'accent', label: 'Accent', blurb: 'The one colour that marks actions and focus.' },
  { id: 'status', label: 'Status', blurb: 'Presence dots and destructive actions.' },
];

export const TOKEN_FIELDS: TokenField[] = [
  { key: 'bg', label: 'Canvas', help: 'The base layer behind everything.', group: 'surfaces' },
  { key: 'panel', label: 'Panel', help: 'Server rail and sidebars.', group: 'surfaces' },
  { key: 'surface', label: 'Sheet', help: 'The conversation area and cards.', group: 'surfaces' },
  { key: 'raised', label: 'Raised', help: 'Menus, dialogs and the composer.', group: 'surfaces' },
  { key: 'hover', label: 'Hover', help: 'Feedback when pointing at a row.', group: 'surfaces' },
  { key: 'active', label: 'Selected', help: 'The channel or row you are on.', group: 'surfaces' },
  { key: 'border', label: 'Hairline', help: 'Quiet dividers between regions.', group: 'surfaces' },
  { key: 'borderStrong', label: 'Divider', help: 'Input outlines and firm edges.', group: 'surfaces' },

  { key: 'text', label: 'Primary', help: 'Message bodies and titles.', group: 'text' },
  { key: 'textDim', label: 'Secondary', help: 'Names, labels, descriptions.', group: 'text' },
  { key: 'textMute', label: 'Muted', help: 'Timestamps and placeholders.', group: 'text' },

  { key: 'accent', label: 'Accent', help: 'Buttons, links, focus rings.', group: 'accent' },
  { key: 'accentFg', label: 'On accent', help: 'Text that sits on the accent.', group: 'accent' },

  { key: 'ok', label: 'Online', help: 'Success and online presence.', group: 'status' },
  { key: 'warn', label: 'Idle', help: 'Warnings and idle presence.', group: 'status' },
  { key: 'danger', label: 'Danger', help: 'Delete, leave, do not disturb.', group: 'status' },
];

// ─── Appearance (separate from colour) ───────────────────────────────────────

/** Corner geometry. Beacon leans square; `sharp` is a real option, not a joke. */
export type RadiusScale = 'sharp' | 'soft' | 'round';
/** Vertical rhythm of the message list. */
export type Density = 'comfortable' | 'compact';
export type FontScale = 'sm' | 'md' | 'lg';
/** Body/UI typeface. Display and mono faces stay fixed. */
export type UiFont = 'inter' | 'system' | 'mono' | 'serif';

export interface Appearance {
  radius: RadiusScale;
  density: Density;
  fontScale: FontScale;
  uiFont: UiFont;
  /** Dim everything except the conversation. */
  focusMode: boolean;
  /** Honour the OS reduced-motion preference on top of this. */
  animations: boolean;
  /** Escape hatch for power users. Injected verbatim into a <style> tag. */
  customCss: string;
}

export const DEFAULT_APPEARANCE: Appearance = {
  radius: 'soft',
  density: 'comfortable',
  fontScale: 'md',
  uiFont: 'inter',
  focusMode: false,
  animations: true,
  customCss: '',
};

export const RADIUS_VALUES: Record<RadiusScale, { sm: string; md: string; lg: string; xl: string }> = {
  sharp: { sm: '2px', md: '3px', lg: '4px', xl: '6px' },
  soft: { sm: '5px', md: '8px', lg: '11px', xl: '15px' },
  round: { sm: '8px', md: '13px', lg: '18px', xl: '24px' },
};

export const FONT_SCALE_VALUES: Record<FontScale, string> = {
  sm: '13px',
  md: '14px',
  lg: '15.5px',
};

export const UI_FONT_STACKS: Record<UiFont, string> = {
  inter:
    "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  system:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  serif: "'Instrument Serif', ui-serif, Georgia, Cambria, 'Times New Roman', serif",
};

export const UI_FONT_LABELS: Record<UiFont, string> = {
  inter: 'Inter',
  system: 'System',
  mono: 'JetBrains Mono',
  serif: 'Instrument Serif',
};
