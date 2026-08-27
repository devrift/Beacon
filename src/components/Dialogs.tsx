import { useRef, useState } from 'react';
import { Hash, ImagePlus, Plus, Volume2, X } from 'lucide-react';
import { cx } from '../lib/cx';
import { uid } from '../lib/id';
import { fileToAttachment } from '../lib/upload';
import { useAttachmentUrl } from '../hooks/useObjectUrl';
import { useAppStore, type Attachment, type ChannelType } from '../store/useAppStore';
import { Button, FieldLabel, Input, Kbd, Segmented, TextArea } from '../ui/primitives';
import { Modal } from '../ui/overlays';

const SERVER_ACCENTS = ['#7c5cfc', '#3ecf8e', '#f0b940', '#e04848'];

export function CreateServerDialog() {
  const open = useAppStore((s) => s.dialog === 'createServer');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const createServer = useAppStore((s) => s.createServer);
  const toast = useAppStore((s) => s.toast);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SERVER_ACCENTS[0]);
  const [icon, setIcon] = useState<Attachment>();
  const [banner, setBanner] = useState<Attachment>();

  function submit() {
    if (!name.trim()) return;
    const { server } = createServer(name, {
      icon_color: color,
      description: description.trim() || undefined,
      icon,
      banner,
    });
    toast('ok', `${server.name} created`, `Invite code ${server.invite_code}`);
    setName('');
    setDescription('');
    setIcon(undefined);
    setBanner(undefined);
    closeDialog();
  }

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Create a server"
      description="Set the look once. General is created automatically."
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!name.trim()}>
            Create server
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_190px]">
        <div>
          <FieldLabel>Server name</FieldLabel>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Study group"
            maxLength={60}
          />
          <div className="mt-4">
            <FieldLabel>Description <span className="font-normal text-ink-mute">optional</span></FieldLabel>
            <TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What brings people together here?"
              maxLength={120}
            />
          </div>
          <div className="mt-4">
            <FieldLabel>Accent</FieldLabel>
            <div className="flex gap-2">
              {SERVER_ACCENTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  aria-label={`Use ${value}`}
                  className={cx(
                    'h-8 w-8 rounded-full border-2 border-transparent transition-transform hover:scale-105',
                    color === value && 'border-ink ring-2 ring-surface',
                  )}
                  style={{ backgroundColor: value }}
                />
              ))}
            </div>
          </div>
        </div>
        <ServerAssetPicker label="Server icon" attachment={icon} onChange={setIcon} round />
      </div>
      <div className="mt-5">
        <ServerAssetPicker label="Server banner" attachment={banner} onChange={setBanner} wide />
      </div>
    </Modal>
  );
}

function ServerAssetPicker({
  label,
  attachment,
  onChange,
  round = false,
  wide = false,
}: {
  label: string;
  attachment?: Attachment;
  onChange: (attachment: Attachment | undefined) => void;
  round?: boolean;
  wide?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useAppStore((s) => s.toast);
  const url = useAttachmentUrl(attachment);

  async function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('warn', 'Choose an image file');
      return;
    }
    try {
      onChange(await fileToAttachment(file));
    } catch (error) {
      toast('danger', 'Could not save this image', error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cx(
          'group relative grid w-full place-items-center overflow-hidden border border-dashed border-line bg-canvas text-ink-mute hover:border-line-strong hover:text-ink-dim',
          round ? 'aspect-square rounded-full' : 'h-24 rounded-xl',
          wide && 'h-28',
        )}
      >
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="flex items-center gap-1.5 text-[12px]"><ImagePlus size={15} /> Upload</span>}
      </button>
      {attachment && <button type="button" onClick={() => onChange(undefined)} className="mt-1.5 text-[11.5px] text-ink-mute hover:text-danger">Remove</button>}
    </div>
  );
}

export function CreateChannelDialog() {
  const open = useAppStore((s) => s.dialog === 'createChannel');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const createChannel = useAppStore((s) => s.createChannel);
  const toast = useAppStore((s) => s.toast);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState<ChannelType>('TEXT');

  function submit() {
    if (!name.trim()) return;
    const channel = createChannel(name, type, topic);
    if (channel) toast('ok', `#${channel.name} created`);
    setName('');
    setTopic('');
    closeDialog();
  }

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Create a channel"
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!name.trim()}>
            Create channel
          </Button>
        </>
      }
    >
      <FieldLabel>Type</FieldLabel>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(
          [
            { value: 'TEXT' as const, icon: <Hash size={15} />, label: 'Text', help: 'Messages, files, polls' },
            { value: 'VOICE' as const, icon: <Volume2 size={15} />, label: 'Voice', help: 'Talk in real time' },
          ]
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={cx(
              'rounded-md border p-3 text-left transition-colors',
              type === option.value ? 'border-accent bg-accent/8' : 'border-line hover:border-line-strong',
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
              {option.icon}
              {option.label}
            </span>
            <span className="mt-1 block text-[11.5px] text-ink-mute">{option.help}</span>
          </button>
        ))}
      </div>

      <FieldLabel>Name</FieldLabel>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={type === 'TEXT' ? 'announcements' : 'Lounge'}
        maxLength={40}
      />
      {type === 'TEXT' && (
        <>
          <div className="mt-4">
            <FieldLabel>Topic (optional)</FieldLabel>
          </div>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What belongs here"
            maxLength={200}
          />
        </>
      )}
    </Modal>
  );
}

