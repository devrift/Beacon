import { useState } from 'react';
import { KeyRound, Link2, Mail, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { IS_SUPABASE_CONFIGURED } from '../supabase';
import { Button, FieldLabel, Input } from '../ui/primitives';
import { Modal } from '../ui/overlays';

type Method = 'email' | 'username';

export function AuthModal({ mode = 'primary', onComplete }: { mode?: 'primary' | 'append'; onComplete?: () => void }) {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const guest = useAuthStore((s) => s.guest);
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithUsername = useAuthStore((s) => s.signInWithUsername);
  const signUpWithUsername = useAuthStore((s) => s.signUpWithUsername);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const [method, setMethod] = useState<Method>('email');
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [projectUrl, setProjectUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');

  const append = mode === 'append';
  if (!ready || guest || (user && !append)) return null;

  function saveConnection() {
    try {
      const parsed = new URL(projectUrl.trim());
      if (!/^https?:$/.test(parsed.protocol) || anonKey.trim().length < 20) {
        setError('Enter a valid project URL and anon key.');
        return;
      }
      window.localStorage.setItem('beacon_custom_supabase_url', projectUrl.trim());
      window.localStorage.setItem('beacon_custom_supabase_key', anonKey.trim());
      window.location.reload();
    } catch {
      setError('Enter a valid project URL and anon key.');
    }
  }

  async function run(action: () => Promise<Error | null>) {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (result) setError(result.message);
      else onComplete?.();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    void run(() => {
      if (method === 'username') return create ? signUpWithUsername(username, password) : signInWithUsername(username, password);
      return create ? signUp(email, password, username || undefined) : signIn(email, password);
    });
  }

  if (!IS_SUPABASE_CONFIGURED) {
    return (
      <Modal open onClose={() => undefined} dismissable={false} width="sm" title="Connect Supabase" description="Add a project to enable cloud accounts and sync.">
        <FieldLabel>Supabase project URL</FieldLabel>
        <Input value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)} placeholder="https://project.supabase.co" />
        <div className="mt-4">
          <FieldLabel>Anon key</FieldLabel>
          <Input value={anonKey} type="password" onChange={(e) => setAnonKey(e.target.value)} placeholder="sb_publishable_..." />
        </div>
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
        <Button variant="accent" block size="lg" className="mt-5" onClick={saveConnection}>
          <Link2 size={15} /> Save and connect
        </Button>
        <button type="button" onClick={continueAsGuest} className="mt-3 w-full text-[12px] text-ink-mute hover:text-ink-dim">Continue in offline mode</button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={append ? onComplete ?? (() => undefined) : () => undefined} dismissable={append} width="sm" title={append ? 'Add account' : 'Welcome to Beacon'} description="Sign in to keep your communities and messages in sync.">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-canvas p-1">
        <AuthTab active={method === 'email'} onClick={() => setMethod('email')} icon={<Mail size={14} />} label="Email" />
        <AuthTab active={method === 'username'} onClick={() => setMethod('username')} icon={<UserRound size={14} />} label="Username" />
      </div>

      {method === 'email' && (
        <>
          <FieldLabel>Email</FieldLabel>
          <Input value={email} type="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </>
      )}
      {method === 'username' && (
        <>
          <FieldLabel>Username</FieldLabel>
          <Input value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} placeholder="your_handle" />
        </>
      )}
      <div className="mt-4">
        <FieldLabel>Password</FieldLabel>
        <Input value={password} type="password" autoComplete={create ? 'new-password' : 'current-password'} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
      </div>

      {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      <Button variant="accent" block size="lg" className="mt-5" disabled={busy} onClick={submit}>
        <KeyRound size={15} />
        {busy ? 'Please wait' : create ? 'Create account' : 'Log in'}
      </Button>
      <button type="button" onClick={() => setCreate((value) => !value)} className="mt-3 w-full text-[12px] text-ink-mute hover:text-ink-dim">{create ? 'Already have an account? Log in' : 'New here? Create an account'}</button>
      <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="text-[11px] text-ink-mute">or</span><span className="h-px flex-1 bg-line" /></div>
      <Button variant="solid" block onClick={() => void run(signInWithGoogle)}>Continue with Google</Button>
      {!append && <button type="button" onClick={continueAsGuest} className="mt-3 w-full text-[12px] text-ink-mute hover:text-ink-dim">Continue as local guest</button>}
    </Modal>
  );
}

function AuthTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-[12px] ${active ? 'bg-raised text-ink' : 'text-ink-mute hover:text-ink-dim'}`}>{icon}{label}</button>;
}
