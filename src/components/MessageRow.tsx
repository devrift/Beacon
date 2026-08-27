import { useRef, useState } from 'react';
import {
  Bookmark,
  CornerUpLeft,
  MoreHorizontal,
  Pencil,
  Pin,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { cx } from '../lib/cx';
import { Markdown } from '../lib/markdown';
import { clockTime, fullTimestamp } from '../lib/time';
import { useAppStore, type Message } from '../store/useAppStore';
import { Avatar, IconButton, TextArea } from '../ui/primitives';
import { ConfirmDialog, Popover } from '../ui/overlays';
import { EmojiPicker } from './EmojiPicker';
import { Attachments } from './Attachments';
import { PollCard } from './PollCard';
import { PersonCard } from './Profile';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀'];

export function MessageRow({
  message,
  grouped,
  replyTo,
}: {
  message: Message;
  /** True when this message continues the previous author's run. */
  grouped: boolean;
  replyTo?: Message;
}) {
  const me = useAppStore((s) => s.appUser);
  const editingId = useAppStore((s) => s.editingId);
  const setEditingId = useAppStore((s) => s.setEditingId);
  const setReplyingTo = useAppStore((s) => s.setReplyingTo);
  const editMessage = useAppStore((s) => s.editMessage);
  const deleteMessage = useAppStore((s) => s.deleteMessage);
  const toggleReaction = useAppStore((s) => s.toggleReaction);
  const noteEmojiUse = useAppStore((s) => s.noteEmojiUse);
  const togglePin = useAppStore((s) => s.togglePin);
  const toggleSaved = useAppStore((s) => s.toggleSaved);
  const pinned = useAppStore((s) => (s.pinnedByChannel[message.channel_id] ?? []).includes(message.id));
  const saved = useAppStore((s) => s.savedIds.includes(message.id));
  const showDeleteConfirm = useAppStore((s) => s.showDeleteConfirm);
  const toast = useAppStore((s) => s.toast);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const emojiRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);

  const mine = message.author_id === me.id;
  const editing = editingId === message.id;
  const name = mine ? (me.displayName || me.username) : (message.author_name ?? 'Unknown');
  const color = mine ? me.avatarColor : (message.author_color ?? '#8b8b95');
  const avatar = mine ? me.avatar : message.author_avatar;

  if (message.system) {
    return (
      <div className="flex items-center gap-2.5 py-2" data-recedes>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11.5px] text-ink-mute">{message.content}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }

  function remove() {
    deleteMessage(message.channel_id, message.id);
    toast('info', 'Message deleted');
  }

  function react(emoji: string) {
    toggleReaction(message.channel_id, message.id, emoji);
    noteEmojiUse(emoji);
  }

  function commitEdit() {
    const next = draft.trim();
    if (!next) {
      setEditingId(null);
      return;
    }
    editMessage(message.channel_id, message.id, next);
    setEditingId(null);
  }

  return (
    <div
      className={cx(
        'group relative rounded-xl transition-colors hover:bg-hover/40',
        grouped ? 'py-[var(--row-pad)]' : 'mt-[var(--row-gap)] pt-1 pb-[var(--row-pad)]',
      )}
      data-message-id={message.id}
    >
      {/* Reply context: a quoted line above the message, tied to it by a rule. */}
      {replyTo && (
        <div className="mb-1 flex items-center gap-1.5 border-l-2 border-line pl-2 text-[12px] text-ink-mute">
          <span className="font-medium text-ink-dim">{replyTo.author_name ?? 'Unknown'}</span>
          <span className="truncate opacity-80">{replyTo.content.slice(0, 120) || 'attachment'}</span>
        </div>
      )}

      <div className="relative">
        {/* Author's colour, held back until you point at the message. */}
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 -left-3.5 w-[2px] rounded-full opacity-0 transition-opacity group-hover:opacity-70"
          style={{ backgroundColor: color }}
        />
        {grouped && (
          <span
            className="absolute top-[3px] -left-[54px] hidden w-10 text-right font-mono text-[10px] text-ink-mute opacity-0 transition-opacity group-hover:opacity-100 sm:block tnum"
            title={fullTimestamp(message.created_at)}
          >
            {clockTime(message.created_at)}
          </span>
        )}

        <div className="min-w-0">
          {!grouped && (
        <div className="mb-1 flex items-baseline gap-2">
          <Avatar name={name} color={color} image={avatar} size="xs" />
              <button
                ref={cardRef}
                type="button"
                onClick={() => setCardOpen(true)}
                className="text-[13px] font-semibold tracking-[-0.02em] text-ink transition-colors hover:text-accent"
              >
                {name}
              </button>
              <span
                className="text-[11px] text-ink-mute tnum"
                title={fullTimestamp(message.created_at)}
              >
                {clockTime(message.created_at)}
              </span>
              {pinned && <Pin size={11} className="text-ink-mute" />}
              {saved && <Bookmark size={11} className="text-accent" />}
            </div>
          )}

          {editing ? (
            <div className="my-1">
              <TextArea
                autoFocus
                rows={Math.min(8, draft.split('\n').length + 1)}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitEdit();
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-mute">
                <button type="button" onClick={commitEdit} className="font-medium text-accent hover:underline">
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="hover:text-ink-dim">
                  Cancel
                </button>
                <span className="ml-auto">Enter saves · Esc cancels</span>
              </div>
            </div>
          ) : (
            message.content && (
              <div className="text-[14.5px] leading-[1.6] text-ink">
                <Markdown text={message.content} />
                {message.edited_at && (
                  <span className="ml-1 align-baseline text-[10.5px] text-ink-mute">(edited)</span>
                )}
              </div>
            )
          )}

          {message.attachments && message.attachments.length > 0 && (
            <Attachments attachments={message.attachments} />
          )}
          {message.poll && <PollCard message={message} />}

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(message.reactions).map(([emoji, users]) => {
                const active = users.includes(me.id);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => react(emoji)}
                    title={`${users.length} ${users.length === 1 ? 'reaction' : 'reactions'}`}
                className={cx(
                      'flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] transition-colors',
                      active
                        ? 'border-accent/50 bg-accent/16 text-ink'
                        : 'border-line bg-surface text-ink-dim hover:border-line-strong',
                    )}
                  >
                    <span className="text-[13px] leading-none">{emoji}</span>
                    <span className="font-mono text-[10.5px] tnum">{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hover toolbar. Floats over the row's top-right, out of the text flow. */}
      {!editing && (
        <div
          className="pop absolute -top-4 right-0 hidden items-center gap-0.5 p-0.5 group-hover:flex"
          role="toolbar"
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              title={`React ${emoji}`}
              className="grid h-7 w-7 place-items-center rounded-[10px] text-[15px] hover:bg-hover"
            >
              {emoji}
            </button>
          ))}
          <IconButton
            ref={emojiRef}
            label="More reactions"
            size="sm"
            onClick={() => setEmojiOpen(true)}
          >
            <SmilePlus size={15} />
          </IconButton>
          <IconButton label="Reply" size="sm" onClick={() => setReplyingTo(message)}>
            <CornerUpLeft size={15} />
          </IconButton>
          <IconButton ref={menuRef} label="More actions" size="sm" onClick={() => setMenuOpen(true)}>
            <MoreHorizontal size={15} />
          </IconButton>
        </div>
      )}

      <Popover open={cardOpen} onClose={() => setCardOpen(false)} anchorRef={cardRef} placement="bottom" className="p-1.5">
        <PersonCard userId={message.author_id} name={name} color={color} />
      </Popover>

      <Popover open={emojiOpen} onClose={() => setEmojiOpen(false)} anchorRef={emojiRef} placement="top-end">
        <EmojiPicker
          onPick={(emoji) => {
            react(emoji);
            setEmojiOpen(false);
          }}
        />
      </Popover>

      <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuRef} placement="top-end">
        <div className="w-[190px] p-1">
          <Item
            icon={<Pin size={14} />}
            label={pinned ? 'Unpin message' : 'Pin message'}
            onClick={() => {
              togglePin(message.channel_id, message.id);
              setMenuOpen(false);
            }}
          />
          <Item
            icon={<Bookmark size={14} />}
            label={saved ? 'Remove from saved' : 'Save message'}
            onClick={() => {
              toggleSaved(message.id);
              setMenuOpen(false);
            }}
          />
          <Item
            icon={<CornerUpLeft size={14} />}
            label="Copy text"
            onClick={() => {
              void navigator.clipboard.writeText(message.content);
              toast('ok', 'Copied');
              setMenuOpen(false);
            }}
          />
          {mine && (
            <>
              <div className="my-1 h-px bg-line" />
              <Item
                icon={<Pencil size={14} />}
                label="Edit message"
                onClick={() => {
                  setDraft(message.content);
                  setEditingId(message.id);
                  setMenuOpen(false);
                }}
              />
              <Item
                icon={<Trash2 size={14} />}
                label="Delete message"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  if (showDeleteConfirm) setConfirming(true);
                  else remove();
                }}
              />
            </>
          )}
        </div>
      </Popover>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        title="Delete message?"
        body="This removes it from this device for good."
      />
    </div>
  );
}

function Item({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-left text-[13px]',
        danger ? 'text-danger hover:bg-danger/10' : 'text-ink-dim hover:bg-hover hover:text-ink',
      )}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      {label}
    </button>
  );
}
