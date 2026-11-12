import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const id = z.string().trim().min(1).max(120);

export interface PaymentIntentView {
  id: string;
  reimbursementId: string;
  status: string;
  amountCents: number;
  currency: string;
  sourceRevision: number;
  recipientEmail: string;
  senderBatchId: string;
  paypalBatchId: string | null;
  payoutItemId: string | null;
  transactionId: string | null;
  providerStatus: string | null;
}

type AuthContext = { supabase: any; userId: string };

const toView = (row: any): PaymentIntentView => ({
  id: row.id,
  reimbursementId: row.reimbursement_id,
  status: row.status,
  amountCents: Number(row.amount_cents),
  currency: row.currency,
  sourceRevision: Number(row.source_revision),
  recipientEmail: row.recipient_email,
  senderBatchId: row.sender_batch_id,
  paypalBatchId: row.paypal_batch_id ?? null,
  payoutItemId: row.payout_item_id ?? null,
  transactionId: row.transaction_id ?? null,
  providerStatus: row.provider_status ?? null,
});

type PaymentResult =
  | { ok: true; intent: PaymentIntentView; dispatch: 'sent' | 'already_claimed' | 'not_configured' | 'recovered' | 'checked' }
  | { ok: false; error: string; intent: PaymentIntentView | null };

const fail = (error: string, intent: PaymentIntentView | null = null): PaymentResult => ({ ok: false, error, intent });

/**
 * Finance-only explicit authorization. The server atomically rechecks role, approved revision,
 * amount, currency and recipient, persists the immutable payload, then performs the single
 * sandbox dispatch for the persisted identity. Repeated calls reuse the existing intent.
 */
export const authorizePayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reimbursementId: id, expectedRevision: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<PaymentResult> => {
    const authorized = await context.supabase.rpc('authorize_reimbursement_payment', { _reimbursement: data.reimbursementId, _expected_revision: data.expectedRevision });
    if (authorized.error) return fail(authorized.error.message);
    const intent = toView(authorized.data);

    const { paypalConfigured, getAccessToken, createPayout } = await import('@/lib/paypal.server');
    if (!paypalConfigured()) return { ok: true, intent, dispatch: 'not_configured' };

    const claim = await context.supabase.rpc('claim_payment_dispatch', { _intent: intent.id });
    if (claim.error) return fail(claim.error.message, intent);
    if (claim.data !== true) return { ok: true, intent, dispatch: 'already_claimed' };

    const token = await getAccessToken();
    if (!token.ok) {
      await recordDispatch(context, intent.id, { kind: 'uncertain', errorName: 'AUTH_FAILED', errorMessage: token.error });
      return fail(`Provider authentication failed. Payment outcome needs reconciliation.`, intent);
    }
    const outcome = await createPayout(token.token, (authorized.data as { payload: never }).payload, (authorized.data as { paypal_request_id: string }).paypal_request_id);
    await recordDispatch(context, intent.id, outcome);
    const refreshed = await loadIntent(context, intent.id);
    if (outcome.kind === 'rejected') return fail(`Provider rejected the payout: ${outcome.errorName}`, refreshed ?? intent);
    return { ok: true, intent: refreshed ?? intent, dispatch: outcome.kind === 'duplicate' ? 'recovered' : 'sent' };
  });

async function recordDispatch(context: AuthContext, intentId: string, outcome: { kind: string;[k: string]: unknown }) {
  const recorded = await context.supabase.rpc('record_payment_dispatch', { _intent: intentId, _outcome: outcome });
  if (recorded.error) throw new Error(recorded.error.message);
}

async function loadIntent(context: AuthContext, intentId: string): Promise<PaymentIntentView | null> {
  const { data } = await context.supabase.from('payment_intents').select('*').eq('id', intentId).maybeSingle();
  return data ? toView(data) : null;
}

