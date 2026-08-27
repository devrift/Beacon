import { useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  ChevronDown,
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  Plus,
  Trash2,
  PhoneOff,
  Settings,
  UserPlus,
  Pencil,
  Moon,
  CircleMinus,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { cx } from '../lib/cx';
import { useAttachmentUrl } from '../hooks/useObjectUrl';
import { useAppStore, unreadCount, type Channel, type Server } from '../store/useAppStore';
import { Avatar, IconButton } from '../ui/primitives';
import { ConfirmDialog, Popover } from '../ui/overlays';
import { useAuthStore } from '../store/useAuthStore';

/**
 * The spine.
 *
 * Deliberately text-only: no glyph in front of every channel name, no coloured
 * fill behind the column. A channel is a word, and the only ornament in the
 * list is a two-pixel tick marking where you are. Everything the eye has to
 * scan is the thing you were actually looking for.
 */
export function ChannelSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const servers = useAppStore((s) => s.servers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const channels = useAppStore((s) => s.channels);
  const openDialog = useAppStore((s) => s.openDialog);
  const toast = useAppStore((s) => s.toast);
  const deleteServer = useAppStore((s) => s.deleteServer);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  const server = servers.find((s) => s.id === activeServerId);

  const mine = server ? channels.filter((c) => c.server_id === server.id) : [];
  const dms = channels.filter((c) => c.type === 'DM');
  const text = mine.filter((c) => c.type === 'TEXT');
  const voice = mine.filter((c) => c.type === 'VOICE');

  return (
    <>
      {/* On a phone the spine is a drawer; on a desktop it is just a column. */}
      {open && (
        <button
          type="button"
          aria-label="Close channels"
          onClick={onClose}
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
        />
      )}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col border-r border-line bg-panel/95',
          'transition-transform md:static md:z-auto md:w-[244px] md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
      <button ref={menuRef} type="button" disabled={!server} onClick={() => setMenuOpen(true)} className="flex h-12 w-full shrink-0 items-center gap-2 border-b border-line px-3 text-left transition-all duration-150 ease-out hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent">
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-white/95">{server?.name ?? 'Messages'}</span>
        {server && <ChevronDown size={16} className={cx('text-ink-mute transition-transform duration-150', menuOpen && 'rotate-180')} />}
      </button>
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        {/* Direct messages belong to you, not to a server, so they sit above the
            server's own channels and never change when you switch workspaces. */}
        <Section label="Direct messages" count={dms.length} onAdd={() => openDialog('newDm')} />
        {dms.map((channel) => (
          <TextChannelRow key={channel.id} channel={channel} />
        ))}
        {dms.length === 0 && (
          <button
            type="button"
            onClick={() => openDialog('newDm')}
            className="flex h-[30px] w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-ink-mute transition-colors hover:bg-hover hover:text-ink"
          >
            <Plus size={13} /> Start a private message
          </button>
        )}

        {server && <>
          <div className="my-3 h-px bg-line" />
          <ServerIdentity server={server} />
          <Section label={server.name.toLowerCase()} count={text.length} onAdd={() => openDialog('createChannel')} />
          {text.map((channel) => <TextChannelRow key={channel.id} channel={channel} />)}
          {text.length === 0 && <Hint>Nothing here yet.</Hint>}
          {voice.length > 0 && <><Section label="voice" count={voice.length} onAdd={() => openDialog('createChannel')} />{voice.map((channel) => <VoiceChannelRow key={channel.id} channel={channel} />)}</>}
        </>}
      </div>

      <VoiceDock />

      <footer className="shrink-0 border-t border-line bg-surface/80 px-2 py-1">
        <UserBar />
      </footer>

      {server && <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuRef} placement="bottom">
        <div className="w-[218px] p-1">
          <MenuItem
            icon={<Settings size={14} />}
            label="Server settings"
            onClick={() => {
              openDialog('settings');
              setMenuOpen(false);
            }}
          />
          <MenuItem icon={<UserPlus size={14} />} label="Invite people" onClick={() => { void navigator.clipboard.writeText(server.invite_code); toast('ok', 'Invite code copied', server.invite_code); setMenuOpen(false); }} />
          <MenuItem
            icon={<Plus size={14} />}
            label="Create channel"
            onClick={() => {
              openDialog('createChannel');
              setMenuOpen(false);
            }}
          />
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Delete server"
            danger
            onClick={() => {
              setConfirmDelete(true);
              setMenuOpen(false);
            }}
          />
        </div>
      </Popover>}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!server) return;
          deleteServer(server.id);
          toast('info', 'Server deleted', server.name);
        }}
        title={`Delete ${server?.name ?? 'server'}?`}
        body="Its channels and every message in them are removed from this device. This cannot be undone."
      />
    </aside>
    </>
  );
}

