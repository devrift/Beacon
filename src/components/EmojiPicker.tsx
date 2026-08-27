import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { EMOJI_GROUPS, searchEmoji } from '../lib/emoji';
import { useAppStore } from '../store/useAppStore';

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const recent = useAppStore((s) => s.recentEmoji);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchEmoji(query), [query]);

  return (
    <div className="w-[320px]">
      <div className="border-b border-line p-2">
        <div className="field flex h-8 items-center gap-2 px-2.5">
          <Search size={13} className="text-ink-mute" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-mute"
          />
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto p-2">
        {query ? (
          <Grid emoji={results.map((e) => e.char)} onPick={onPick} empty="No emoji match that." />
        ) : (
          <>
            {recent.length > 0 && (
              <Section label="Recent" emoji={recent} onPick={onPick} />
            )}
            {EMOJI_GROUPS.map((group) => (
              <Section
                key={group.id}
                label={group.label}
                emoji={group.emoji.map((e) => e.char)}
                onPick={onPick}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  emoji,
  onPick,
}: {
  label: string;
  emoji: string[];
  onPick: (e: string) => void;
}) {
  return (
    <div className="mb-1">
      <div className="px-1 pt-2 pb-1 text-[11px] font-semibold text-ink-mute">{label}</div>
      <Grid emoji={emoji} onPick={onPick} />
    </div>
  );
}

function Grid({
  emoji,
  onPick,
  empty,
}: {
  emoji: string[];
  onPick: (e: string) => void;
  empty?: string;
}) {
  if (emoji.length === 0 && empty) {
    return <div className="px-1 py-6 text-center text-[12px] text-ink-mute">{empty}</div>;
  }
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emoji.map((char, i) => (
        <button
          key={`${char}-${i}`}
          type="button"
          onClick={() => onPick(char)}
          className="grid h-8 w-8 place-items-center rounded-sm text-[18px] hover:bg-hover"
        >
          {char}
        </button>
      ))}
    </div>
  );
}
