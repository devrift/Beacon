import { useEffect, useRef, useState } from 'react';
import { queueMessageDatabaseSync, readMessageDatabase } from './lib/messageDatabase';
import { useAppStore } from './store/useAppStore';
import { useThemeEffect } from './theme/useThemeEffect';
import { useVoice } from './hooks/useVoice';
import { useRealtime } from './hooks/useRealtime';
import { useFileTransfer } from './hooks/useFileTransfer';
import { TopBar } from './components/TopBar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import { DirectMessageDialog, MembersDialog, PinnedDialog, SavedDialog } from './components/Panels';
import { ProfileDialog } from './components/Profile';
import { CommandPalette } from './components/CommandPalette';
import { SearchPanel } from './components/SearchPanel';
import { Lightbox } from './components/Lightbox';
import { SettingsModal } from './components/SettingsModal';
import { ThemeStudio } from './components/ThemeStudio';
import {
  CreateChannelDialog,
  CreateServerDialog,
  JoinServerDialog,
  PollDialog,
  ShortcutsDialog,
} from './components/Dialogs';
import { ToastHost } from './ui/toast';
import { AuthModal } from './components/AuthModal';
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const seedIfEmpty = useAppStore((s) => s.seedIfEmpty);
  const ensureBeaconWelcome = useAppStore((s) => s.ensureBeaconWelcome);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const authReady = useAuthStore((s) => s.ready);
  const authUser = useAuthStore((s) => s.user);
  const guest = useAuthStore((s) => s.guest);

  const [navOpen, setNavOpen] = useState(false);

  useThemeEffect();
  useVoice();
  useRealtime();
  useFileTransfer();
  useHotkeys();
  useMessageDatabase(hydrated);

  useEffect(() => initializeAuth(), [initializeAuth]);

  // Seed only into an empty app, and only after rehydration — otherwise a reload
  // would wipe whatever the user built.
  useEffect(() => {
    if (!hydrated) return;
    if (guest) seedIfEmpty();
    if (authUser) ensureBeaconWelcome();
  }, [hydrated, authUser, guest, seedIfEmpty, ensureBeaconWelcome]);

  // Ensure a server is selected once data exists.
  useEffect(() => {
    if (!hydrated) return;
    const state = useAppStore.getState();
    if (!state.activeServerId && state.servers.length > 0) {
      state.setActiveServerId(state.servers[0].id);
    }
  }, [hydrated, activeServerId]);

  if (!hydrated) {
    return <div className="h-screen w-screen bg-canvas" />;
  }

  if (!authReady) {
    return <div className="h-screen w-screen bg-canvas" />;
  }

  if (!authUser && !guest) {
    return <><AuthModal /><ToastHost /></>;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas">
      <TopBar onToggleNav={() => setNavOpen(true)} />

      {/* One continuous field. The only divisions are hairlines — no stacked
          panels in three different greys. */}
      <div className="flex min-h-0 flex-1">
        <ChannelSidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <main className="flex min-w-0 flex-1 flex-col">
          <MessageList />
          <Composer />
        </main>
      </div>

      <CommandPalette />
      <SearchPanel />
      <Lightbox />
      <SettingsModal />
      <ThemeStudio />
      <CreateServerDialog />
      <CreateChannelDialog />
      <JoinServerDialog />
      <PollDialog />
      <ShortcutsDialog />
      <MembersDialog />
      <PinnedDialog />
      <SavedDialog />
      <DirectMessageDialog />
      <ProfileDialog />
      <ToastHost />
      <AuthModal />
    </div>
  );
}

/** Loads durable history once, then mirrors subsequent changes into IndexedDB. */
function useMessageDatabase(hydrated: boolean): void {
  const installed = useRef(false);

  useEffect(() => {
    if (!hydrated || installed.current) return;
    installed.current = true;
    let alive = true;
    let unsubscribe: (() => void) | undefined;

    void readMessageDatabase().then((stored) => {
      if (!alive) return;
      if (stored && Object.keys(stored).length > 0) {
        useAppStore.setState({ messagesByChannel: stored });
      } else {
        queueMessageDatabaseSync(useAppStore.getState().messagesByChannel);
      }
      unsubscribe = useAppStore.subscribe((state, previous) => {
        if (state.messagesByChannel !== previous.messagesByChannel) {
          queueMessageDatabaseSync(state.messagesByChannel);
        }
      });
    });

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [hydrated]);
}

/** Global keys. Registered once, here, so nothing fights over them. */
function useHotkeys(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const store = useAppStore.getState();

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        store.setCommandOpen(!store.commandOpen);
        return;
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        store.setSearchOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === 't') {
        e.preventDefault();
        store.openDialog('themeStudio');
        return;
      }
      if (mod && e.key === ',') {
        e.preventDefault();
        store.openDialog('settings');
        return;
      }
      if (mod && e.key === '/') {
        e.preventDefault();
        store.openDialog('shortcuts');
        return;
      }

      // Alt+Arrow walks the current server's text channels.
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const list = store.channels.filter(
          (c) => c.server_id === store.activeServerId && c.type === 'TEXT',
        );
        if (list.length === 0) return;
        e.preventDefault();
        const at = list.findIndex((c) => c.id === store.activeChannelId);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const next = list[(at + delta + list.length) % list.length];
        store.setActiveChannelId(next.id);
        return;
      }

      // Esc cancels a reply when nothing else is open to consume it.
      if (
        e.key === 'Escape' &&
        store.replyingTo &&
        !store.dialog &&
        !store.commandOpen &&
        !store.searchOpen
      ) {
        store.setReplyingTo(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
