import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from 'react';
import { cx } from '../lib/cx';
import { monogram } from '../lib/id';
import { useAttachmentUrl } from '../hooks/useObjectUrl';
import type { Attachment, Presence } from '../store/useAppStore';

// ─────────────────────────────────────────────────────────────────────────────
// The shared vocabulary. Every colour here is a semantic token, so a theme
// change repaints the whole app without a single component re-rendering.
// ─────────────────────────────────────────────────────────────────────────────

type ButtonVariant = 'accent' | 'solid' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 font-medium select-none ' +
  'transition-[background-color,border-color,color,opacity,transform] duration-150 ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-40';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  accent: 'bg-accent text-accent-ink hover:brightness-110',
  solid: 'bg-raised text-ink border border-line hover:bg-hover hover:border-line-strong',
  outline: 'border border-line-strong text-ink hover:bg-hover',
  ghost: 'text-ink-dim hover:bg-hover hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[12px] rounded-sm',
  md: 'h-9 px-3.5 text-[13px] rounded-md',
  lg: 'h-11 px-5 text-[14px] rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({
  variant = 'solid',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — these buttons have no text of their own. */
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
  tone?: 'default' | 'danger';
  /** React 19 passes ref straight through as a prop; popovers anchor to it. */
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  size = 'md',
  active = false,
  tone = 'default',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-sm transition-colors duration-150',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        tone === 'danger'
          ? 'text-ink-mute hover:bg-danger/12 hover:text-danger'
          : active
            ? 'bg-active text-ink'
            : 'text-ink-mute hover:bg-hover hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-35',
        className,
      )}
      {...rest}
    />
  );
}

/** A keycap. Uses the mono face so shortcut hints line up in a column. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line
                 bg-raised px-1.5 font-mono text-[10px] font-medium text-ink-mute"
    >
      {children}
    </kbd>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-line-strong',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] h-3 w-3 rounded-full transition-[left] duration-200',
          checked ? 'left-[17px] bg-accent-ink' : 'left-[3px] bg-canvas',
        )}
      />
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-md border border-line bg-canvas p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cx(
              'h-7 rounded-[calc(var(--geo-md)-3px)] px-3 text-[12px] font-medium transition-colors duration-150',
              selected ? 'bg-raised text-ink' : 'text-ink-mute hover:text-ink-dim',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, invalid = false, ...rest }: InputProps) {
  return (
    <input
      className={cx(
        'field h-9 w-full px-3 text-[13px]',
        invalid && 'border-danger/60',
        className,
      )}
      {...rest}
    />
  );
}

export function TextArea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      className={cx('field w-full resize-none px-3 py-2 text-[13px] leading-relaxed', className)}
      {...rest}
    />
  );
}

/** A labelled row: name and helper text on the left, control on the right. */
export function SettingRow({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{title}</div>
        {help && <div className="mt-0.5 text-[12px] leading-snug text-ink-mute">{help}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.04em] text-ink-mute uppercase">
      {children}
    </label>
  );
}

/** Section heading inside sidebars and panels. Sentence case, never shouting. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-4 pb-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-mute">
      {children}
    </div>
  );
}

// ─── Presence ────────────────────────────────────────────────────────────────

const PRESENCE_COLOR: Record<Presence, string> = {
  online: 'var(--ok)',
  idle: 'var(--warn)',
  dnd: 'var(--danger)',
  offline: 'var(--text-mute)',
};

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: 'Online',
  idle: 'Away',
  dnd: 'Do not disturb',
  offline: 'Invisible',
};

const AVATAR_SIZES = {
  xs: { box: 'h-5 w-5 text-[9px] rounded-full', dot: 6, radius: 999 },
  sm: { box: 'h-7 w-7 text-[11px] rounded-full', dot: 8, radius: 999 },
  md: { box: 'h-9 w-9 text-[13px] rounded-full', dot: 10, radius: 999 },
  lg: { box: 'h-16 w-16 text-[22px] rounded-full', dot: 14, radius: 999 },
} as const;

export function Avatar({
  name,
  color,
  image,
  size = 'md',
  presence,
  speaking = false,
}: {
  name: string;
  color: string;
  image?: Attachment;
  size?: keyof typeof AVATAR_SIZES;
  presence?: Presence;
  speaking?: boolean;
}) {
  const spec = AVATAR_SIZES[size];
  const imageUrl = useAttachmentUrl(image);
  return (
    <div className="relative shrink-0">
      <div
        className={cx(
          'grid place-items-center font-semibold',
          spec.box,
          speaking && 'ring-2 ring-ok',
        )}
        style={{
          backgroundColor: color,
          // Monograms sit on an arbitrary user colour, so the glyph is a knocked-out
          // hole in it rather than a guessed black or white.
          color: 'color-mix(in oklab, var(--bg) 78%, transparent)',
        }}
        aria-hidden
      >
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full rounded-full object-cover" /> : monogram(name)}
      </div>
      {presence && (
        <span
          className="absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-panel"
          style={{
            width: spec.dot,
            height: spec.dot,
            backgroundColor: PRESENCE_COLOR[presence],
          }}
          title={PRESENCE_LABEL[presence]}
        />
      )}
    </div>
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-line-strong border-t-accent',
        className,
      )}
      aria-hidden
    />
  );
}

/** Shown wherever a list is legitimately empty. Always offers the next move. */
export function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-8 py-14 text-center">
      {icon && <div className="mb-1 text-ink-mute">{icon}</div>}
      <div className="text-[13px] font-medium text-ink-dim">{title}</div>
      {detail && <div className="max-w-[38ch] text-[12px] leading-relaxed text-ink-mute">{detail}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
