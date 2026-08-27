import { useEffect, useRef } from 'react';
import Peer, { type MediaConnection } from 'peerjs';
import { useAppStore } from '../store/useAppStore';

// ─────────────────────────────────────────────────────────────────────────────
// Voice channels.
//
// With no backend, peers find each other over a same-origin BroadcastChannel
// (so two tabs — or two windows — on localhost connect for real) and stream
// audio to each other with PeerJS over the public broker. Mute toggles the mic
// track; deafen silences every remote element and mutes you too.
// ─────────────────────────────────────────────────────────────────────────────

function peerId(channelId: string, userId: string): string {
  // PeerJS ids must be broker-safe: letters, digits and a couple of separators.
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');
  return `bcn-${safe(channelId)}-${safe(userId)}`;
}

interface Announce {
  kind: 'join' | 'leave';
  peer: string;
  userId: string;
  username: string;
  color: string;
}

function opus128(sdp: string): string {
  const opus = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp);
  if (!opus) return sdp;
  const payload = opus[1];
  const line = `a=fmtp:${payload} maxaveragebitrate=128000;stereo=1;sprop-stereo=1`;
  const fmtp = new RegExp(`a=fmtp:${payload}[^\\r\\n]*`, 'i');
  return fmtp.test(sdp) ? sdp.replace(fmtp, line) : sdp.replace(opus[0], `${opus[0]}\r\n${line}`);
}

function callOptions() {
  return { sdpTransform: opus128 };
}

export function useVoice(): void {
  const channelId = useAppStore((s) => s.voiceChannelId);
  const isMuted = useAppStore((s) => s.isMuted);
  const isDeafened = useAppStore((s) => s.isDeafened);
  const me = useAppStore((s) => s.appUser);

  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const audioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const bcRef = useRef<BroadcastChannel | null>(null);
  const rafRef = useRef<number | null>(null);

  // ── Connect / disconnect on channel change ─────────────────────────────────
  useEffect(() => {
    if (!channelId) return;

    const store = useAppStore.getState;
    let cancelled = false;
    const myPeerId = peerId(channelId, me.id);
    const bc = new BroadcastChannel(`beacon-voice-${channelId}`);
    bcRef.current = bc;

    const attachRemote = (remotePeerId: string, stream: MediaStream) => {
      let el = audioRef.current.get(remotePeerId);
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        audioRef.current.set(remotePeerId, el);
      }
      el.srcObject = stream;
      el.muted = store().isDeafened;
      void el.play().catch(() => undefined);
    };

    const cleanupPeerAudio = (remotePeerId: string) => {
      const el = audioRef.current.get(remotePeerId);
      if (el) {
        el.srcObject = null;
        audioRef.current.delete(remotePeerId);
      }
      callsRef.current.get(remotePeerId)?.close();
      callsRef.current.delete(remotePeerId);
    };

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: { ideal: 2 },
            sampleRate: { ideal: 48000 },
            sampleSize: { ideal: 16 },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch {
        useAppStore
          .getState()
          .setVoiceError('Microphone blocked. Allow mic access, then rejoin.');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !store().isMuted;
        t.contentHint = 'speech';
      });

      // Drive your own speaking indicator from mic level.
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
          const speaking = !store().isMuted && avg > 18;
          const current = store().voicePeers[myPeerId];
          if (current && current.speaking !== speaking) {
            useAppStore.getState().setVoicePeer({ ...current, speaking });
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // Level metering is a nicety; voice still works without it.
      }

      const peer = new Peer(myPeerId, {
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
      });
      peerRef.current = peer;

      peer.on('open', () => {
        // Register yourself, then announce so anyone already here calls you.
        useAppStore.getState().setVoicePeer({
          id: myPeerId,
          username: me.username,
          avatarColor: me.avatarColor,
          speaking: false,
          muted: store().isMuted,
        });
        const hello: Announce = {
          kind: 'join',
          peer: myPeerId,
          userId: me.id,
          username: me.username,
          color: me.avatarColor,
        };
        bc.postMessage(hello);
      });

      // Someone calls us — answer with our stream and play theirs.
      peer.on('call', (call) => {
        call.answer(stream, callOptions());
        callsRef.current.set(call.peer, call);
        call.on('stream', (remote) => attachRemote(call.peer, remote));
        call.on('close', () => cleanupPeerAudio(call.peer));
      });

      peer.on('error', () => {
        // Broker/peer hiccups shouldn't tear down the whole session silently.
        useAppStore.getState().setVoiceError('Voice connection dropped. Try rejoining.');
      });

      // React to others joining/leaving over the presence channel.
      bc.onmessage = (event: MessageEvent<Announce>) => {
        const msg = event.data;
        if (!msg || msg.peer === myPeerId) return;
        if (msg.kind === 'join') {
          useAppStore.getState().setVoicePeer({
            id: msg.peer,
            username: msg.username,
            avatarColor: msg.color,
            speaking: false,
            muted: false,
          });
          // We initiate the call to newcomers; they answer above.
          if (streamRef.current) {
            const call = peer.call(msg.peer, streamRef.current, callOptions());
            callsRef.current.set(msg.peer, call);
            call.on('stream', (remote) => attachRemote(msg.peer, remote));
            call.on('close', () => cleanupPeerAudio(msg.peer));
          }
          // Reply so the newcomer learns we're here too.
          bc.postMessage({
            kind: 'join',
            peer: myPeerId,
            userId: me.id,
            username: me.username,
            color: me.avatarColor,
          } satisfies Announce);
        } else {
          cleanupPeerAudio(msg.peer);
          useAppStore.getState().removeVoicePeer(msg.peer);
        }
      };
    }

    void start();

    return () => {
      cancelled = true;
      bc.postMessage({
        kind: 'leave',
        peer: myPeerId,
        userId: me.id,
        username: me.username,
        color: me.avatarColor,
      } satisfies Announce);
      bc.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      callsRef.current.forEach((c) => c.close());
      callsRef.current.clear();
      audioRef.current.forEach((el) => (el.srcObject = null));
      audioRef.current.clear();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, me.id]);

  // ── Mute reflects onto the live mic track ──────────────────────────────────
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
    const myPeerId = channelId ? peerId(channelId, me.id) : null;
    if (myPeerId) {
      const current = useAppStore.getState().voicePeers[myPeerId];
      if (current) useAppStore.getState().setVoicePeer({ ...current, muted: isMuted });
    }
  }, [isMuted, channelId, me.id]);

  // ── Deafen silences every remote element ───────────────────────────────────
  useEffect(() => {
    audioRef.current.forEach((el) => (el.muted = isDeafened));
  }, [isDeafened]);
}
