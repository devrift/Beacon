import { useEffect, useRef, useState } from 'react';
import { BarChart3, Mic, Paperclip, Send, SmilePlus, Square, X } from 'lucide-react';
import { cx } from '../lib/cx';
import { uid } from '../lib/id';
import { duration as fmtDuration } from '../lib/time';
import { computePeaks, fileToAttachment, MAX_UPLOAD_BYTES } from '../lib/upload';
import { putBlob } from '../lib/blobStore';
import { useAppStore, type Attachment, type Message } from '../store/useAppStore';
import { IconButton } from '../ui/primitives';
import { Popover } from '../ui/overlays';
import { EmojiPicker } from './EmojiPicker';
import { useFileTransfer } from '../hooks/useFileTransfer';
import { IS_SUPABASE_CONFIGURED, supabase } from '../supabase';
import { useAuthStore } from '../store/useAuthStore';

const P2P_THRESHOLD = 5 * 1024 * 1024;

export function Composer() {
  const channelId = useAppStore((s) => s.activeChannelId);
  const channel = useAppStore((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const draft = useAppStore((s) => (s.activeChannelId ? (s.drafts[s.activeChannelId] ?? '') : ''));
  const setDraft = useAppStore((s) => s.setDraft);
  const addMessage = useAppStore((s) => s.addMessage);
  const me = useAppStore((s) => s.appUser);
  const replyingTo = useAppStore((s) => s.replyingTo);
  const setReplyingTo = useAppStore((s) => s.setReplyingTo);
  const sendOnEnter = useAppStore((s) => s.sendOnEnter);
  const openDialog = useAppStore((s) => s.openDialog);
  const toast = useAppStore((s) => s.toast);
  const noteEmojiUse = useAppStore((s) => s.noteEmojiUse);
  const noteTyping = useAppStore((s) => s.noteTyping);
  const fileTransfer = useFileTransfer();

  const [pending, setPending] = useState<Attachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLButtonElement>(null);

  // Grow with content, up to a ceiling — no scrollbar until it is really long.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // Focus the composer when the channel changes, so typing just works.
  useEffect(() => {
    textRef.current?.focus();
  }, [channelId]);

  if (!channelId || !channel) return null;
  const cid: string = channelId;

  async function acceptFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const accepted: Attachment[] = [];
    for (const file of list) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast('warn', `${file.name} is too large`, 'Beacon supports original files up to 2 GB.');
        continue;
      }
      try {
        accepted.push(file.size > P2P_THRESHOLD ? await fileTransfer.register(file) : await fileToAttachment(file));
      } catch (error) {
        toast(
          'danger',
          `Could not attach ${file.name}`,
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    }
    if (accepted.length > 0) setPending((prev) => [...prev, ...accepted]);
  }

  function send() {
    const content = draft.trim();
    if (!content && pending.length === 0) return;

    const message: Message = {
      id: uid('m'),
      channel_id: cid,
      author_id: me.id,
      author_name: me.displayName || me.username,
      author_color: me.avatarColor,
      author_avatar: me.avatar,
      content,
      created_at: new Date().toISOString(),
      reply_to: replyingTo?.id,
      attachments: pending.length > 0 ? pending : undefined,
    };
    addMessage(message);
    const sessionUser = useAuthStore.getState().user;
    if (IS_SUPABASE_CONFIGURED && sessionUser?.id === message.author_id) {
      void (async () => {
        try {
          const { error } = await supabase.from('messages').insert({
            id: message.id,
            channel_id: message.channel_id,
            user_id: sessionUser.id,
            content: message.content,
            created_at: message.created_at,
            attachments: message.attachments ?? [],
          });
          if (error) console.warn('Cloud message sync deferred:', error.message);
        } catch (error) {
          console.warn('Cloud message sync deferred:', error);
        }
      })();
    }
    setDraft(cid, '');
    setPending([]);
    setReplyingTo(null);
    textRef.current?.focus();
  }

  return (
    <div className="shrink-0 px-6 pb-5 sm:px-14">
      <div className="w-full max-w-[1480px]">
      {replyingTo && (
        <div className="mb-1.5 flex items-center gap-2 border-l-2 border-accent pl-2.5 text-[12px]">
          <span className="text-ink-mute">Replying to</span>
          <span className="font-medium text-ink-dim">{replyingTo.author_name ?? 'Unknown'}</span>
          <span className="min-w-0 flex-1 truncate text-ink-mute">{replyingTo.content}</span>
          <IconButton label="Cancel reply" size="sm" onClick={() => setReplyingTo(null)}>
            <X size={13} />
          </IconButton>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {pending.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pr-0.5 pl-2.5"
            >
              <span className="max-w-[180px] truncate text-[11.5px] text-ink-dim">{a.name}</span>
              <IconButton
                label={`Remove ${a.name}`}
                size="sm"
                onClick={() => setPending((prev) => prev.filter((x) => x.id !== a.id))}
              >
                <X size={12} />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      {/* Text first, tools underneath. Icons flanking a single line is the
          layout every chat app already has; this one reads like a document. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) void acceptFiles(e.dataTransfer.files);
        }}
        className={cx(
          'clean-input flex items-end gap-0.5 rounded-lg border border-white/10 bg-[#2b2d31] px-1.5 py-1 outline-none ring-0 transition-colors focus-within:border-zinc-500 focus-within:outline-none focus-within:ring-0',
          dragging && 'bg-accent/10',
        )}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void acceptFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <IconButton label="Attach a file" size="sm" onClick={() => fileRef.current?.click()}>
          <Paperclip size={16} />
        </IconButton>

        <textarea
          ref={textRef}
          rows={1}
          value={draft}
          placeholder={dragging ? 'Drop files to attach' : `Message ${channel.name}`}
          onChange={(e) => {
            setDraft(channelId, e.target.value);
            noteTyping(channelId, me.id, me.displayName || me.username);
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length > 0) {
              e.preventDefault();
              void acceptFiles(files);
            }
          }}
          onKeyDown={(e) => {
            const shouldSend = sendOnEnter
              ? e.key === 'Enter' && !e.shiftKey
              : e.key === 'Enter' && (e.ctrlKey || e.metaKey);
            if (shouldSend) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-[160px] min-h-[26px] flex-1 resize-none bg-transparent px-1 py-1 text-[14.5px] leading-[1.5] text-ink outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-ink-mute"
        />

        <IconButton label="Create a poll" size="sm" onClick={() => openDialog('poll')}>
          <BarChart3 size={16} />
        </IconButton>
        <IconButton ref={emojiRef} label="Emoji" size="sm" onClick={() => setEmojiOpen(true)}>
          <SmilePlus size={16} />
        </IconButton>
        <VoiceNoteButton channelId={channelId} />
        <IconButton
          label="Send message"
          size="sm"
          onClick={send}
          disabled={!draft.trim() && pending.length === 0}
          className={cx(
            'rounded-full',
            (draft.trim() || pending.length > 0) && 'bg-accent text-accent-ink hover:brightness-110',
          )}
        >
          <Send size={15} />
        </IconButton>
      </div>

      <TypingLine channelId={channelId} />
      </div>

      <Popover open={emojiOpen} onClose={() => setEmojiOpen(false)} anchorRef={emojiRef} placement="top-end">
        <EmojiPicker
          onPick={(emoji) => {
            setDraft(channelId, draft + emoji);
            noteEmojiUse(emoji);
            setEmojiOpen(false);
            textRef.current?.focus();
          }}
        />
      </Popover>
    </div>
  );
}

/** Hold-free voice notes: tap to record, tap to send. */
function VoiceNoteButton({ channelId }: { channelId: string }) {
  const me = useAppStore((s) => s.appUser);
  const addMessage = useAppStore((s) => s.addMessage);
  const toast = useAppStore((s) => s.toast);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast('danger', 'Microphone blocked', 'Allow mic access to record a voice note.');
      return;
    }
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size < 400) return; // A stray tap, not a message.

      // Decode once to draw a waveform, then store the original bytes.
      let peaks: number[] = [];
      let length = 0;
      try {
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        peaks = computePeaks(decoded);
        length = decoded.duration;
        void ctx.close();
      } catch {
        // Playback still works without a waveform.
      }

      const id = uid('att');
      await putBlob(id, blob);
      addMessage({
        id: uid('m'),
        channel_id: channelId,
        author_id: me.id,
        author_name: me.displayName || me.username,
        author_color: me.avatarColor,
        author_avatar: me.avatar,
        content: '',
        created_at: new Date().toISOString(),
        attachments: [
          {
            id,
            name: 'Voice note',
            size: blob.size,
            mime: blob.type,
            kind: 'audio',
            duration: length,
            peaks,
          },
        ],
      });
    };

    recorder.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  if (recording) {
    return (
      <button
        type="button"
        onClick={stop}
        className="flex h-8 items-center gap-2 rounded-sm bg-danger/12 px-2.5 text-[12px] font-medium text-danger"
        title="Stop and send"
      >
        <Square size={12} fill="currentColor" />
        <span className="font-mono tnum">{fmtDuration(seconds)}</span>
      </button>
    );
  }

  return (
    <IconButton label="Record a voice note" onClick={() => void start()}>
      <Mic size={17} />
    </IconButton>
  );
}

/** "Nova is typing…" — entries expire on their own so it never sticks. */
function TypingLine({ channelId }: { channelId: string }) {
  const typing = useAppStore((s) => s.typingByChannel[channelId]);
  const me = useAppStore((s) => s.appUser.id);
  const [, force] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1200);
    return () => window.clearInterval(id);
  }, []);

  const names = Object.entries(typing ?? {})
    .filter(([userId, entry]) => userId !== me && Date.now() - entry.at < 4000)
    .map(([, entry]) => entry.username);

  return (
    <div className="h-4 px-1 pt-1 text-[11.5px] text-ink-mute">
      {names.length > 0 && (
        <span className="anim-fade">
          {names.join(', ')} {names.length === 1 ? 'is' : 'are'} typing…
        </span>
      )}
    </div>
  );
}