function UserBar() {
  const user = useAppStore((s) => s.appUser);
  const isMuted = useAppStore((s) => s.isMuted);
  const isDeafened = useAppStore((s) => s.isDeafened);
  const setMuted = useAppStore((s) => s.setMuted);
  const setDeafened = useAppStore((s) => s.setDeafened);
  const openDialog = useAppStore((s) => s.openDialog);
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const setPresence = (presence: typeof user.presence) => {
    useAppStore.getState().setAppUser({ presence });
    setOpen(false);
  };

  return (
    <div className="flex h-9 items-center gap-1">
      <button ref={anchor} type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 hover:bg-hover">
        <Avatar name={user.displayName || user.username} color={user.avatarColor} image={user.avatar} size="sm" presence={user.presence} />
        <span className="min-w-0 text-left leading-tight">
          <span className="block truncate text-[11.5px] font-semibold text-ink">{user.displayName || user.username}</span>
          <span className="block truncate text-[10.5px] text-ink-mute">@{user.username}</span>
        </span>
      </button>
      <IconButton label={isMuted ? 'Unmute' : 'Mute'} size="sm" active={isMuted} onClick={() => setMuted(!isMuted)}>
        {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
      </IconButton>
      <IconButton label={isDeafened ? 'Undeafen' : 'Deafen'} size="sm" active={isDeafened} onClick={() => setDeafened(!isDeafened)}>
        {isDeafened ? <HeadphoneOff size={14} className="text-danger" /> : <Headphones size={14} />}
      </IconButton>
      <IconButton label="Settings" size="sm" onClick={() => openDialog('settings')}><Settings size={14} /></IconButton>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} placement="top" className="w-[232px]">
        <div className="p-1">
          <MenuItem icon={<Pencil size={14} />} label="Edit profile" onClick={() => { setOpen(false); openDialog('profile'); }} />
          <div className="my-1 h-px bg-white/10" />
          <div className="px-2 py-1 text-[11px] font-semibold text-ink-mute">Set status</div>
          <MenuItem icon={<span className="h-2 w-2 rounded-full bg-ok" />} label="Online" onClick={() => setPresence('online')} />
          <MenuItem icon={<Moon size={14} className="text-warn" />} label="Idle / Away" onClick={() => setPresence('idle')} />
          <MenuItem icon={<CircleMinus size={14} className="text-danger" />} label="Do not disturb" onClick={() => setPresence('dnd')} />
          <MenuItem icon={<span className="h-3 w-3 rounded-full border border-ink-mute" />} label="Invisible" onClick={() => setPresence('offline')} />
          <div className="my-1 h-px bg-white/10" />
          <MenuItem icon={<UserCheck size={14} />} label="Switch accounts" onClick={() => setAccountsOpen(!accountsOpen)} />
          {accountsOpen && <div className="mx-1 rounded-md bg-hover p-1"><div className="px-2 py-1 text-[11px] text-ink-mute">{user.displayName || user.username}</div><MenuItem icon={<Plus size={13} />} label="Add account" onClick={() => void logout()} /></div>}
          <MenuItem icon={<LogOut size={14} />} label="Log out" danger onClick={() => void logout()} />
        </div>
      </Popover>
    </div>
  );
}

