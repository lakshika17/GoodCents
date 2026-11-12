// Public sample-data demo: sends a real PayPal *Sandbox* payout (fake money).
// The receiver comes only from the DEMO_PAYPAL_RECEIVER_EMAIL server secret, never
// from the browser, and the amount is capped. No database or company records involved.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const input = z.object({
  reimbursementId: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),
  amountCents: z.number().int().positive().max(100_000),
  employeeName: z.string().trim().max(80),
});

export const sendDemoSandboxPayout = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => {
    const { getAccessToken, createPayout } = await import('@/lib/paypal.server');
    const { buildPayoutPayload } = await import('@/lib/paypal');
    const receiver = process.env['DEMO_PAYPAL_RECEIVER_EMAIL'];
    if (!receiver) return { ok: false as const, error: 'Demo sandbox receiver email is not configured (DEMO_PAYPAL_RECEIVER_EMAIL).' };
    const token = await getAccessToken();
    if (!token.ok) return { ok: false as const, error: token.error };
    const batchId = `demo-${data.reimbursementId}-${Date.now()}`.slice(0, 120);
    const payload = buildPayoutPayload({ senderBatchId: batchId, senderItemId: data.reimbursementId, receiver, amountCents: data.amountCents, currency: 'USD', note: `GoodCents demo reimbursement for ${data.employeeName || 'employee'}` });
    const out = await createPayout(token.token, payload, crypto.randomUUID());
    if (out.kind === 'accepted' || out.kind === 'duplicate') return { ok: true as const, batchId: out.paypalBatchId ?? batchId, receiver };
    return { ok: false as const, error: `${out.errorName}: ${out.errorMessage}` };
  });
