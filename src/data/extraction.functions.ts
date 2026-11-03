import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const input = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  base64: z.string().min(1).max(14_000_000),
});

/** Reads an uploaded document with AI. Signed-in verified employees or development Admins only; results are suggestions the user must verify. */
export const readDocument = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: identity } = await context.supabase.auth.getUser();
    if (!identity.user?.email_confirmed_at) return { ok: false as const, error: 'Automatic reading requires a verified sign-in.' };
    const { data: employee } = await context.supabase.rpc('current_employee');
    const { data: dev } = await context.supabase.from('developer_roles').select('role').eq('active', true).maybeSingle();
    if (!employee && dev?.role !== 'admin') return { ok: false as const, error: 'Automatic reading is not available for this account.' };
    const { extractDocument } = await import('@/lib/document-extraction.server');
    return extractDocument(data);
  });
