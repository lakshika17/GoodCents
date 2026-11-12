// Pure PayPal Payouts helpers: payload building, status mapping, association validation.
// Client-safe and unit-tested; no credentials or network access here.

export const PAYPAL_SANDBOX_ORIGIN = 'https://api-m.sandbox.paypal.com';

export type PaymentBusinessStatus = 'authorized' | 'dispatching' | 'processing' | 'paid' | 'failed' | 'needs_reconciliation' | 'unclaimed';

export interface PayoutPayload {
  sender_batch_header: { sender_batch_id: string; email_subject: string; email_message: string; note: string };
  items: { recipient_type: 'EMAIL'; amount: { value: string; currency: string }; receiver: string; sender_item_id: string; note: string }[];
}

export const centsToValue = (cents: number): string => (cents / 100).toFixed(2);

export function buildPayoutPayload(input: { senderBatchId: string; senderItemId: string; receiver: string; amountCents: number; currency: string; note: string }): PayoutPayload {
  if (input.currency !== 'USD') throw new Error('Only USD sandbox payouts are supported in this milestone');
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('Positive integer amount required');
  return {
    sender_batch_header: {
      sender_batch_id: input.senderBatchId,
      email_subject: 'GoodCents sandbox reimbursement',
      email_message: 'Fictional sandbox payout from the GoodCents isolated test draft.',
      note: input.note,
    },
    items: [{ recipient_type: 'EMAIL', amount: { value: centsToValue(input.amountCents), currency: 'USD' }, receiver: input.receiver, sender_item_id: input.senderItemId, note: input.note }],
  };
}

/** Maps a raw provider transaction_status to a business status. Never treats PENDING/UNCLAIMED/ONHOLD as paid. */
export function mapItemStatus(transactionStatus: string): PaymentBusinessStatus {
  switch (transactionStatus) {
    case 'SUCCESS': return 'paid';
    case 'PENDING':
    case 'PROCESSING': return 'processing';
    case 'UNCLAIMED':
    case 'ONHOLD': return 'unclaimed';
    case 'RETURNED':
    case 'REFUNDED':
    case 'FAILED':
    case 'DENIED': return 'failed';
    default: return 'needs_reconciliation';
  }
}

export interface ItemEvidence {
  senderItemId: string | null;
  amountCents: number | null;
  currency: string | null;
  receiver: string | null;
}

/** Fields that must match the authorized intent before an item result can change state. */
export function validateItemAssociation(intent: { senderItemId: string; amountCents: number; currency: string; recipientEmail: string }, item: ItemEvidence): string[] {
  const mismatches: string[] = [];
  if (item.senderItemId !== intent.senderItemId) mismatches.push('sender_item_id');
  if (item.amountCents !== intent.amountCents) mismatches.push('amount');
  if (item.currency !== intent.currency) mismatches.push('currency');
  if ((item.receiver ?? '').toLowerCase() !== intent.recipientEmail.toLowerCase()) mismatches.push('receiver');
  return mismatches;
}

/**
 * Stale-response protection: paid is final (later RETURNED/REFUNDED is evidence only),
 * confirmed failure is terminal unless a fully validated SUCCESS arrives later.
 */
export function nextStatusAllowed(current: PaymentBusinessStatus, incoming: PaymentBusinessStatus): boolean {
  if (current === 'paid') return false;
  if (current === 'failed') return incoming === 'paid';
  return true;
}

/** Extracts the original payout batch id from a duplicate-batch error's HATEOAS link. */
export function extractDuplicateBatchId(errorBody: unknown): string | null {
  const links = (errorBody as { links?: { rel?: string; href?: string }[] } | null)?.links;
  if (!Array.isArray(links)) return null;
  for (const link of links) {
    const match = /\/v1\/payments\/payouts\/([A-Za-z0-9]+)/.exec(link.href ?? '');
    if (match) return match[1] ?? null;
  }
  return null;
}

export const isDuplicateBatchError = (errorBody: unknown): boolean =>
  (errorBody as { name?: string } | null)?.name === 'DUPLICATE_BATCH_ID' || extractDuplicateBatchId(errorBody) !== null;

/** Keeps only safe provider error fields for persistence. */
export function sanitizeProviderError(errorBody: unknown): { name: string; message: string } {
  const body = errorBody as { name?: string; message?: string } | null;
  return { name: String(body?.name ?? 'UNKNOWN').slice(0, 100), message: String(body?.message ?? 'No provider message').slice(0, 500) };
}
