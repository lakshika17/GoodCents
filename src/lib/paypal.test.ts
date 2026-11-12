import { describe, expect, it } from 'vitest';
import { buildPayoutPayload, centsToValue, extractDuplicateBatchId, isDuplicateBatchError, mapItemStatus, nextStatusAllowed, sanitizeProviderError, validateItemAssociation } from './paypal';

describe('buildPayoutPayload', () => {
  it('builds a one-item USD payout with exact decimal value', () => {
    const p = buildPayoutPayload({ senderBatchId: 'qb-rb-1', senderItemId: 'qb-rb-1-item', receiver: 'sb-a@personal.example.com', amountCents: 31238, currency: 'USD', note: 'Sandbox reimbursement rb-1' });
    expect(p.sender_batch_header.sender_batch_id).toBe('qb-rb-1');
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ recipient_type: 'EMAIL', receiver: 'sb-a@personal.example.com', sender_item_id: 'qb-rb-1-item' });
    expect(p.items[0]?.amount).toEqual({ value: '312.38', currency: 'USD' });
  });
  it('rejects non-USD currencies explicitly', () => {
    expect(() => buildPayoutPayload({ senderBatchId: 'b', senderItemId: 'i', receiver: 'r', amountCents: 100, currency: 'EUR', note: '' })).toThrow(/USD/);
  });
  it('rejects non-positive or fractional amounts', () => {
    expect(() => buildPayoutPayload({ senderBatchId: 'b', senderItemId: 'i', receiver: 'r', amountCents: 0, currency: 'USD', note: '' })).toThrow();
    expect(() => buildPayoutPayload({ senderBatchId: 'b', senderItemId: 'i', receiver: 'r', amountCents: 10.5, currency: 'USD', note: '' })).toThrow();
  });
  it('formats cents exactly', () => {
    expect(centsToValue(1)).toBe('0.01');
    expect(centsToValue(100)).toBe('1.00');
    expect(centsToValue(1011)).toBe('10.11');
  });
});

describe('mapItemStatus', () => {
  it('maps only SUCCESS to paid', () => {
    expect(mapItemStatus('SUCCESS')).toBe('paid');
    expect(mapItemStatus('PENDING')).toBe('processing');
    expect(mapItemStatus('PROCESSING')).toBe('processing');
    expect(mapItemStatus('UNCLAIMED')).toBe('unclaimed');
    expect(mapItemStatus('ONHOLD')).toBe('unclaimed');
    expect(mapItemStatus('RETURNED')).toBe('failed');
    expect(mapItemStatus('REFUNDED')).toBe('failed');
    expect(mapItemStatus('FAILED')).toBe('failed');
    expect(mapItemStatus('DENIED')).toBe('failed');
    expect(mapItemStatus('SOMETHING_NEW')).toBe('needs_reconciliation');
  });
});

describe('validateItemAssociation', () => {
  const intent = { senderItemId: 'qb-rb-1-item', amountCents: 31238, currency: 'USD', recipientEmail: 'sb-a@personal.example.com' };
  const good = { senderItemId: 'qb-rb-1-item', amountCents: 31238, currency: 'USD', receiver: 'SB-A@personal.example.com' };
  it('accepts a matching item (receiver case-insensitive)', () => {
    expect(validateItemAssociation(intent, good)).toEqual([]);
  });
  it('flags forged amount, currency, receiver and item id', () => {
    expect(validateItemAssociation(intent, { ...good, amountCents: 1 })).toEqual(['amount']);
    expect(validateItemAssociation(intent, { ...good, currency: 'EUR' })).toEqual(['currency']);
    expect(validateItemAssociation(intent, { ...good, receiver: 'attacker@example.com' })).toEqual(['receiver']);
    expect(validateItemAssociation(intent, { ...good, senderItemId: 'other' })).toEqual(['sender_item_id']);
  });
});

describe('nextStatusAllowed (stale-response protection)', () => {
  it('paid is final; later statuses never reopen it', () => {
    expect(nextStatusAllowed('paid', 'processing')).toBe(false);
    expect(nextStatusAllowed('paid', 'failed')).toBe(false);
    expect(nextStatusAllowed('paid', 'paid')).toBe(false);
  });
  it('confirmed failure is terminal except a validated later success', () => {
    expect(nextStatusAllowed('failed', 'processing')).toBe(false);
    expect(nextStatusAllowed('failed', 'paid')).toBe(true);
  });
  it('in-flight states accept newer results', () => {
    expect(nextStatusAllowed('processing', 'paid')).toBe(true);
    expect(nextStatusAllowed('needs_reconciliation', 'paid')).toBe(true);
    expect(nextStatusAllowed('unclaimed', 'failed')).toBe(true);
  });
});

describe('duplicate-batch recovery', () => {
  const dup = { name: 'DUPLICATE_BATCH_ID', message: 'A payout with this sender_batch_id already exists', links: [{ rel: 'self', href: 'https://api-m.sandbox.paypal.com/v1/payments/payouts/ABC123XYZ' }] };
  it('recovers the original payout reference from the HATEOAS link', () => {
    expect(isDuplicateBatchError(dup)).toBe(true);
    expect(extractDuplicateBatchId(dup)).toBe('ABC123XYZ');
  });
  it('does not treat unrelated errors as duplicates', () => {
    expect(isDuplicateBatchError({ name: 'INSUFFICIENT_FUNDS' })).toBe(false);
    expect(extractDuplicateBatchId({ name: 'INSUFFICIENT_FUNDS' })).toBeNull();
  });
});

describe('sanitizeProviderError', () => {
  it('keeps only name and message, bounded', () => {
    expect(sanitizeProviderError({ name: 'RECEIVER_UNREGISTERED', message: 'x', debug_id: 'secret-internal-id', information_link: 'https://x' })).toEqual({ name: 'RECEIVER_UNREGISTERED', message: 'x' });
    expect(sanitizeProviderError(null)).toEqual({ name: 'UNKNOWN', message: 'No provider message' });
  });
});
