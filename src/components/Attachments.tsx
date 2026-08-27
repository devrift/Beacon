import { useRef, useState } from 'react';
import { Download, File as FileIcon, Pause, Play } from 'lucide-react';
import { cx } from '../lib/cx';
import { duration as fmtDuration, fileSize } from '../lib/time';
import { useAttachmentUrl } from '../hooks/useObjectUrl';
import { useAppStore, type Attachment } from '../store/useAppStore';
import { useFileTransfer } from '../hooks/useFileTransfer';

export function Attachments({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter((a) => a.kind === 'image');
  const others = attachments.filter((a) => a.kind !== 'image');

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {images.length > 0 && (
        <div className={cx('flex flex-wrap gap-1.5', images.length > 1 && 'max-w-[520px]')}>
          {images.map((a, i) => (
            <ImageTile key={a.id} attachment={a} all={images} index={i} solo={images.length === 1} />
          ))}
        </div>
      )}
      {others.map((a) =>
        a.kind === 'audio' ? (
          <AudioCard key={a.id} attachment={a} />
        ) : a.kind === 'video' ? (
          <VideoCard key={a.id} attachment={a} />
        ) : (
          <FileCard key={a.id} attachment={a} />
        ),
      )}
    </div>
  );
}

function ImageTile({
  attachment,
  all,
  index,
  solo,
}: {
  attachment: Attachment;
  all: Attachment[];
  index: number;
  solo: boolean;
}) {
  const url = useAttachmentUrl(attachment);
  const setLightbox = useAppStore((s) => s.setLightbox);

  // Reserve the real aspect ratio so the list doesn't jump when it loads.
  const ratio =
    attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;

  return (
    <button
      type="button"
      onClick={() => setLightbox({ attachments: all, index })}
      className="group relative overflow-hidden rounded-md border border-line bg-canvas"
      style={{
        width: solo ? Math.min(400, (attachment.width ?? 400)) : 168,
        aspectRatio: String(ratio),
      }}
      title={attachment.name}
    >
      {url ? (
        <img
          src={url}
          alt={attachment.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-hover" />
      )}
    </button>
  );
}

function VideoCard({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment);
  if (!url) return <Shell>{attachment.name}</Shell>;
  return (
    <video
      src={url}
      controls
      className="max-w-[420px] rounded-md border border-line"
      preload="metadata"
    />
  );
}

/** Voice notes and audio files, with the recorded waveform when we have one. */
function AudioCard({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const peaks = attachment.peaks ?? [];
  const total = attachment.duration ?? 0;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="flex max-w-[400px] items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
      <button
        type="button"
        onClick={toggle}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-px" />}
      </button>

      <div className="flex h-8 min-w-0 flex-1 items-center gap-[2px]">
        {peaks.length > 0 ? (
          peaks.map((peak, i) => {
            const played = progress > 0 && i / peaks.length <= progress;
            return (
              <span
                key={i}
                className={cx('w-full rounded-full', played ? 'bg-accent' : 'bg-line-strong')}
                style={{ height: `${Math.max(12, peak * 100)}%` }}
              />
            );
          })
        ) : (
          <div className="h-1 w-full overflow-hidden rounded-full bg-line-strong">
            <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      <span className="shrink-0 font-mono text-[11px] text-ink-mute tnum">
        {fmtDuration(total * (progress || 0) || total)}
      </span>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress(el.currentTime / el.duration);
          }}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
          }}
        />
      )}
    </div>
  );
}

function FileCard({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment);
  const transfer = useFileTransfer();
  const percentage = Math.round(transfer.progress(attachment.id) * 100);
  if (attachment.p2p) {
    return (
      <button type="button" onClick={() => void transfer.download(attachment)} className="flex max-w-[340px] items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left hover:border-line-strong">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-raised text-ink-mute"><Download size={15} /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-ink">{attachment.name}</span><span className="block text-[11px] text-ink-mute">{fileSize(attachment.size)} · {percentage > 0 && percentage < 100 ? `${percentage}%` : 'Download via P2P'}</span></span>
      </button>
    );
  }
  return (
    <a
      href={url ?? undefined}
      download={attachment.name}
      className="flex max-w-[340px] items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 hover:border-line-strong"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-raised text-ink-mute">
        <FileIcon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink">{attachment.name}</span>
        <span className="block text-[11px] text-ink-mute">{fileSize(attachment.size)}</span>
      </span>
    </a>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[340px] rounded-md border border-line bg-surface px-3 py-2.5 text-[12px] text-ink-mute">
      {children}
    </div>
  );
}