/**
 * Reconciles the individual payout item result. Finance and the reimbursed employee may check.
 * Never marks paid from batch acceptance alone; the item's SUCCESS with validated association is required.
 * Uncertain outcomes keep the same identity; finance may trigger controlled same-identity recovery.
 */
export const checkPaymentStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reimbursementId: id }).parse(d))
  .handler(async ({ data, context }): Promise<PaymentResult> => {
    const { data: row, error } = await context.supabase.from('payment_intents').select('*').eq('reimbursement_id', data.reimbursementId).maybeSingle();
    if (error) return fail(error.message);
    if (!row) return fail('No payment intent exists for this reimbursement yet.');
    const intent = toView(row);
    if (intent.status === 'paid' || intent.status === 'failed') return { ok: true, intent, dispatch: 'checked' };

    const { paypalConfigured, getAccessToken, getPayoutBatch, getPayoutItem, createPayout } = await import('@/lib/paypal.server');
    if (!paypalConfigured()) return fail('PayPal Sandbox credentials are not configured.', intent);
    const token = await getAccessToken();
    if (!token.ok) return fail(`Provider authentication failed: ${token.error}`, intent);

    // No batch reference yet: the dispatch response was lost. Controlled same-identity recovery —
    // re-POST the identical payload with the same sender_batch_id and PayPal-Request-Id (finance only).
    if (!intent.paypalBatchId) {
      if (row.status !== 'needs_reconciliation' && row.status !== 'dispatching') return { ok: true, intent, dispatch: 'checked' };
      const { data: isFinance } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'finance' });
      if (!isFinance) return fail('Payment outcome needs reconciliation by Finance.', intent);
      const outcome = await createPayout(token.token, row.payload as unknown as import('@/lib/paypal').PayoutPayload, row.paypal_request_id);
      await recordDispatch(context, intent.id, outcome);
      const refreshed = await loadIntent(context, intent.id);
      if (!refreshed?.paypalBatchId) return fail('Payment outcome still needs reconciliation; the original identity is preserved.', refreshed ?? intent);
      return { ok: true, intent: refreshed, dispatch: 'recovered' };
    }

    const batch = await getPayoutBatch(token.token, intent.paypalBatchId);
    if (batch.kind !== 'ok') return fail(`Status check failed: ${batch.errorName}`, intent);
    const items = (batch.body['items'] as Record<string, unknown>[] | undefined) ?? [];
    const itemRef = items.find((i) => i['sender_item_id'] === intent.senderBatchId + '-item') ?? items[0];
    const itemId = (itemRef?.['payout_item_id'] as string | undefined) ?? intent.payoutItemId;
    if (!itemId) return fail('The payout item is not available yet; try again shortly.', intent);

    const item = await getPayoutItem(token.token, itemId);
    if (item.kind !== 'ok') return fail(`Item status check failed: ${item.errorName}`, intent);
    const payoutItem = (item.body['payout_item'] ?? {}) as Record<string, unknown>;
    const amount = (payoutItem['amount'] ?? {}) as Record<string, unknown>;
    const result = {
      transactionStatus: String(item.body['transaction_status'] ?? 'UNKNOWN'),
      payoutItemId: String(item.body['payout_item_id'] ?? itemId),
      transactionId: (item.body['transaction_id'] as string | undefined) ?? null,
      payoutBatchId: (item.body['payout_batch_id'] as string | undefined) ?? intent.paypalBatchId,
      senderItemId: (payoutItem['sender_item_id'] as string | undefined) ?? null,
      amountCents: amount['value'] != null ? Math.round(Number(amount['value']) * 100) : null,
      currency: (amount['currency'] as string | undefined) ?? null,
      receiver: (payoutItem['receiver'] as string | undefined) ?? null,
    };
    const recorded = await context.supabase.rpc('record_payment_status', { _intent: intent.id, _result: result });
    if (recorded.error) return fail(recorded.error.message, intent);
    const refreshed = await loadIntent(context, intent.id);
    return { ok: true, intent: refreshed ?? intent, dispatch: 'checked' };
  });
