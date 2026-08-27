import { useShallow } from 'zustand/react/shallow';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  Download,
  Hash,
  Keyboard,
  Moon,
  Palette,
  Pin,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  Volume2,
  Focus,
} from 'lucide-react';
import { cx } from '../lib/cx';
import { exportChannelMarkdown } from '../lib/exportChannel';
import { allThemes, useAppStore } from '../store/useAppStore';
import { Kbd } from '../ui/primitives';

interface Action {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

/**
 * ⌘K does everything, not just navigation: jump to a channel, switch theme,
 * toggle a panel, export, open settings. One list, fuzzy-matched.
 */
export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useActions();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions
      .map((action) => ({ action, score: score(action, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.action);
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  function commit(action?: Action) {
    const target = action ?? results[cursor];
    if (!target) return;
    setOpen(false);
    target.run();
  }

  let lastGroup = '';

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="scrim anim-fade fixed inset-0 cursor-default"
      />
      <div className="sheet anim-rise relative w-full max-w-[560px] overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-ink-mute" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Jump to a channel, switch theme, run a command…"
            className="h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-mute"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <div className="px-3 py-8 text-center text-[13px] text-ink-mute">
              Nothing matches “{query}”.
            </div>
          )}
          {results.map((action, i) => {
            const header = action.group !== lastGroup ? action.group : null;
            lastGroup = action.group;
            return (
              <div key={action.id}>
                {header && (
                  <div className="px-2.5 pt-3 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-ink-mute uppercase">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  data-active={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(action)}
                  className={cx(
                    'flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left',
                    i === cursor ? 'bg-active text-ink' : 'text-ink-dim',
                  )}
                >
                  <span className="shrink-0 opacity-75">{action.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{action.label}</span>
                  {action.hint && (
                    <span className="shrink-0 text-[11px] text-ink-mute">{action.hint}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Simple subsequence match, weighted toward prefixes and word starts. */
function score(action: Action, query: string): number {
  const haystack = `${action.label} ${action.group}`.toLowerCase();
  if (haystack.startsWith(query)) return 100;
  const at = haystack.indexOf(query);
  if (at === 0) return 90;
  if (at > 0) return haystack[at - 1] === ' ' ? 70 : 40;

  let qi = 0;
  for (const char of haystack) {
    if (char === query[qi]) qi += 1;
    if (qi === query.length) return 20;
  }
  return 0;
}

function useActions(): Action[] {
  const servers = useAppStore((s) => s.servers);
  const channels = useAppStore((s) => s.channels);
  const themes = useAppStore(useShallow(allThemes));
  const themeId = useAppStore((s) => s.themeId);

  const jumpTo = useAppStore((s) => s.jumpTo);
  const joinVoice = useAppStore((s) => s.joinVoice);
  const setThemeId = useAppStore((s) => s.setThemeId);
  const openDialog = useAppStore((s) => s.openDialog);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const appearance = useAppStore((s) => s.appearance);
  const toast = useAppStore((s) => s.toast);

  return useMemo(() => {
    const out: Action[] = [];

    for (const channel of channels) {
      const server = servers.find((s) => s.id === channel.server_id);
      if (!server) continue;
      out.push({
        id: `ch-${channel.id}`,
        label: `#${channel.name}`,
        hint: server.name,
        group: 'Channels',
        icon: channel.type === 'VOICE' ? <Volume2 size={15} /> : <Hash size={15} />,
        run: () =>
          channel.type === 'VOICE' ? joinVoice(channel.id) : jumpTo(server.id, channel.id),
      });
    }

    for (const theme of themes) {
      out.push({
        id: `th-${theme.id}`,
        label: `Theme: ${theme.name}`,
        hint: theme.id === themeId ? 'Active' : theme.mode,
        group: 'Themes',
        icon: theme.mode === 'dark' ? <Moon size={15} /> : <Sun size={15} />,
        run: () => {
          setThemeId(theme.id);
          toast('ok', `${theme.name} applied`);
        },
      });
    }

    const commands: Action[] = [
      {
        id: 'cmd-studio',
        label: 'Open theme studio',
        group: 'Commands',
        icon: <Palette size={15} />,
        run: () => openDialog('themeStudio'),
      },
      {
        id: 'cmd-search',
        label: 'Search messages',
        group: 'Commands',
        icon: <Search size={15} />,
        run: () => setSearchOpen(true),
      },
      {
        id: 'cmd-focus',
        label: appearance.focusMode ? 'Turn off focus mode' : 'Turn on focus mode',
        group: 'Commands',
        icon: <Focus size={15} />,
        run: () => setAppearance({ focusMode: !appearance.focusMode }),
      },
      {
        id: 'cmd-members',
        label: 'Show members',
        group: 'Commands',
        icon: <Users size={15} />,
        run: () => openDialog('members'),
      },
      {
        id: 'cmd-pinned',
        label: 'Show pinned messages',
        group: 'Commands',
        icon: <Pin size={15} />,
        run: () => openDialog('pinned'),
      },
      {
        id: 'cmd-saved',
        label: 'Show saved messages',
        group: 'Commands',
        icon: <Bookmark size={15} />,
        run: () => openDialog('saved'),
      },
      {
        id: 'cmd-server',
        label: 'Create a server',
        group: 'Commands',
        icon: <Plus size={15} />,
        run: () => openDialog('createServer'),
      },
      {
        id: 'cmd-channel',
        label: 'Create a channel',
        group: 'Commands',
        icon: <Plus size={15} />,
        run: () => openDialog('createChannel'),
      },
      {
        id: 'cmd-join',
        label: 'Join a server with a code',
        group: 'Commands',
        icon: <Plus size={15} />,
        run: () => openDialog('joinServer'),
      },
      {
        id: 'cmd-export',
        label: 'Export this channel as Markdown',
        group: 'Commands',
        icon: <Download size={15} />,
        run: () => {
          const state = useAppStore.getState();
          if (state.activeChannelId) exportChannelMarkdown(state, state.activeChannelId);
        },
      },
      {
        id: 'cmd-settings',
        label: 'Open settings',
        group: 'Commands',
        icon: <Settings size={15} />,
        run: () => openDialog('settings'),
      },
      {
        id: 'cmd-keys',
        label: 'Keyboard shortcuts',
        group: 'Commands',
        icon: <Keyboard size={15} />,
        run: () => openDialog('shortcuts'),
      },
    ];

    return [...commands, ...out];
  }, [
    channels,
    servers,
    themes,
    themeId,
    appearance.focusMode,
    jumpTo,
    joinVoice,
    setThemeId,
    openDialog,
    setSearchOpen,
    setAppearance,
    toast,
  ]);
}