export function JoinServerDialog() {
  const open = useAppStore((s) => s.dialog === 'joinServer');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const joinServerByCode = useAppStore((s) => s.joinServerByCode);
  const toast = useAppStore((s) => s.toast);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function submit() {
    const found = joinServerByCode(code);
    if (!found) {
      setError('No server on this device has that code.');
      return;
    }
    toast('ok', `Opened ${found.name}`);
    setCode('');
    setError('');
    closeDialog();
  }

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Join a server"
      description="Paste an invite code to open that server."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!code.trim()}>
            Join
          </Button>
        </>
      }
    >
      <FieldLabel>Invite code</FieldLabel>
      <Input
        autoFocus
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase());
          setError('');
        }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="7 characters"
        maxLength={12}
        invalid={Boolean(error)}
        className="font-mono tracking-[0.14em]"
      />
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Modal>
  );
}

export function PollDialog() {
  const open = useAppStore((s) => s.dialog === 'poll');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const addMessage = useAppStore((s) => s.addMessage);
  const channelId = useAppStore((s) => s.activeChannelId);
  const me = useAppStore((s) => s.appUser);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);

  const valid = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  function submit() {
    if (!valid || !channelId) return;
    addMessage({
      id: uid('m'),
      channel_id: channelId,
      author_id: me.id,
      author_name: me.username,
      author_color: me.avatarColor,
      content: '',
      created_at: new Date().toISOString(),
      poll: {
        question: question.trim(),
        multiple,
        closed: false,
        options: options
          .filter((o) => o.trim())
          .map((label) => ({ id: uid('o'), label: label.trim(), votes: [] })),
      },
    });
    setQuestion('');
    setOptions(['', '']);
    setMultiple(false);
    closeDialog();
  }

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Create a poll"
      description="Results stay hidden until someone votes."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!valid}>
            Post poll
          </Button>
        </>
      }
    >
      <FieldLabel>Question</FieldLabel>
      <TextArea
        autoFocus
        rows={2}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What should we do?"
        maxLength={200}
      />

      <div className="mt-4">
        <FieldLabel>Options</FieldLabel>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
              placeholder={`Option ${i + 1}`}
              maxLength={80}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                aria-label={`Remove option ${i + 1}`}
                className="shrink-0 text-ink-mute hover:text-danger"
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && (
        <button
          type="button"
          onClick={() => setOptions([...options, ''])}
          className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline"
        >
          <Plus size={13} /> Add option
        </button>
      )}

      <div className="mt-4">
        <Segmented
          label="Voting"
          value={multiple ? 'multi' : 'single'}
          onChange={(v) => setMultiple(v === 'multi')}
          options={[
            { value: 'single', label: 'Pick one' },
            { value: 'multi', label: 'Pick many' },
          ]}
        />
      </div>
    </Modal>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Ctrl', 'K'], label: 'Command palette — jump anywhere, run anything' },
  { keys: ['Ctrl', 'F'], label: 'Search messages' },
  { keys: ['Ctrl', 'T'], label: 'Open Appearance' },
  { keys: ['Ctrl', ','], label: 'Open settings' },
  { keys: ['Ctrl', '/'], label: 'This shortcut list' },
  { keys: ['Alt', '↑ ↓'], label: 'Previous / next channel' },
  { keys: ['Enter'], label: 'Send message' },
  { keys: ['Shift', 'Enter'], label: 'New line' },
  { keys: ['Esc'], label: 'Close what is open, or cancel a reply' },
];

export function ShortcutsDialog() {
  const open = useAppStore((s) => s.dialog === 'shortcuts');
  const closeDialog = useAppStore((s) => s.closeDialog);

  return (
    <Modal open={open} onClose={closeDialog} title="Keyboard shortcuts" width="md">
      <div className="flex flex-col">
        {SHORTCUTS.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-6 border-b border-line py-2.5 last:border-0">
            <span className="text-[13px] text-ink-dim">{row.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
