import { useRef, useState } from 'react';
import { Bookmark, Check, ChevronDown, Download, Menu, MoreHorizontal, Palette, Pin, Plus, Search, Users } from 'lucide-react';
import { cx } from '../lib/cx';
import { monogram } from '../lib/id';
import { exportChannelMarkdown } from '../lib/exportChannel';
import { useAppStore } from '../store/useAppStore';
import { Avatar, IconButton, Kbd } from '../ui/primitives';
import { Popover } from '../ui/overlays';
import { IS_SUPABASE_CONFIGURED } from '../supabase';
import { modifierKey } from '../lib/platform';

/**
 * A single bar: where you are, what you're looking for, who you are.
 *
 * No channel name and no icon tray — the channel names itself in the
 * conversation below, and every command lives behind one search field.
 */
export function TopBar({ onToggleNav }: { onToggleNav: () => void }) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel/85 px-3 backdrop-blur-md">
      <button
        type="button"
        onClick={onToggleNav}
        aria-label="Show channels"
        className="grid h-9 w-9 place-items-center rounded-xl border border-transparent text-ink-mute hover:border-line hover:bg-hover md:hidden"
      >
        <Menu size={17} />
      </button>

      <WorkspaceSwitcher />
      {!IS_SUPABASE_CONFIGURED && <span className="hidden rounded-md border border-line px-2 py-1 text-[10px] font-semibold text-ink-mute sm:inline">Offline mode</span>}
      <SearchField />
      <OverflowMenu />
      <ProfileButton />
    </header>
  );
}

function WorkspaceSwitcher() {
  const servers = useAppStore((s) => s.servers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const setActiveServerId = useAppStore((s) => s.setActiveServerId);
  const openDialog = useAppStore((s) => s.openDialog);
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const active = servers.find((s) => s.id === activeServerId);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          'flex h-9 shrink-0 items-center gap-2 rounded-xl border px-2.5',
          open ? 'border-line bg-active text-ink' : 'border-transparent bg-surface/80 hover:border-line hover:bg-hover',
        )}
      >
        <span
          aria-hidden
          className="h-4 w-4 rounded-[5px]"
          style={{ backgroundColor: active?.icon_color ?? 'var(--accent)' }}
        />
        <span className="hidden max-w-[160px] truncate text-[13px] font-semibold text-ink sm:block">
          {active?.name ?? 'Beacon'}
        </span>
        <ChevronDown size={13} className="text-ink-mute" />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} placement="bottom" className="w-[260px]">
        <div className="p-1">
          {servers.map((server) => (
            <button
              key={server.id}
              type="button"
              onClick={() => {
                setActiveServerId(server.id);
                setOpen(false);
              }}
              className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left hover:bg-hover"
            >
              <span
                aria-hidden
                className="grid h-5 w-5 place-items-center rounded-[6px] text-[9px] font-bold text-white"
                style={{ backgroundColor: server.icon_color }}
              >
                {monogram(server.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">{server.name}</span>
              {server.id === activeServerId && <Check size={13} className="text-accent" />}
            </button>
          ))}
        </div>
        <div className="border-t border-line p-1">
          <Row icon={<Plus size={14} />} label="New server" onClick={() => { setOpen(false); openDialog('createServer'); }} />
          <Row icon={<Search size={14} />} label="Join with a code" onClick={() => { setOpen(false); openDialog('joinServer'); }} />
        </div>
      </Popover>
    </>
  );
}

/** The one entry point: channels, people, themes and commands all live here. */
function SearchField() {
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  return (
    <button
      type="button"
      onClick={() => setCommandOpen(true)}
      className="mx-auto flex h-10 w-full max-w-[460px] items-center gap-2 rounded-[18px] border border-line bg-surface/70 px-3 text-[12.5px] text-ink-mute transition-colors hover:border-line-strong hover:bg-hover/70 hover:text-ink-dim"
    >
      <Search size={13} />
      <span className="truncate">Search, jump, or run anything</span>
      <span className="ml-auto hidden sm:block">
        <Kbd>{modifierKey()} K</Kbd>
      </span>
    </button>
  );
}

function OverflowMenu() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const openDialog = useAppStore((s) => s.openDialog);
  const channel = useAppStore((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const toast = useAppStore((s) => s.toast);
  const isServer = channel?.type !== 'DM';

  function pick(run: () => void) {
    setOpen(false);
    run();
  }

  return (
    <>
      <IconButton ref={anchor} label="This channel" size="sm" onClick={() => setOpen(true)}>
        <MoreHorizontal size={17} />
      </IconButton>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} placement="bottom-end" className="w-[218px]">
        <div className="p-1">
          {isServer && <><Row icon={<Users size={14} />} label="Members" onClick={() => pick(() => openDialog('members'))} /><Row icon={<Pin size={14} />} label="Pinned" onClick={() => pick(() => openDialog('pinned'))} /><Row icon={<Bookmark size={14} />} label="Saved" onClick={() => pick(() => openDialog('saved'))} /><div className="my-1 h-px bg-line" /></>}
          <Row icon={<Palette size={14} />} label="Appearance" hint={`${modifierKey()} T`} onClick={() => pick(() => openDialog('settings'))} />
          <Row
            icon={<Download size={14} />}
            label="Export as Markdown"
            onClick={() =>
              pick(() => {
                if (!channel) return;
                exportChannelMarkdown(useAppStore.getState(), channel.id);
                toast('ok', 'Channel exported', `${channel.name}.md saved`);
              })
            }
          />
        </div>
      </Popover>
    </>
  );
}

/** Your face, top right, where every OS puts the account. */
function ProfileButton() {
  const me = useAppStore((s) => s.appUser);
  const openDialog = useAppStore((s) => s.openDialog);
  return (
    <button
      type="button"
      onClick={() => openDialog('profile')}
      title="Your profile"
      className="ml-0.5 shrink-0 rounded-full border border-transparent transition-colors hover:border-line hover:bg-hover"
    >
      <Avatar name={me.displayName || me.username} color={me.avatarColor} image={me.avatar} size="sm" presence={me.presence} />
    </button>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-left text-[13px] text-ink-dim hover:bg-hover hover:text-ink"
    >
      <span className="text-ink-mute">{icon}</span>
      {label}
      {hint && <span className="ml-auto font-mono text-[10.5px] text-ink-mute">{hint}</span>}
    </button>
  );
}
