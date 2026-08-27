import type { Attachment, AttachmentKind } from '../store/useAppStore';
import { uid } from './id';
import { putBlob } from './blobStore';

function kindFor(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

/** Reads an image's natural size so the message can reserve space before load. */
function imageSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Beacon's product limit. Files are stored byte-for-byte: no recompression,
 * resizing, transcoding, or metadata stripping happens in the client.
 *
 * Browsers may still reject a file when the device's available storage quota is
 * smaller; callers surface that truth instead of quietly lowering quality.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Persists a file to IndexedDB and returns the metadata a Message carries. The
 * blob is keyed by the attachment id, so deleting the message can free it.
 */
export async function fileToAttachment(file: File): Promise<Attachment> {
  const id = uid('att');
  const stored = await putBlob(id, file);
  if (!stored) {
    throw new Error('Your device does not have enough available storage for this file.');
  }
  const attachment: Attachment = {
    id,
    name: file.name || 'file',
    size: file.size,
    mime: file.type || 'application/octet-stream',
    kind: kindFor(file.type || ''),
  };
  if (attachment.kind === 'image') {
    const size = await imageSize(file);
    if (size) {
      attachment.width = size.width;
      attachment.height = size.height;
    }
  }
  return attachment;
}

/**
 * Down-samples raw PCM to a fixed number of normalised peaks for a waveform.
 * Runs once when a voice note is recorded; the peaks travel with the message.
 */
export function computePeaks(buffer: AudioBuffer, buckets = 48): number[] {
  const data = buffer.getChannelData(0);
  const size = Math.floor(data.length / buckets) || 1;
  const peaks: number[] = [];
  let max = 0;
  for (let b = 0; b < buckets; b += 1) {
    let peak = 0;
    for (let j = 0; j < size; j += 1) {
      const v = Math.abs(data[b * size + j] ?? 0);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
    if (peak > max) max = peak;
  }
  // Normalise to 0–1 so the bars use the full height regardless of gain.
  return max > 0 ? peaks.map((p) => p / max) : peaks;
}
