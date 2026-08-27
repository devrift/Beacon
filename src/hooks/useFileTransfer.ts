import { useEffect, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { uid } from '../lib/id';
import type { Attachment } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

const CHUNK_BYTES = 64 * 1024;
const files = new Map<string, File>();
const progress = new Map<string, number>();
const listeners = new Set<() => void>();
let peer: Peer | null = null;
let ready: Promise<string> | null = null;
let peerOwner = '';

function publish(): void { listeners.forEach((listener) => listener()); }
function setProgress(id: string, value: number): void { progress.set(id, value); publish(); }

function openPeer(userId: string): Promise<string> {
  if (peerOwner && peerOwner !== userId) {
    peer?.destroy();
    peer = null;
    ready = null;
  }
  if (ready) return ready;
  peerOwner = userId;
  ready = new Promise((resolve, reject) => {
    peer = new Peer(`beacon-file-${userId.replace(/[^a-z0-9]/gi, '')}-${uid('p')}`);
    peer.once('open', resolve);
    peer.once('error', reject);
    peer.on('connection', serveFile);
  });
  return ready;
}

function serveFile(connection: DataConnection): void {
  connection.on('data', async (request: unknown) => {
    const data = request as { type?: string; fileId?: string };
    if (data.type !== 'request' || !data.fileId) return;
    const file = files.get(data.fileId);
    if (!file) { connection.send({ type: 'error', message: 'Sender no longer has this file open.' }); return; }
    connection.send({ type: 'meta', fileId: data.fileId, name: file.name, size: file.size, mime: file.type });
    for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
      const bytes = await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
      connection.send(bytes);
      setProgress(data.fileId, Math.min(1, (offset + bytes.byteLength) / file.size));
    }
    connection.send({ type: 'complete', fileId: data.fileId });
  });
}

export function useFileTransfer() {
  const [version, setVersion] = useState(0);
  const userId = useAuthStore((s) => s.user?.id ?? (s.guest ? 'guest' : ''));

  useEffect(() => {
    if (!userId) return;
    void openPeer(userId).catch(() => undefined);
    const listener = () => setVersion((value) => value + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [userId]);

  return {
    version,
    register: async (file: File): Promise<Attachment> => {
      const senderPeerId = await openPeer(userId);
      const fileId = uid('p2p');
      files.set(fileId, file);
      setProgress(fileId, 0);
      return { id: fileId, name: file.name, size: file.size, mime: file.type || 'application/octet-stream', kind: 'file', p2p: { fileId, senderPeerId } };
    },
    download: (attachment: Attachment): Promise<void> => new Promise((resolve, reject) => {
      const transfer = attachment.p2p;
      if (!peer || !transfer) { reject(new Error('Direct transfer is unavailable.')); return; }
      const connection = peer.connect(transfer.senderPeerId, { reliable: true });
      const chunks: ArrayBuffer[] = [];
      let received = 0;
      connection.on('open', () => connection.send({ type: 'request', fileId: transfer.fileId }));
      connection.on('data', (value: unknown) => {
        if (value instanceof ArrayBuffer) {
          chunks.push(value); received += value.byteLength;
          setProgress(transfer.fileId, Math.min(1, received / attachment.size));
          return;
        }
        const message = value as { type?: string; message?: string };
        if (message.type === 'error') { connection.close(); reject(new Error(message.message)); }
        if (message.type === 'complete') {
          const url = URL.createObjectURL(new Blob(chunks, { type: attachment.mime }));
          const link = document.createElement('a');
          link.href = url; link.download = attachment.name; link.click();
          URL.revokeObjectURL(url); connection.close(); setProgress(transfer.fileId, 1); resolve();
        }
      });
      connection.on('error', reject);
    }),
    progress: (id: string) => progress.get(id) ?? 0,
  };
}

export function setFileTransferUser(userId: string): void {
  void userId;
}
