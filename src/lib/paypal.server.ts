// Server-only PayPal Sandbox client. The API origin is hardcoded to the sandbox;
// callers can never supply an origin or enable live mode. Credentials come from
// server secrets and are read inside handlers, never at module scope.
import { PAYPAL_SANDBOX_ORIGIN, extractDuplicateBatchId, isDuplicateBatchError, sanitizeProviderError, type PayoutPayload } from './paypal';

const TIMEOUT_MS = 20_000;

export type DispatchOutcome =
  | { kind: 'accepted'; paypalBatchId: string; batchStatus: string | null }
  | { kind: 'duplicate'; paypalBatchId: string | null; batchStatus: string | null }
  | { kind: 'rejected'; errorName: string; errorMessage: string }
  | { kind: 'uncertain'; errorName: string; errorMessage: string };

export type StatusOutcome =
  | { kind: 'ok'; body: Record<string, unknown> }
  | { kind: 'rejected'; errorName: string; errorMessage: string }
  | { kind: 'uncertain'; errorName: string; errorMessage: string };

export function paypalConfigured(): boolean {
  return Boolean(process.env['PAYPAL_SANDBOX_CLIENT_ID'] && process.env['PAYPAL_SANDBOX_CLIENT_SECRET']);
}

export async function getAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const clientId = process.env['PAYPAL_SANDBOX_CLIENT_ID'];
  const clientSecret = process.env['PAYPAL_SANDBOX_CLIENT_SECRET'];
  if (!clientId || !clientSecret) return { ok: false, error: 'PayPal Sandbox credentials are not configured.' };
  try {
    const res = await fetch(`${PAYPAL_SANDBOX_ORIGIN}/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
    if (!res.ok || !body?.access_token) return { ok: false, error: `Provider authentication failed (${res.status}): ${body?.error_description ?? body?.error ?? 'no token'}` };
    return { ok: true, token: body.access_token };
  } catch (error) {
    return { ok: false, error: `Provider authentication unreachable: ${error instanceof Error ? error.message : 'network error'}` };
  }
}

/** Creates the payout batch once for the persisted identity. 5xx/timeouts are uncertain, never auto-retried with a new identity. */
export async function createPayout(token: string, payload: PayoutPayload, paypalRequestId: string): Promise<DispatchOutcome> {
  let res: Response;
  try {
    res = await fetch(`${PAYPAL_SANDBOX_ORIGIN}/v1/payments/payouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'PayPal-Request-Id': paypalRequestId },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: 'uncertain', errorName: 'NO_RESPONSE', errorMessage: error instanceof Error ? error.message : 'network error' };
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 201) {
    const header = body?.['batch_header'] as { payout_batch_id?: string; batch_status?: string } | undefined;
    if (!header?.payout_batch_id) return { kind: 'uncertain', errorName: 'MALFORMED_ACCEPTANCE', errorMessage: '201 without payout_batch_id' };
    return { kind: 'accepted', paypalBatchId: header.payout_batch_id, batchStatus: header.batch_status ?? null };
  }
  if (res.status >= 500) return { kind: 'uncertain', errorName: `HTTP_${res.status}`, errorMessage: 'Provider server error; same-identity recovery required' };
  if (res.status === 400 && isDuplicateBatchError(body)) {
    return { kind: 'duplicate', paypalBatchId: extractDuplicateBatchId(body), batchStatus: null };
  }
  const clean = sanitizeProviderError(body);
  return { kind: 'rejected', errorName: clean.name, errorMessage: clean.message };
}

export async function getPayoutBatch(token: string, batchId: string): Promise<StatusOutcome> {
  return getJson(`${PAYPAL_SANDBOX_ORIGIN}/v1/payments/payouts/${encodeURIComponent(batchId)}`, token);
}

export async function getPayoutItem(token: string, itemId: string): Promise<StatusOutcome> {
  return getJson(`${PAYPAL_SANDBOX_ORIGIN}/v1/payments/payouts-item/${encodeURIComponent(itemId)}`, token);
}

async function getJson(url: string, token: string): Promise<StatusOutcome> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    return { kind: 'uncertain', errorName: 'NO_RESPONSE', errorMessage: error instanceof Error ? error.message : 'network error' };
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && body) return { kind: 'ok', body };
  if (res.status >= 500) return { kind: 'uncertain', errorName: `HTTP_${res.status}`, errorMessage: 'Provider server error' };
  const clean = sanitizeProviderError(body);
  return { kind: 'rejected', errorName: clean.name, errorMessage: clean.message };
}
