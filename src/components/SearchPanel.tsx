import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { clockTime, dayLabel } from '../lib/time';
import { useAppStore, type Message } from '../store/useAppStore';
import { Avatar, Kbd } from '../ui/primitives';

export function SearchPanel() {
  const open = useAppStore((s) => s.searchOpen);
  const setOpen = useAppStore((s) => s.setSearchOpen);
  const messagesByChannel = useAppStore((s) => s.messagesByChannel);
  const channels = useAppStore((s) => s.channels);
  const jumpTo = useAppStore((s) => s.jumpTo);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'channel'>('all');
  const activeChannelId = useAppStore((s) => s.activeChannelId);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits: { message: Message; channelName: string; serverId: string }[] = [];
    for (const [channelId, list] of Object.entries(messagesByChannel)) {
      if (scope === 'channel' && channelId !== activeChannelId) continue;
      const channel = channels.find((c) => c.id === channelId);
      if (!channel) continue;
      for (const message of list) {
        if (message.system) continue;
        const haystack = `${message.content} ${message.author_name ?? ''} ${
          message.poll?.question ?? ''
        }`.toLowerCase();
        if (haystack.includes(q)) {
          hits.push({ message, channelName: channel.name, serverId: channel.server_id });
        }
      }
    }
    return hits
      .sort((a, b) => b.message.created_at.localeCompare(a.message.created_at))
      .slice(0, 60);
  }, [query, messagesByChannel, channels, scope, activeChannelId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-start justify-center p-4 pt-[10vh]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="scrim anim-fade fixed inset-0 cursor-default"
      />
      <div className="sheet anim-rise relative flex max-h-[74vh] w-full max-w-[620px] flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-ink-mute" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Search messages"
            className="h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-mute"
          />
          <Kbd>esc</Kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-1 text-ink-mute hover:text-ink"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-line px-3 py-2">
          {(['all', 'channel'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={`h-7 rounded-sm px-2.5 text-[12px] font-medium ${
                scope === value ? 'bg-active text-ink' : 'text-ink-mute hover:text-ink-dim'
              }`}
            >
              {value === 'all' ? 'Everywhere' : 'This channel'}
            </button>
          ))}
          <span className="ml-auto text-[11.5px] text-ink-mute">
            {query.trim().length < 2
              ? 'Type at least two characters'
              : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {results.map(({ message, channelName, serverId }) => (
            <button
              key={message.id}
              type="button"
              onClick={() => {
                jumpTo(serverId, message.channel_id);
                setOpen(false);
              }}
              className="mb-1.5 block w-full rounded-md border border-line bg-surface p-3 text-left hover:border-line-strong"
            >
              <div className="mb-1 flex items-center gap-2">
                <Avatar
                  name={message.author_name ?? 'Unknown'}
                  color={message.author_color ?? '#8b8b95'}
                  size="xs"
                />
                <span className="text-[12.5px] font-medium text-ink">
                  {message.author_name ?? 'Unknown'}
                </span>
                <span className="text-[11.5px] text-ink-mute">#{channelName}</span>
                <span className="ml-auto font-mono text-[10.5px] text-ink-mute tnum">
                  {dayLabel(message.created_at)} {clockTime(message.created_at)}
                </span>
              </div>
              <p className="line-clamp-2 text-[13px] leading-snug text-ink-dim">
                {highlight(message.content || message.poll?.question || 'Attachment', query.trim())}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Wraps every match so the eye lands on the reason this row is here. */
function highlight(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded-[3px] bg-accent/25 px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
