import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useAttachmentUrl } from '../hooks/useObjectUrl';
import { fileSize } from '../lib/time';
import type { Attachment } from '../store/useAppStore';

export function Lightbox() {
  const lightbox = useAppStore((s) => s.lightbox);
  const setLightbox = useAppStore((s) => s.setLightbox);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  if (!lightbox) return null;
  const { attachments, index } = lightbox;
  const current = attachments[index];
  if (!current) return null;

  function step(delta: number) {
    const state = useAppStore.getState().lightbox;
    if (!state) return;
    const next = (state.index + delta + state.attachments.length) % state.attachments.length;
    useAppStore.getState().setLightbox({ ...state, index: next });
  }

  return createPortal(
    <div className="anim-fade fixed inset-0 z-[70] flex flex-col bg-black/85 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 text-white/70">
        <div className="truncate text-[13px]">
          {current.name} <span className="text-white/40">· {fileSize(current.size)}</span>
        </div>
        <div className="flex items-center gap-1">
          <DownloadLink attachment={current} />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="grid h-8 w-8 place-items-center rounded-sm hover:bg-white/10"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {attachments.length > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            title="Previous"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <Frame attachment={current} />
        {attachments.length > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            title="Next"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Frame({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment);
  if (!url) return <div className="text-[13px] text-white/50">Loading…</div>;
  if (attachment.kind === 'video') {
    return <video src={url} controls autoPlay className="max-h-full max-w-full rounded-md" />;
  }
  return (
    <img
      src={url}
      alt={attachment.name}
      className="max-h-full max-w-full rounded-md object-contain"
    />
  );
}

/** Own component so the object-URL hook runs unconditionally. */
function DownloadLink({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment);
  return (
    <a
      href={url ?? undefined}
      download={attachment.name}
      className="grid h-8 w-8 place-items-center rounded-sm hover:bg-white/10"
      title="Download"
    >
      <Download size={17} />
    </a>
  );
}
