import { useEffect } from 'react';
import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react';
import { useAppStore, type Toast, type ToastKind } from '../store/useAppStore';
import { IconButton } from './primitives';

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  ok: CheckCircle2,
  warn: TriangleAlert,
  danger: XCircle,
};

const TONE: Record<ToastKind, string> = {
  info: 'text-ink-dim',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useAppStore((s) => s.dismissToast);
  const Icon = ICONS[toast.kind];

  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), 4200);
    return () => window.clearTimeout(id);
  }, [toast.id, dismiss]);

  return (
    <div className="pop anim-slide-up pointer-events-auto flex w-[320px] items-start gap-2.5 px-3.5 py-3">
      <Icon size={16} className={`mt-px shrink-0 ${TONE[toast.kind]}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{toast.title}</div>
        {toast.detail && (
          <div className="mt-0.5 text-[12px] leading-snug text-ink-mute">{toast.detail}</div>
        )}
      </div>
      <IconButton label="Dismiss" size="sm" onClick={() => dismiss(toast.id)} className="-mt-1 -mr-1">
        <X size={14} />
      </IconButton>
    </div>
  );
}

export function ToastHost() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
