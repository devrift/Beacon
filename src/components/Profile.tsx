import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { cx } from '../lib/cx';
import { monogram } from '../lib/id';
import { fileToAttachment, MAX_UPLOAD_BYTES } from '../lib/upload';
import { useAttachmentUrl } from '../hooks/useObjectUrl';
import { useAppStore, type AppUser } from '../store/useAppStore';
import { Input, TextArea } from '../ui/primitives';
import { Modal } from '../ui/overlays';
import { IS_SUPABASE_CONFIGURED, supabase } from '../supabase';

/**
 * Your profile, and it is meant to be shown off.
 *
 * Discord gives you an avatar and a colour; Instagram gives you a page. This is
 * the middle: a banner, a display name over a stable handle, pronouns, a bio,
 * and one animated effect — edited beside a live card so you see the result
 * before you keep it.
 */

export function ProfileDialog() {
  const open = useAppStore((s) => s.dialog === 'profile');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const me = useAppStore((s) => s.appUser);
  const setAppUser = useAppStore((s) => s.setAppUser);
  const toast = useAppStore((s) => s.toast);

  const [draft, setDraft] = useState<AppUser>(me);
  const patch = (next: Partial<AppUser>) => setDraft((d) => ({ ...d, ...next }));
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  // Reopening starts from what is actually saved, never from an abandoned edit.
  useEffect(() => {
    if (open) setDraft(me);
  }, [open, me]);

  function save() {
    setAppUser({
      ...draft,
      username: draft.username.trim().replace(/\s+/g, '_').slice(0, 24) || me.username,
      displayName: draft.displayName?.trim() || undefined,
    });
    if (IS_SUPABASE_CONFIGURED) {
      void (async () => { try { await supabase.from('profiles').upsert({ id: draft.id, username: draft.username, display_name: draft.displayName, custom_status: draft.customStatus, bio: draft.bio, pronouns: draft.pronouns, avatar_color: draft.avatarColor, avatar: draft.avatar ?? null, banner: draft.banner ?? null }); } catch { /* local profile remains available */ } })();
    }
    toast('ok', 'Profile saved');
    closeDialog();
  }

  async function selectImage(file: File | undefined, field: 'avatar' | 'banner') {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('warn', 'Choose an image', 'Profile photos and banners must be image files.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast('warn', 'Image is too large', 'Beacon supports original images up to 2 GB.');
      return;
    }
    try {
      patch({ [field]: await fileToAttachment(file) });
    } catch (error) {
      toast('danger', 'Could not save this image', error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Your profile"
      description="Everything here is yours, and all of it is free."
      width="xxl"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeDialog}
            className="h-8 rounded-md px-3 text-[13px] text-ink-dim hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="h-8 rounded-md bg-accent px-3.5 text-[13px] font-medium text-accent-ink hover:brightness-110"
          >
            Save profile
          </button>
        </div>
      }
    >
      <div className="grid max-h-[72vh] gap-8 overflow-y-auto p-1 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Field label="Display name" hint="What people see. Change it as often as you like.">
            <Input
              value={draft.displayName ?? ''}
              maxLength={32}
              placeholder={draft.username}
              onChange={(e) => patch({ displayName: e.target.value })}
            />
          </Field>

          <Field label="Username" hint="Your permanent handle. Letters, numbers, underscores.">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[13px] text-ink-mute">@</span>
              <Input
                value={draft.username}
                maxLength={24}
                onChange={(e) => patch({ username: e.target.value })}
              />
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pronouns">
              <Input
                value={draft.pronouns ?? ''}
                maxLength={16}
                placeholder="they/them"
                onChange={(e) => patch({ pronouns: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Input
                value={draft.customStatus}
                maxLength={48}
                placeholder="Building something"
                onChange={(e) => patch({ customStatus: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Bio" hint="Up to 190 characters.">
            <TextArea
              rows={3}
              value={draft.bio ?? ''}
              maxLength={190}
              placeholder="A line or two about you."
              onChange={(e) => patch({ bio: e.target.value })}
            />
          </Field>

        </div>

        {/* Live card. Nothing is saved until you say so. */}
        <div className="md:sticky md:top-0">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.04em] text-ink-mute">Live preview</p>
          <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(event) => { void selectImage(event.target.files?.[0], 'avatar'); event.target.value = ''; }} />
          <input ref={bannerInput} type="file" accept="image/*" hidden onChange={(event) => { void selectImage(event.target.files?.[0], 'banner'); event.target.value = ''; }} />
          <EditableProfilePreview user={draft} onAvatar={() => avatarInput.current?.click()} onBanner={() => bannerInput.current?.click()} />
        </div>
      </div>
    </Modal>
  );
}

function EditableProfilePreview({ user, onAvatar, onBanner }: { user: AppUser; onAvatar: () => void; onBanner: () => void }) {
  const bannerUrl = useAttachmentUrl(user.banner);
  const avatarUrl = useAttachmentUrl(user.avatar);
  return <div className="rounded-2xl border border-line bg-surface">
    <button type="button" onClick={onBanner} className="group relative block h-28 w-full overflow-hidden rounded-t-2xl bg-raised">
      {bannerUrl && <img src={bannerUrl} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100"><Pencil size={18} /></span>
    </button>
    <div className="relative z-10 px-4 pb-3 -mt-10"><button type="button" onClick={onAvatar} className="group relative block h-20 w-20 overflow-hidden rounded-full ring-4 ring-surface">
      <span className="grid h-full w-full place-items-center bg-raised text-[17px] font-bold" style={{ backgroundColor: user.avatarColor }}>{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : monogram(user.displayName || user.username)}</span>
      <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100"><Pencil size={17} /></span>
    </button></div>
    <div className="px-4 pb-4"><div className="text-[16px] font-semibold text-ink">{user.displayName || user.username}</div><div className="font-mono text-[11.5px] text-ink-mute">@{user.username}</div>{user.customStatus && <div className="mt-2 rounded-md bg-hover px-2 py-1.5 text-[12px] text-ink-dim">{user.customStatus}</div>}</div>
  </div>;
}

/** The card other people see — reused in the roster and on author clicks. */
export function ProfileCard({ user }: { user: AppUser }) {
  const bannerColor = user.bannerFrom ?? 'var(--raised)';

  return (
    <div className="anim-in rounded-2xl border border-line bg-surface">
      <ProfileBanner attachment={user.banner} color={bannerColor} />
      <div className="relative z-10 flex justify-between px-4 pb-3 -mt-10">
      <ProfileAvatar
          attachment={user.avatar}
          name={user.displayName || user.username}
          color={user.avatarColor}
          className={cx('h-20 w-20 shrink-0 ring-4 ring-surface', user.effect === 'ring' && 'ring-accent')}
        />
      </div>
      <div className="px-4 pb-4">
        <div className="mt-3 flex items-baseline gap-2">
          <span className="truncate text-[16px] font-semibold text-ink">
            {user.displayName || user.username}
          </span>
          {user.pronouns && <span className="text-[11.5px] text-ink-mute">{user.pronouns}</span>}
        </div>
        <div className="font-mono text-[11.5px] text-ink-mute">@{user.username}</div>
        {user.customStatus && (
          <div className="mt-2 rounded-md bg-hover px-2 py-1.5 text-[12px] text-ink-dim">
            {user.customStatus}
          </div>
        )}
        {user.bio && (
          <p className="mt-2 text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-dim">{user.bio}</p>
        )}
      </div>
    </div>
  );
}

function ProfileBanner({
  attachment,
  color,
}: {
  attachment?: AppUser['banner'];
  color: string;
}) {
  const url = useAttachmentUrl(attachment);
  return (
    <div
      className="relative h-28 w-full overflow-hidden rounded-t-2xl bg-raised"
      style={{ backgroundColor: color }}
    >
      {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
    </div>
  );
}

function ProfileAvatar({
  attachment,
  name,
  color,
  className,
}: {
  attachment?: AppUser['avatar'];
  name: string;
  color: string;
  className?: string;
}) {
  const url = useAttachmentUrl(attachment);
  return (
    <div
      className={cx(
        'grid aspect-square place-items-center overflow-hidden rounded-full bg-raised text-[17px] font-bold text-canvas',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {url ? <img src={url} alt={name} className="block h-full w-full rounded-full object-cover" /> : monogram(name)}
    </div>
  );
}

/**
 * Someone else's card, opened from their name in the conversation. Built from
 * the roster when we know them, and from the message itself when we don't.
 */
export function PersonCard({
  userId,
  name,
  color,
}: {
  userId: string;
  name: string;
  color: string;
}) {
  const me = useAppStore((s) => s.appUser);
  const member = useAppStore((s) => s.members.find((m) => m.id === userId));
  const openDm = useAppStore((s) => s.openDm);

  if (userId === me.id) return <ProfileCard user={me} />;

  const user: AppUser = {
    id: userId,
    username: member?.username ?? name,
    displayName: name,
    customStatus: member?.customStatus ?? '',
    presence: member?.presence ?? 'offline',
    avatarColor: member?.avatarColor ?? color,
    bannerFrom: '#1c1f26',
    bannerTo: '#0a0b0d',
  };

  return (
    <div className="w-[262px]">
      <ProfileCard user={user} />
      <button
        type="button"
        onClick={() => openDm(userId, user.username)}
        className="mt-1.5 h-8 w-full rounded-md bg-raised text-[12.5px] text-ink-dim transition-colors hover:bg-hover hover:text-ink"
      >
        Send a message
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5">
        <span className="text-[12.5px] font-medium text-ink">{label}</span>
        {hint && <span className="ml-2 text-[11.5px] text-ink-mute">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
