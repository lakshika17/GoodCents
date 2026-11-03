import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared';
import { pageHead } from '@/lib/meta';
export const Route = createFileRoute('/reset-password')({ head: pageHead('Set Password','Set or recover your invited Quantera employee password.'), component: ResetPassword });
function ResetPassword() {
  const [valid, setValid] = useState(false); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const navigate = useNavigate();
  useEffect(() => { const hash = new URLSearchParams(window.location.hash.slice(1)); const type = hash.get('type'); setValid(type === 'recovery' || type === 'invite'); }, []);
  return <main className="grid min-h-screen place-items-center bg-background px-4"><form className="grid w-full max-w-sm gap-4" onSubmit={async e => { e.preventDefault(); if (!valid) return; const { error } = await supabase.auth.updateUser({ password }); if (error) setMessage(error.message); else { setMessage('Password updated.'); await navigate({ to: '/', replace: true }); } }}><h1 className="text-2xl font-semibold">Set your password</h1>{valid ? <><Field label="New password"><Input type="password" autoComplete="new-password" minLength={8} maxLength={200} required value={password} onChange={e => setPassword(e.target.value)} /></Field><Button type="submit">Save password</Button></> : <p className="text-sm text-muted-foreground">Open the password reset or invitation link from your email.</p>}{message && <p role="status">{message}</p>}</form></main>;
}