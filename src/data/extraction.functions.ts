import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { TERMINAL_EXTRACTION_STATES, type ExtractionEnvelope } from '@/lib/extraction-types';

const input = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  base64: z.string().min(1).max(14_000_000),
});

type AuthContext = { supabase: any; userId: string };

/** Verified sign-in plus an active employee or assigned manager role. */
async function authorizeReading(context: AuthContext): Promise<string | null> {
  const { data: identity } = await context.supabase.auth.getUser();
  if (!identity.user?.email_confirmed_at) return 'Automatic reading requires a verified sign-in.';
  const { data: employee } = await context.supabase.rpc('current_employee');
  const { data: roles } = await context.supabase.from('user_roles').select('role');
  if (!employee || !roles?.some((r: { role: string }) => ['employee', 'manager'].includes(r.role))) return 'Automatic reading is not available for this account.';
  return null;
}

/** Reads an uploaded image document with AI. Signed-in verified employees and assigned managers only; results are suggestions the user must verify. */
export const readDocument = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const denied = await authorizeReading(context);
    if (denied) return { ok: false as const, error: denied };
    const { extractDocument } = await import('@/lib/document-extraction.server');
    return extractDocument(data);
  });

const startInput = z.object({
  submissionKey: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
});

type ExtractionState = {
  ok: boolean;
  requestId: string | null;
  envelope: ExtractionEnvelope | null;
  status: 'checking' | null;
  error: string | null;
  code: string | null;
};
const fail = (error: string, requestId: string | null = null, code: string | null = null): ExtractionState => ({ ok: false, requestId, envelope: null, status: null, error, code });
const state = (requestId: string, envelope: ExtractionEnvelope | null, status: 'checking' | null = null): ExtractionState => ({ ok: true, requestId, envelope, status, error: null, code: null });

/**
 * Starts (or reuses) the persisted extraction attempt for a document version.
 * The PDF must already be in private storage at {userId}/{submissionKey}; the exact stored bytes are forwarded.
 * Concurrent clicks, tabs and refreshes reuse the same attempt via the (owner, submission_key) constraint.
 */
export const startExtraction = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => startInput.parse(d))
  .handler(async ({ data, context }): Promise<ExtractionState> => {
    const denied = await authorizeReading(context);
    if (denied) return fail(denied);
    const storagePath = `${context.userId}/${data.submissionKey}`;
    const downloaded = await context.supabase.storage.from('private-receipts').download(storagePath);
    if (downloaded.error || !downloaded.data) return fail('Upload the document before reading it.');
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const begun = await supabaseAdmin.rpc('begin_extraction_trusted', {
      p_owner: context.userId,
      p_request_id: crypto.randomUUID(),
      p_submission_key: data.submissionKey,
      p_pdf_sha256: sha256,
    });
    if (begun.error) return fail(begun.error.message);
    const job = begun.data as { request_id: string; status: string; envelope: ExtractionEnvelope | null };
    if (job.envelope && (TERMINAL_EXTRACTION_STATES as readonly string[]).includes(job.status)) {
      return state(job.request_id, job.envelope);
    }
    const claim = await supabaseAdmin.rpc('claim_extraction_dispatch', { p_owner: context.userId, p_request_id: job.request_id });
    if (claim.error) return fail('Reading dispatch could not be confirmed; reopen this document to check its saved request.', job.request_id);
    if (claim.data !== true) return state(job.request_id, job.envelope, 'checking');
    const { postExtraction } = await import('@/lib/extraction-api.server');
    const result = await postExtraction(job.request_id, bytes, data.fileName);
    if (result.ok) {
      const saved = await supabaseAdmin.rpc('save_extraction_snapshot_trusted', { p_owner: context.userId, p_request_id: job.request_id, p_status: result.envelope.status, p_envelope: result.original });
      if (saved.error) return fail('Reading result could not be saved; check this request later.', job.request_id);
      return state(job.request_id, result.envelope);
    }
    if (result.kind === 'rejected') return fail(result.message, job.request_id, result.code);
    // Uncertain outcome: the persisted request is preserved and checked via polling, never blindly reposted.
    return state(job.request_id, null, 'checking');
  });

const statusInput = z.object({ requestId: z.string().uuid() });

/**
 * Proxied status check. Ownership is verified against the persisted job before every query —
 * knowing a UUID never grants access. A 404 keeps the existing request; it never spawns a replacement.
 */
export const getExtractionStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusInput.parse(d))
  .handler(async ({ data, context }): Promise<ExtractionState> => {
    const denied = await authorizeReading(context);
    if (denied) return fail(denied);
    const { data: job } = await context.supabase
      .from('extraction_jobs')
      .select('request_id,status,envelope')
      .eq('request_id', data.requestId)
      .maybeSingle();
    if (!job) return fail('Extraction request not found.');
    const row = job as { request_id: string; status: string; envelope: ExtractionEnvelope | null };
    if (row.envelope && (TERMINAL_EXTRACTION_STATES as readonly string[]).includes(row.status)) {
      return state(row.request_id, row.envelope);
    }
    const { getExtraction } = await import('@/lib/extraction-api.server');
    const result = await getExtraction(data.requestId);
    if (result.ok) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const saved = await supabaseAdmin.rpc('save_extraction_snapshot_trusted', { p_owner: context.userId, p_request_id: row.request_id, p_status: result.envelope.status, p_envelope: result.original });
      if (saved.error) return fail('Reading result could not be saved; check this request later.', row.request_id);
      return state(row.request_id, result.envelope);
    }
    if (result.kind === 'rejected') return fail(result.message, row.request_id, result.code);
    // not_found or uncertain: keep polling the same request.
    return state(row.request_id, null, 'checking');
  });
