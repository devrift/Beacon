import { useEffect, useMemo, useState } from 'react';
import { AtSign, MessageCircle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { clockTime, fullTimestamp } from '../lib/time';
import {
  channelMessages,
  EMPTY_IDS,
  findMessage,
  roster,
  useAppStore,
  type Message,
  type Presence,
} from '../store/useAppStore';
import { Avatar, Button, EmptyState, GroupLabel, Input, PRESENCE_LABEL } from '../ui/primitives';
import { Modal } from '../ui/overlays';

/**
 * Members, pinned and saved used to be a permanent third column. They are
 * reference material — things you consult and dismiss — so they are dialogs
 * now, and the window goes back to being one conversation.
 */

const ORDER: Presence[] = ['online', 'idle', 'dnd', 'offline'];

export function MembersDialog() {
  const open = useAppStore((s) => s.dialog === 'members');
  const closeDialog = useAppStore((s) => s.closeDialog);

  // Composed here, not in a selector: `roster` builds a fresh "me" object on
  // every read, which no equality check can hold still.
  const appUser = useAppStore((s) => s.appUser);
  const members = useAppStore((s) => s.members);
  const openDm = useAppStore((s) => s.openDm);
  const people = useMemo(() => roster({ appUser, members }), [appUser, members]);

  const grouped = ORDER.map((presence) => ({
    presence,
    people: people.filter((p) => p.presence === presence),
  })).filter((group) => group.people.length > 0);

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Who's here"
      description={`${people.length} ${people.length === 1 ? 'person' : 'people'} in this server`}
      width="sm"
    >
      <div className="max-h-[52vh] overflow-y-auto">
        {grouped.map((group) => (
          <div key={group.presence}>
            <GroupLabel>
              {PRESENCE_LABEL[group.presence]} — {group.people.length}
            </GroupLabel>
            {group.people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  if (person.id !== appUser.id) openDm(person.id, person.username);
                  closeDialog();
                }}
                className="flex h-11 w-full items-center gap-2.5 rounded-md px-1 text-left hover:bg-hover"
              >
                <Avatar
                  name={person.username}
                  color={person.avatarColor}
                  size="sm"
                  presence={person.presence}
                />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink-dim">{person.username}</div>
                  {person.customStatus && (
                    <div className="truncate text-[11px] text-ink-mute">{person.customStatus}</div>
                  )}
                </div>
                {person.id !== appUser.id && (
                  <span className="ml-auto text-[11.5px] text-ink-mute">Message</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** A private conversation is addressed by handle, never limited to a server roster. */
export function DirectMessageDialog() {
  const open = useAppStore((s) => s.dialog === 'newDm');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const openDmByUsername = useAppStore((s) => s.openDmByUsername);
  const toast = useAppStore((s) => s.toast);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (open) setUsername('');
  }, [open]);

  function start() {
    const handle = openDmByUsername(username);
    if (!handle) {
      toast('warn', 'That username does not look right', 'Use 3–24 letters, numbers, or underscores.');
      return;
    }
    toast('ok', `Message ready for @${handle}`, 'Private messages are separate from your servers.');
    closeDialog();
  }

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="New direct message"
      description="Start a private conversation with any Beacon username."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
          <Button variant="accent" onClick={start} disabled={!username.trim()}>
            <MessageCircle size={14} /> Start message
          </Button>
        </>
      }
    >
      <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-dim">
        <AtSign size={13} /> Username
      </label>
      <Input
        autoFocus
        value={username}
        maxLength={24}
        placeholder="nova_park"
        onChange={(event) => setUsername(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && start()}
      />
      <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">
        No shared server needed. Type a username to open a private thread.
      </p>
    </Modal>
  );
}

export function PinnedDialog() {
  const open = useAppStore((s) => s.dialog === 'pinned');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const channelId = useAppStore((s) => s.activeChannelId);
  const channelName = useAppStore((s) => s.channels.find((c) => c.id === s.activeChannelId)?.name);
  const messages = useAppStore((s) => channelMessages(s, s.activeChannelId));
  const pinnedIds = useAppStore((s) =>
    channelId ? (s.pinnedByChannel[channelId] ?? EMPTY_IDS) : EMPTY_IDS,
  );
  const pinned = pinnedIds
    .map((id) => messages.find((m) => m.id === id))
    .filter((m): m is Message => Boolean(m));

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Pinned"
      description={channelName ? `Kept for everyone in ${channelName}` : undefined}
      width="sm"
    >
      <div className="max-h-[52vh] overflow-y-auto">
        {pinned.length === 0 ? (
          <EmptyState title="Nothing pinned" detail="Pin a message from its ⋯ menu to keep it here." />
        ) : (
          pinned.map((message) => <MessageCard key={message.id} message={message} />)
        )}
      </div>
    </Modal>
  );
}

export function SavedDialog() {
  const open = useAppStore((s) => s.dialog === 'saved');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const savedIds = useAppStore((s) => s.savedIds);
  const saved = useAppStore(
    useShallow((s) => savedIds.map((id) => findMessage(s, id)).filter((m): m is Message => Boolean(m))),
  );

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Saved"
      description="Only you can see these"
      width="sm"
    >
      <div className="max-h-[52vh] overflow-y-auto">
        {saved.length === 0 ? (
          <EmptyState title="Nothing saved" detail="Save a message to find it again from any channel." />
        ) : (
          saved.map((message) => <MessageCard key={message.id} message={message} showChannel />)
        )}
      </div>
    </Modal>
  );
}

function MessageCard({ message, showChannel }: { message: Message; showChannel?: boolean }) {
  const channel = useAppStore((s) => s.channels.find((c) => c.id === message.channel_id));
  const jumpTo = useAppStore((s) => s.jumpTo);
  const closeDialog = useAppStore((s) => s.closeDialog);

  return (
    <button
      type="button"
      onClick={() => {
        if (channel) jumpTo(channel.server_id, channel.id);
        closeDialog();
      }}
      className="group block w-full border-b border-line py-2.5 text-left last:border-b-0"
      title={fullTimestamp(message.created_at)}
    >
      <div className="mb-1 flex items-center gap-2">
        <Avatar
          name={message.author_name ?? 'Unknown'}
          color={message.author_color ?? '#8b8b95'}
          size="xs"
        />
        <span className="truncate text-[12.5px] font-medium text-ink">
          {message.author_name ?? 'Unknown'}
        </span>
        {showChannel && channel && (
          <span className="truncate text-[11.5px] text-ink-mute">in {channel.name}</span>
        )}
        <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-mute tnum">
          {clockTime(message.created_at)}
        </span>
      </div>
      <p className="line-clamp-3 text-[13px] leading-snug text-ink-dim">
        {message.content || (message.poll ? message.poll.question : 'Attachment')}
      </p>
    </button>
  );
}