function ServerIdentity({ server }: { server: Server }) {
  const bannerUrl = useAttachmentUrl(server.banner);
  const iconUrl = useAttachmentUrl(server.icon);
  if (!bannerUrl && !server.description && !iconUrl) return null;
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative h-16 bg-raised">
        {bannerUrl && <img src={bannerUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="relative px-2.5 pb-2.5">
        <div
          className="-mt-5 grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 border-surface text-[12px] font-semibold text-accent-ink"
          style={{ backgroundColor: server.icon_color ?? 'var(--accent)' }}
        >
          {iconUrl ? <img src={iconUrl} alt="" className="h-full w-full rounded-full object-cover" /> : server.name.slice(0, 1).toUpperCase()}
        </div>
        <p className="mt-1.5 truncate text-[15px] font-bold tracking-tight text-white/95">{server.name}</p>
        {server.description && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-mute">{server.description}</p>}
      </div>
    </div>
  );
}

function Section({ label, count, onAdd }: { label: string; count: number; onAdd: () => void }) {
  return (
    <div className="group mb-1 flex items-center gap-2 px-2 pt-4 first:pt-0">
      <span className="text-[11px] tracking-[0.02em] text-ink-mute">{label}</span>
      <span className="font-mono text-[10.5px] text-ink-mute/60 tnum">{count}</span>
      <span className="h-px flex-1 bg-line" />
      <button
        type="button"
        onClick={onAdd}
        title="Create channel"
        className="text-ink-mute opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-[12px] text-ink-mute">{children}</div>;
}

function TextChannelRow({ channel }: { channel: Channel }) {
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const setActiveChannelId = useAppStore((s) => s.setActiveChannelId);
  const muted = useAppStore((s) => s.mutedChannelIds.includes(channel.id));
  const toggleChannelMute = useAppStore((s) => s.toggleChannelMute);
  const unread = useAppStore((s) => unreadCount(s, channel.id));

  const active = channel.id === activeChannelId;
  const bold = unread > 0 && !active && !muted;

  return (
    <div className="group relative">
      {/* The only ornament in the list. */}
      <span
        aria-hidden
        className={cx(
          'absolute top-1/2 left-0 h-3.5 w-[2px] -translate-y-1/2 rounded-full transition-opacity',
          active ? 'bg-accent opacity-100' : 'opacity-0',
        )}
      />
      <button
        type="button"
        onClick={() => setActiveChannelId(channel.id)}
        className={cx(
          'flex h-[32px] w-full items-center gap-2 rounded-[10px] pr-2 pl-3 text-left transition-colors',
          active
            ? 'border border-line bg-active text-ink'
            : 'text-ink-dim hover:bg-hover hover:text-ink',
          muted && !active && 'opacity-40',
        )}
      >
        <span className={cx('truncate text-[13px]', bold ? 'font-medium text-ink' : 'font-normal')}>
          {channel.name}
        </span>
        {bold && (
          <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-dim tnum group-hover:hidden">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => toggleChannelMute(channel.id)}
        title={muted ? 'Unmute channel' : 'Mute channel'}
        className="absolute top-[7px] right-1.5 hidden text-ink-mute group-hover:block hover:text-ink"
      >
        {muted ? <BellOff size={13} /> : <Bell size={13} />}
      </button>
    </div>
  );
}

function VoiceChannelRow({ channel }: { channel: Channel }) {
  const voiceChannelId = useAppStore((s) => s.voiceChannelId);
  const joinVoice = useAppStore((s) => s.joinVoice);
  const leaveVoice = useAppStore((s) => s.leaveVoice);
  const peers = useAppStore((s) => s.voicePeers);
  const connected = voiceChannelId === channel.id;
  const list = connected ? Object.values(peers) : [];

  return (
    <div>
      <button
        type="button"
        onClick={() => (connected ? leaveVoice() : joinVoice(channel.id))}
        className={cx(
          'flex h-[32px] w-full items-center gap-2 rounded-[10px] pr-2 pl-3 text-left transition-colors',
          connected ? 'border border-line bg-hover/80 text-ink' : 'text-ink-dim hover:bg-hover hover:text-ink',
        )}
      >
        <span className="truncate text-[13px]">{channel.name}</span>
        {connected ? (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok anim-pulse" />
              live
            </span>
        ) : (
          <span className="ml-auto shrink-0 text-[11px] text-ink-mute opacity-0 transition-opacity group-hover:opacity-100">
            join
          </span>
        )}
      </button>

      {list.length > 0 && (
        <div className="mt-0.5 mb-1 ml-3 flex flex-col gap-1 border-l border-line pl-3">
          {list.map((peer) => (
            <div key={peer.id} className="flex items-center gap-2">
              <Avatar name={peer.username} color={peer.avatarColor} size="xs" speaking={peer.speaking} />
              <span className="truncate text-[12px] text-ink-dim">{peer.username}</span>
              {peer.muted && <MicOff size={11} className="ml-auto text-ink-mute" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Appears above the footer whenever you are connected to voice. */
function VoiceDock() {
  const voiceChannelId = useAppStore((s) => s.voiceChannelId);
  const channels = useAppStore((s) => s.channels);
  const isMuted = useAppStore((s) => s.isMuted);
  const isDeafened = useAppStore((s) => s.isDeafened);
  const setMuted = useAppStore((s) => s.setMuted);
  const setDeafened = useAppStore((s) => s.setDeafened);
  const leaveVoice = useAppStore((s) => s.leaveVoice);
  const voiceError = useAppStore((s) => s.voiceError);

  if (!voiceChannelId) return null;
  const channel = channels.find((c) => c.id === voiceChannelId);

  return (
    <div className="shrink-0 border-t border-line px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok anim-pulse" />
        <span className="truncate text-[12px] font-medium text-ink">{channel?.name ?? 'Voice'}</span>
      </div>
      {voiceError && <div className="mb-1.5 text-[11px] leading-snug text-danger">{voiceError}</div>}
      <div className="flex items-center gap-1">
        <IconButton
          label={isMuted ? 'Unmute' : 'Mute'}
          size="sm"
          active={isMuted}
          onClick={() => setMuted(!isMuted)}
        >
          {isMuted ? <MicOff size={15} className="text-danger" /> : <Mic size={15} />}
        </IconButton>
        <IconButton
          label={isDeafened ? 'Undeafen' : 'Deafen'}
          size="sm"
          active={isDeafened}
          onClick={() => setDeafened(!isDeafened)}
        >
          {isDeafened ? <HeadphoneOff size={15} className="text-danger" /> : <Headphones size={15} />}
        </IconButton>
        <IconButton label="Disconnect" size="sm" tone="danger" onClick={leaveVoice} className="ml-auto">
          <PhoneOff size={15} />
        </IconButton>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
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
      <span className="truncate">{label}</span>
      {hint && <span className="ml-auto font-mono text-[11px] text-ink-mute">{hint}</span>}
    </button>
  );
}
