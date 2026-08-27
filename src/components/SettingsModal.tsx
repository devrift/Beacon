import { memo, useEffect, useRef, useState } from 'react';
import { Bell, Database, Keyboard, LogOut, Mic, Palette, User } from 'lucide-react';
import { cx } from '../lib/cx';
import { fileSize } from '../lib/time';
import { clearBlobs, revokeAllUrls, storedBytes } from '../lib/blobStore';
import { exportBackup, importBackup } from '../lib/backup';
import { ProfileCard } from './Profile';
import { UI_FONT_LABELS, type Density, type FontScale, type RadiusScale, type UiFont } from '../theme/types';
import { useAppStore, type Presence } from '../store/useAppStore';
import {
  Button,
  FieldLabel,
  Segmented,
  SettingRow,
  Switch,
  TextArea,
} from '../ui/primitives';
import { ConfirmDialog, Modal } from '../ui/overlays';
import { useAuthStore } from '../store/useAuthStore';
import { IS_SUPABASE_CONFIGURED, supabase } from '../supabase';

type Tab = 'profile' | 'appearance' | 'voice' | 'notifications' | 'keybinds' | 'data';

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'My account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'keybinds', label: 'Keybinds', icon: Keyboard },
  { id: 'data', label: 'Data', icon: Database },
];

export function SettingsModal() {
  const open = useAppStore((s) => s.dialog === 'settings');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const [tab, setTab] = useState<Tab>('profile');
  const logout = useAuthStore((s) => s.logout);

  return (
    <Modal open={open} onClose={closeDialog} title="Settings" width="xxl">
      <div className="flex min-h-[600px] gap-6">
        <nav className="flex w-[172px] shrink-0 flex-col gap-0.5 border-r border-line pr-4">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cx(
                  'flex h-8 items-center gap-2 rounded-sm px-2 text-left text-[13px]',
                  tab === item.id ? 'bg-active text-ink' : 'text-ink-mute hover:bg-hover hover:text-ink-dim',
                )}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
          <button type="button" onClick={() => void logout()} className="mt-auto flex h-8 items-center gap-2 rounded-sm px-2 text-left text-[13px] text-danger hover:bg-danger/10"><LogOut size={14} />Log out</button>
        </nav>
        <div className="min-w-0 flex-1">
          <div className="transition-all duration-150 ease-out">
            {tab === 'profile' && <ProfileTab />}
            {tab === 'appearance' && <AppearanceTab />}
            {tab === 'voice' && <VoiceTab />}
            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'keybinds' && <KeybindsTab />}
            {tab === 'data' && <DataTab />}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Identity lives in the profile editor now; this is the short way in. */
const ProfileTab = memo(function ProfileTab() {
  const appUser = useAppStore((s) => s.appUser);
  const setAppUser = useAppStore((s) => s.setAppUser);
  const openDialog = useAppStore((s) => s.openDialog);

  return (
    <div>
      <ProfileCard user={appUser} />

      <div className="mt-3">
        <SettingRow title="Your profile" help="Name, avatar, banner, bio and effects.">
          <Button onClick={() => openDialog('profile')}>Edit profile</Button>
        </SettingRow>
      </div>

      <div className="mt-4">
        <FieldLabel>Availability</FieldLabel>
        <Segmented
          label="Availability"
          value={appUser.presence}
          onChange={(presence: Presence) => {
            setAppUser({ presence });
            const userId = useAuthStore.getState().user?.id;
            if (IS_SUPABASE_CONFIGURED && userId) void (async () => { try { await supabase.from('profiles').upsert({ id: userId, status: presence }); } catch { /* offline state remains active */ } })();
          }}
          options={[
            { value: 'online', label: 'Online' },
            { value: 'idle', label: 'Away' },
            { value: 'dnd', label: 'Busy' },
            { value: 'offline', label: 'Invisible' },
          ]}
        />
      </div>
      <div className="mt-5">
        <FieldLabel>Banner accent</FieldLabel>
        <div className="flex gap-2">{['#7c5cfc', '#3ecf8e', '#f0b940', '#e04848'].map((color) => <button key={color} type="button" aria-label={`Banner ${color}`} onClick={() => setAppUser({ bannerFrom: color, bannerTo: color })} className="h-7 w-7 rounded-full transition-transform hover:scale-110" style={{ backgroundColor: color }} />)}</div>
      </div>
      <div className="mt-5"><FieldLabel>Avatar decoration</FieldLabel><Segmented label="Avatar decoration" value={appUser.effect ?? 'none'} onChange={(effect) => setAppUser({ effect })} options={[{ value: 'none', label: 'None' }, { value: 'ring', label: 'Ring' }, { value: 'sheen', label: 'Sheen' }]} /></div>

      <div className="mt-4">
        <FieldLabel>Status</FieldLabel>
        <TextArea
          rows={2}
          value={appUser.customStatus}
          onChange={(e) => setAppUser({ customStatus: e.target.value })}
          placeholder="What are you up to?"
          maxLength={80}
        />
      </div>
    </div>
  );
});

