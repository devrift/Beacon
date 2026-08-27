import { useAppStore } from '../store/useAppStore';

/**
 * Your chats, in one file.
 *
 * Beacon keeps every message on your own device, which is what makes it free —
 * there is no bill for storage nobody is paying for. The trade is portability,
 * so the whole store writes out as one file you can keep, move to another
 * machine, or read yourself. Attachments stay behind: they live in IndexedDB
 * and would make the file enormous.
 */

const STORE_KEY = 'beacon-store-v2';
const FORMAT = 'beacon.backup.1';

export function exportBackup(): void {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return;

  const state = useAppStore.getState();
  const messages = Object.values(state.messagesByChannel).reduce((n, list) => n + list.length, 0);

  const payload = {
    format: FORMAT,
    exported_at: new Date().toISOString(),
    counts: { servers: state.servers.length, channels: state.channels.length, messages },
    store: JSON.parse(raw),
  };

  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `beacon-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Replaces everything on this device with the contents of a backup file. */
export async function importBackup(file: File): Promise<{ messages: number }> {
  const parsed: unknown = JSON.parse(await file.text());
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { format?: unknown }).format !== FORMAT
  ) {
    throw new Error('That file is not a Beacon backup.');
  }

  const payload = parsed as { store: unknown; counts?: { messages?: number } };
  if (typeof payload.store !== 'object' || payload.store === null) {
    throw new Error('That backup is missing its data.');
  }

  localStorage.setItem(STORE_KEY, JSON.stringify(payload.store));
  return { messages: payload.counts?.messages ?? 0 };
}
