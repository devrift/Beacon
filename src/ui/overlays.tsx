import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';
import { IconButton } from './primitives';

// ─────────────────────────────────────────────────────────────────────────────
// Escape + scroll lock, shared by every overlay so the behaviour is uniform.
// ─────────────────────────────────────────────────────────────────────────────

function useEscape(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, active]);
}

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/** Moves focus into a container on mount and keeps Tab from escaping it. */
function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    // Focus the first real control, or the container itself as a fallback.
    const first = focusables()[0];
    (first ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };

    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [active]);

  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal — a centred dialog on a frosted scrim.
// ─────────────────────────────────────────────────────────────────────────────

const MODAL_WIDTHS = {
  sm: 'max-w-[400px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[680px]',
  xl: 'max-w-[860px]',
  xxl: 'max-w-[1120px]',
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof MODAL_WIDTHS;
  dismissable?: boolean;
}) {
  useEscape(() => dismissable && onClose(), open);
  useScrollLock(open);
  const trapRef = useFocusTrap(open);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => dismissable && onClose()}
        className="scrim anim-fade fixed inset-0 cursor-default"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          'sheet anim-rise relative my-auto w-full outline-none',
          MODAL_WIDTHS[width],
        )}
      >
        {(title || dismissable) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>}
              {description && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">{description}</p>
              )}
            </div>
            {dismissable && (
              <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-1">
                <X size={17} />
              </IconButton>
            )}
          </header>
        )}
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Popover — anchored panel that flips to stay on screen.
// ─────────────────────────────────────────────────────────────────────────────

type Placement = 'top' | 'bottom' | 'top-end' | 'bottom-end';

export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  placement = 'top',
  className,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  placement?: Placement;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEscape(onClose, open);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const gap = 8;
    const margin = 8;

    let top =
      placement.startsWith('top') ? a.top - p.height - gap : a.bottom + gap;
    let left = placement.endsWith('end') ? a.right - p.width : a.left;

    // Flip vertically if the preferred side would clip.
    if (top < margin && placement.startsWith('top')) top = a.bottom + gap;
    if (top + p.height > window.innerHeight - margin && placement.startsWith('bottom')) {
      top = a.top - p.height - gap;
    }
    // Clamp horizontally into the viewport.
    left = Math.max(margin, Math.min(left, window.innerWidth - p.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - p.height - margin));

    setPos({ top, left });
  }, [anchorRef, placement]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // Dismiss on any pointer press outside the panel or its anchor.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      className={cx('pop anim-pop fixed z-50 outline-none', className)}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // Hidden until measured, so it never flashes at the wrong spot.
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm — the one dialog we reuse for every destructive action.
// ─────────────────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Delete',
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="sm">
      <p className="text-[13px] leading-relaxed text-ink-dim">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-md px-3.5 text-[13px] font-medium text-ink-dim hover:bg-hover hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cx(
            'h-9 rounded-md px-3.5 text-[13px] font-medium text-white',
            danger ? 'bg-danger hover:brightness-110' : 'bg-accent text-accent-ink hover:brightness-110',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