const VoiceTab = memo(function VoiceTab() {
  const [input, setInput] = useStored('beacon_audio_input', 'default');
  const [output, setOutput] = useStored('beacon_audio_output', 'default');
  const [volume, setVolume] = useStored('beacon_audio_volume', '100');
  const [echo, setEcho] = useStored('beacon_echo_cancellation', 'true');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
      return navigator.mediaDevices.enumerateDevices();
    }).then(setDevices).catch(() => setDevices([]));
  }, []);

  const inputs = devices.filter((device) => device.kind === 'audioinput');
  const outputs = devices.filter((device) => device.kind === 'audiooutput');
  return (
    <div className="divide-y divide-line">
      <SettingRow title="Input device"><DeviceSelect value={input} onChange={setInput} devices={inputs} /></SettingRow>
      <SettingRow title="Output device"><DeviceSelect value={output} onChange={setOutput} devices={outputs} /></SettingRow>
      <SettingRow title="Input volume"><input aria-label="Input volume" className="accent-accent" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(event.target.value)} /></SettingRow>
      <SettingRow title="Echo cancellation" help="Applied when joining the next voice channel."><Switch label="Echo cancellation" checked={echo === 'true'} onChange={(value) => setEcho(String(value))} /></SettingRow>
    </div>
  );
});

function NotificationsTab() {
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const setSoundEnabled = useAppStore((s) => s.setSoundEnabled);
  const [badge, setBadge] = useStored('beacon_unread_badges', 'true');
  return <div className="divide-y divide-line">
    <SettingRow title="Notification sounds"><Switch label="Notification sounds" checked={soundEnabled} onChange={setSoundEnabled} /></SettingRow>
    <SettingRow title="Unread badges"><Switch label="Unread badges" checked={badge === 'true'} onChange={(value) => setBadge(String(value))} /></SettingRow>
  </div>;
}

function KeybindsTab() {
  return <div className="divide-y divide-line">
    <SettingRow title="Command palette" help="Open quick navigation and commands."><kbd className="text-[12px] text-ink-dim">Ctrl K</kbd></SettingRow>
    <SettingRow title="Search" help="Search current and saved conversations."><kbd className="text-[12px] text-ink-dim">Ctrl F</kbd></SettingRow>
    <SettingRow title="Voice transmit" help="Voice channels use open mic."><span className="text-[12px] text-ink-mute">Open mic</span></SettingRow>
  </div>;
}

