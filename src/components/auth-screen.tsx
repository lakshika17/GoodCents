import { useState } from 'react';
import { useRouter, useNavigate } from '@tanstack/react-router';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import '@lovable.dev/cloud-auth-js/styles.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const navigate = useNavigate();
  const signIn = async () => {
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage(error.message);
    else { await router.invalidate(); await navigate({ to: '/' }); }
  };
  const social = async (provider: 'google' | 'lovable') => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) setMessage(result.error.message);
    else if (!result.redirected) await router.invalidate();
  };
  return <main className="grid min-h-screen place-items-center bg-background px-4">
    <div className="w-full max-w-sm space-y-6">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><h1 className="font-display text-2xl font-semibold">AI CFO</h1><p className="text-sm text-muted-foreground">Quantera Analytical</p></div></div>
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><LockKeyhole className="h-4 w-4" />Employee sign in</h2><p className="mt-1 text-sm text-muted-foreground">Invited Quantera employees only.</p></div>
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void signIn(); }}>
        <Field label="Work email"><Input type="email" autoComplete="username" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={e => setPassword(e.target.value)} /></Field>
        {message && <p role="status" className="text-sm text-destructive">{message}</p>}
        <Button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</Button>
        <Button variant="ghost" type="button" disabled={!email || busy} onClick={async () => { const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }); setMessage(error ? error.message : 'If your account exists, a reset link has been sent.'); }}>Forgot password?</Button>
      </form>
      <div className="grid gap-2"><Button variant="outline" onClick={() => void social('google')}>Sign in with Google</Button><Button className="lovable-auth-button" onClick={() => void social('lovable')}>Sign in with Lovable</Button></div>
      <Button variant="link" className="w-full" onClick={() => void navigate({ to: '/demo' })}>Open fictional hackathon demo</Button>
    </div>
  </main>;
}