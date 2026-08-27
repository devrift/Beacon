import type { Message } from '../store/useAppStore';

/**
 * A small, durable database for message history. IndexedDB is available in
 * every modern browser, costs nothing, and is substantially safer for message
 * history than treating localStorage as the primary record.
 */
const DB_NAME = 'beacon-message-db';
const STORE_NAME = 'messages';

let database: Promise<IDBDatabase | null> | null = null;
let syncTimer: number | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (database) return database;
  database = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('channel_id', 'channel_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return database;
}

export async function readMessageDatabase(): Promise<Record<string, Message[]> | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const grouped: Record<string, Message[]> = {};
        for (const message of request.result as Message[]) {
          (grouped[message.channel_id] ??= []).push(message);
        }
        for (const list of Object.values(grouped)) {
          list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        }
        resolve(grouped);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function replaceMessageDatabase(messagesByChannel: Record<string, Message[]>): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      for (const message of Object.values(messagesByChannel).flat()) store.put(message);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Coalesce rapid edits/reactions into one tiny database transaction. */
export function queueMessageDatabaseSync(messagesByChannel: Record<string, Message[]>): void {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    void replaceMessageDatabase(messagesByChannel);
  }, 250);
}
