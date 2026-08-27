// ─────────────────────────────────────────────────────────────────────────────
// Attachment storage.
//
// Uploads have to survive a refresh even with no server configured, and files
// are far too big for localStorage (~5 MB for the whole app). So blobs live in
// IndexedDB keyed by id, and messages carry only metadata plus that key.
//
// Every function degrades to a no-op rather than throwing: a browser with
// IndexedDB blocked should lose attachment persistence, not the whole app.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'beacon-files';
const DB_VERSION = 1;
const STORE = 'blobs';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[Beacon] Attachments will not persist — IndexedDB is unavailable.');
      resolve(null);
    };
  });

  return dbPromise;
}

function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const request = run(tx.objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export function putBlob(id: string, blob: Blob): Promise<boolean> {
  return openDb().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) {
          resolve(false);
          return;
        }
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(blob, id);
          tx.oncomplete = () => resolve(true);
          tx.onabort = tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      }),
  );
}

export function getBlob(id: string): Promise<Blob | null> {
  return transact<Blob>('readonly', (store) => store.get(id) as IDBRequest<Blob>);
}

export function deleteBlob(id: string): Promise<void> {
  return transact('readwrite', (store) => store.delete(id) as IDBRequest<undefined>).then(
    () => undefined,
  );
}

export function clearBlobs(): Promise<void> {
  return transact('readwrite', (store) => store.clear() as IDBRequest<undefined>).then(
    () => undefined,
  );
}

// ─── Object URL cache ────────────────────────────────────────────────────────
// Blob URLs are cheap but leak if we mint a new one per render, so each blob is
// resolved once and reused for the lifetime of the page.

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function cachedUrl(id: string): string | undefined {
  return urlCache.get(id);
}

export function resolveUrl(id: string): Promise<string | null> {
  const existing = urlCache.get(id);
  if (existing) return Promise.resolve(existing);

  const inFlight = pending.get(id);
  if (inFlight) return inFlight;

  const promise = getBlob(id).then((blob) => {
    pending.delete(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  });

  pending.set(id, promise);
  return promise;
}

export function revokeUrl(id: string): void {
  const url = urlCache.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  urlCache.delete(id);
}

export function revokeAllUrls(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

// ─── Introspection ───────────────────────────────────────────────────────────

/** Total bytes held in IndexedDB — shown on the Settings › Data screen. */
export async function storedBytes(): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).openCursor();
      let total = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(total);
          return;
        }
        const value = cursor.value as Blob;
        total += value?.size ?? 0;
        cursor.continue();
      };
      request.onerror = () => resolve(total);
    } catch {
      resolve(0);
    }
  });
}
