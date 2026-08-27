import { useEffect, useState } from 'react';
import { cachedUrl, resolveUrl } from '../lib/blobStore';
import type { Attachment } from '../store/useAppStore';

/**
 * Resolves an attachment to a displayable URL: its remote url if it has one,
 * otherwise a cached object URL for the IndexedDB blob. Returns null until ready.
 */
export function useAttachmentUrl(attachment?: Attachment): string | null {
  const [url, setUrl] = useState<string | null>(
    attachment?.url ?? (attachment ? cachedUrl(attachment.id) : null) ?? null,
  );

  useEffect(() => {
    if (!attachment) {
      setUrl(null);
      return;
    }
    const current = attachment;
    if (current.url) {
      setUrl(current.url);
      return;
    }
    const ready = cachedUrl(current.id);
    if (ready) {
      setUrl(ready);
      return;
    }
    let alive = true;
    void resolveUrl(current.id).then((resolved) => {
      if (alive) setUrl(resolved);
    });
    return () => {
      alive = false;
    };
  }, [attachment]);

  return url;
}