function DeviceSelect({ value, onChange, devices }: { value: string; onChange: (value: string) => void; devices: MediaDeviceInfo[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="field h-8 w-[190px] px-2 text-[12px]"> <option value="default">System default</option>{devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select>;
}

function useStored(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => window.localStorage.getItem(key) ?? fallback);
  const update = (next: string) => {
    window.localStorage.setItem(key, next);
    setValue(next);
  };
  return [value, update];
}

const AppearanceTab = memo(function AppearanceTab() {
  const appearance = useAppStore((s) => s.appearance);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const openDialog = useAppStore((s) => s.openDialog);

  return (
    <div className="divide-y divide-line">
      <SettingRow title="Themes" help="Eight presets, plus anything you build.">
        <Button onClick={() => openDialog('themeStudio')}>Open studio</Button>
      </SettingRow>

      <SettingRow title="Corners" help="How round every surface is.">
        <Segmented
          label="Corners"
          value={appearance.radius}
          onChange={(radius: RadiusScale) => setAppearance({ radius })}
          options={[
            { value: 'sharp', label: 'Sharp' },
            { value: 'soft', label: 'Soft' },
            { value: 'round', label: 'Round' },
          ]}
        />
      </SettingRow>

      <SettingRow title="Density" help="Compact fits noticeably more on screen.">
        <Segmented
          label="Density"
          value={appearance.density}
          onChange={(density: Density) => setAppearance({ density })}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
          ]}
        />
      </SettingRow>

      <SettingRow title="Text size">
        <Segmented
          label="Text size"
          value={appearance.fontScale}
          onChange={(fontScale: FontScale) => setAppearance({ fontScale })}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Default' },
            { value: 'lg', label: 'Large' },
          ]}
        />
      </SettingRow>

      <SettingRow title="Interface font">
        <Segmented
          label="Interface font"
          value={appearance.uiFont}
          onChange={(uiFont: UiFont) => setAppearance({ uiFont })}
          options={(Object.keys(UI_FONT_LABELS) as UiFont[]).map((key) => ({
            value: key,
            label: UI_FONT_LABELS[key],
          }))}
        />
      </SettingRow>

      <SettingRow title="Animations" help="Turn off for a completely still interface.">
        <Switch
          label="Animations"
          checked={appearance.animations}
          onChange={(animations) => setAppearance({ animations })}
        />
      </SettingRow>

      <SettingRow title="Focus mode" help="Dims everything but the conversation until you hover it.">
        <Switch
          label="Focus mode"
          checked={appearance.focusMode}
          onChange={(focusMode) => setAppearance({ focusMode })}
        />
      </SettingRow>

      <div className="py-3">
        <FieldLabel>Custom CSS</FieldLabel>
        <p className="mb-2 text-[12px] leading-relaxed text-ink-mute">
          Applied to the whole app, last. Every theme token is a variable you can override — try{' '}
          <code className="font-mono text-[11px] text-ink-dim">:root {'{'} --accent: #ff5c8a {'}'}</code>.
        </p>
        <TextArea
          rows={5}
          value={appearance.customCss}
          onChange={(e) => setAppearance({ customCss: e.target.value })}
          placeholder=":root { --accent: #ff5c8a; }"
          className="font-mono text-[12px]"
          spellCheck={false}
        />
      </div>
    </div>
  );
});

const DataTab = memo(function DataTab() {
  const resetEverything = useAppStore((s) => s.resetEverything);
  const toast = useAppStore((s) => s.toast);
  const servers = useAppStore((s) => s.servers.length);
  const messages = useAppStore((s) =>
    Object.values(s.messagesByChannel).reduce((sum, list) => sum + list.length, 0),
  );
  const [bytes, setBytes] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void storedBytes().then(setBytes);
  }, []);

  return (
    <div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-mute">
        Everything lives on this device. Nothing is uploaded, and nothing leaves unless you export it.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat label="Servers" value={String(servers)} />
        <Stat label="Messages" value={String(messages)} />
        <Stat label="Attachments" value={bytes === null ? '—' : fileSize(bytes)} />
      </div>

      <div className="divide-y divide-line">
        <SettingRow
          title="Back up everything"
          help="Writes your servers, channels, messages and themes to one file."
        >
          <Button
            onClick={() => {
              exportBackup();
              toast('ok', 'Backup saved', 'Keep it anywhere you like.');
            }}
          >
            Export backup
          </Button>
        </SettingRow>
        <SettingRow
          title="Restore from a backup"
          help="Replaces what is on this device, then reloads."
        >
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                void importBackup(file)
                  .then(() => window.location.reload())
                  .catch((error: Error) => toast('danger', 'Restore failed', error.message));
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>Choose file</Button>
          </>
        </SettingRow>
        <SettingRow title="Clear attachments" help="Removes stored files. Messages keep their text.">
          <Button
            onClick={() => {
              void clearBlobs().then(() => {
                revokeAllUrls();
                setBytes(0);
                toast('ok', 'Attachments cleared');
              });
            }}
          >
            Clear files
          </Button>
        </SettingRow>
        <SettingRow title="Reset Beacon" help="Deletes every server, message, theme and preference.">
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Reset everything
          </Button>
        </SettingRow>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          void clearBlobs();
          revokeAllUrls();
          resetEverything();
          window.location.reload();
        }}
        title="Reset Beacon?"
        body="Every server, channel, message, attachment and custom theme on this device is deleted. This cannot be undone."
        confirmLabel="Reset everything"
      />
    </div>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2.5">
      <div className="font-display text-[18px] font-semibold text-ink tnum">{value}</div>
      <div className="text-[11px] text-ink-mute">{label}</div>
    </div>
  );
}
