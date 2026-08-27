import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Hash } from 'lucide-react';
import { dayLabel, sameDay, withinGroupWindow } from '../lib/time';
import { channelMessages, firstUnreadAt, useAppStore } from '../store/useAppStore';
import { EmptyState } from '../ui/primitives';
import { MessageRow } from './MessageRow';

export function MessageList() {
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const messages = useAppStore((s) => channelMessages(s, s.activeChannelId));
  const channel = useAppStore((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const markChannelRead = useAppStore((s) => s.markChannelRead);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Computed once per channel switch so the divider doesn't jump as you read.
  const unreadAt = useMemo(
    () => (activeChannelId ? firstUnreadAt(useAppStore.getState(), activeChannelId) : null),
    [activeChannelId],
  );

  // Stay glued to the newest message unless the reader has scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;
    // Opening a channel clears its badge; the divider above still marks the spot.
    const id = window.setTimeout(() => markChannelRead(activeChannelId), 400);
    return () => window.clearTimeout(id);
  }, [activeChannelId, messages.length, markChannelRead]);

  if (!channel) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<Hash size={22} />}
          title="No channel selected"
          detail="Pick a channel on the left, or press Ctrl K to jump to one."
        />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="flex-1 overflow-y-auto overscroll-contain"
    >
      {/* Wide screens should feel like a workspace, not a narrow mobile feed. */}
      <div className="w-full max-w-[1480px] px-6 pb-6 sm:px-10 xl:px-14">
      <ChannelIntro name={channel.name} topic={channel.topic} count={messages.length} />

      {messages.map((message, i) => {
        const previous = messages[i - 1];
        const newDay = !previous || !sameDay(previous.created_at, message.created_at);
        const grouped =
          !newDay &&
          !!previous &&
          !previous.system &&
          !message.system &&
          previous.author_id === message.author_id &&
          !message.reply_to &&
          withinGroupWindow(previous.created_at, message.created_at);
        const showUnread = unreadAt === message.created_at;
        const replyTo = message.reply_to
          ? messages.find((m) => m.id === message.reply_to)
          : undefined;

        return (
          <div key={message.id}>
            {newDay && <DayDivider iso={message.created_at} />}
            {showUnread && <UnreadDivider />}
            <MessageRow message={message} grouped={grouped} replyTo={replyTo} />
          </div>
        );
      })}
      </div>
    </div>
  );
}

function ChannelIntro({
  name,
  topic,
  count,
}: {
  name: string;
  topic?: string;
  count: number;
}) {
  return (
    <div className="border-b border-line pt-12 pb-6">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-mute">
        The beginning
      </p>
      <h2 className="mt-2 text-[34px] font-bold leading-[1.1] tracking-tight text-white/95">
        {name}
      </h2>
      <p className="mt-2 max-w-[56ch] text-[13.5px] leading-relaxed text-ink-mute">
        {topic || `Every message in ${name} lives here.`}
        {count === 0 && ' Say something to get it going.'}
      </p>
    </div>
  );
}

function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 bg-panel/90 py-2.5 backdrop-blur-sm" data-recedes>
      <span className="text-[10px] font-semibold tracking-[0.12em] text-ink-mute tnum">
        {dayLabel(iso)}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function UnreadDivider() {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <span className="text-[10px] font-semibold tracking-[0.12em] text-accent">New</span>
      <span className="h-px flex-1 bg-accent/40" />
    </div>
  );
}
