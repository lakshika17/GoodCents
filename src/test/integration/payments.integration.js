// Controlled payment-module checks against the isolated draft backend only. No PayPal calls.
const base = process.env['RECEIPT_BACKEND_URL'] ?? 'http://127.0.0.1:8001';
if (base !== 'http://127.0.0.1:8001') throw Error('Isolated local backend required');
const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const emails = { employee: 'employee-a', manager: 'approver', other: 'employee-b', finance: 'finance' };
const passwords = { employee: 'iK6dUY-m_hXM6DBljssG-HKoB4lcLWRf', manager: 'iK6dUY-m_hXM6DBljssG-HKoB4lcLWRf', other: 'iK6dUY-m_hXM6DBljssG-HKoB4lcLWRf', finance: 'fictional-finance-pass-2026' };
const tokens = {};
for (const role of Object.keys(emails)) {
  const r = await fetch(base + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emails[role] + '@receipt-test.invalid', password: passwords[role] }) });
  if (!r.ok) throw Error('Test sign-in failed: ' + role);
  tokens[role] = (await r.json()).access_token;
}
let checks = 0;
const ok = (v, n) => { if (!v) throw Error('FAIL: ' + n); console.log('PASS', n); checks++; };
async function req(role, path, body, method = body ? 'POST' : 'GET') {
  const r = await fetch(base + '/rest/v1/' + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + tokens[role], 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, data };
}
const reject = async (fn, n) => ok(!(await fn()).ok, n);
const rpc = (role, fn, args) => req(role, 'rpc/' + fn, args);

const A = 'rb-c80d9228-36f9-40a4-9c59-e091c110838b'; // 1011 cents, revision 1 — dispatch-outcome fixture
const B = 'rb-188562ca-70be-487a-a8a7-816f47b5a8b9'; // 1987 cents, revision 2 — status-recording fixture
const TARGET = 'rb-a0c2aeb1-d120-4d59-80a5-2fa70b855c59'; // designated real sandbox payout target — must stay awaiting_authorization

const totalsBefore = (await rpc('employee', 'shared_project_totals', {})).data;
const approvedBefore = (await req('employee', 'expenses?approval_status=eq.approved&select=amount_cents')).data.reduce((a, e) => a + Number(e.amount_cents), 0);

// Authorization boundaries
await reject(() => rpc('employee', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 1 }), 'employee cannot authorize payment');
await reject(() => rpc('manager', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 1 }), 'manager cannot authorize payment');
await reject(() => rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 2 }), 'forged revision rejected');
await reject(() => rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: 'rb-c5cac313-7737-4c18-a569-d6d8e7ec0b9c', _expected_revision: 1 }), 'legacy-shape reimbursement fails closed');

// Happy-path authorization (no dispatch without credentials)
const auth1 = await rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 1 });
ok(auth1.ok && auth1.data.id === 'pi-' + A && auth1.data.status === 'authorized', 'finance authorization creates intent');
ok(auth1.data.amount_cents === 1011 && auth1.data.currency === 'USD' && auth1.data.source_revision === 1, 'intent snapshots server-derived amount/currency/revision');
ok(auth1.data.sender_batch_id === 'qb-' + A && auth1.data.payload_digest?.length === 64, 'stable sender batch id and payload digest persisted');
ok(auth1.data.recipient_email === 'sb-fictional-employee-a@personal.example.com', 'recipient comes from server-controlled mapping');
ok(auth1.data.payload.items[0].amount.value === '10.11' && auth1.data.payload.items[0].receiver === auth1.data.recipient_email, 'immutable payload matches intent');

// Duplicate and concurrent authorization reuse the same intent
const dup = await Promise.all([rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 1 }), rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 1 }), rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 1 })]);
ok(dup.every(d => d.ok && d.data.id === auth1.data.id && d.data.paypal_request_id === auth1.data.paypal_request_id), 'concurrent authorizations reuse one intent and identity');
const intentsA = await req('finance', 'payment_intents?reimbursement_id=eq.' + A);
ok(intentsA.data.length === 1, 'exactly one payment intent per reimbursement');

// Recipient mapping visibility
const recEmp = await req('employee', 'payout_recipients?select=*');
ok(recEmp.ok && recEmp.data.length === 0, 'employee cannot read recipient mapping');
const recFin = await req('finance', 'payout_recipients?select=*');
ok(recFin.ok && recFin.data.length === 1, 'finance reads recipient mapping');

// Dispatch claim: exactly one claimant
await reject(() => rpc('employee', 'claim_payment_dispatch', { _intent: 'pi-' + A }), 'employee cannot claim dispatch');
const claim1 = await rpc('finance', 'claim_payment_dispatch', { _intent: 'pi-' + A });
const claim2 = await rpc('finance', 'claim_payment_dispatch', { _intent: 'pi-' + A });
ok(claim1.data === true && claim2.data === false, 'first dispatch claim wins, second denied');

// Uncertain outcome after dispatch → needs_reconciliation, identity preserved
await rpc('finance', 'record_payment_dispatch', { _intent: 'pi-' + A, _outcome: { kind: 'uncertain', errorName: 'NO_RESPONSE', errorMessage: 'simulated timeout after POST' } });
let intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
ok(intent.status === 'needs_reconciliation' && intent.sender_batch_id === 'qb-' + A, 'uncertain outcome preserves identity and needs reconciliation');
let rb = (await req('finance', 'reimbursements?id=eq.' + A)).data[0];
ok(rb.status === 'needs_reconciliation', 'reimbursement shows needs reconciliation');
const reauth = await rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: A, _expected_revision: 1 });
ok(reauth.ok && reauth.data.paypal_request_id === auth1.data.paypal_request_id, 're-authorization after uncertainty reuses the same identity');

// Duplicate-batch recovery: original reference recovered, processing
await rpc('finance', 'record_payment_dispatch', { _intent: 'pi-' + A, _outcome: { kind: 'duplicate', paypalBatchId: 'FAKEBATCH123', batchStatus: 'PENDING' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
ok(intent.status === 'processing' && intent.paypal_batch_id === 'FAKEBATCH123', 'duplicate-batch response recovers original payout reference');

// Forged provider evidence → association mismatch → needs_reconciliation
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { transactionStatus: 'SUCCESS', payoutItemId: 'ITEM1', transactionId: 'TXN1', payoutBatchId: 'FAKEBATCH123', senderItemId: 'qb-' + A + '-item', amountCents: 999, currency: 'USD', receiver: 'sb-fictional-employee-a@personal.example.com' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
ok(intent.status === 'needs_reconciliation' && intent.provider_error.name === 'ASSOCIATION_MISMATCH', 'forged amount rejected as association mismatch');
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { transactionStatus: 'SUCCESS', payoutItemId: 'ITEM1', transactionId: 'TXN1', payoutBatchId: 'FAKEBATCH123', senderItemId: 'qb-' + A + '-item', amountCents: 1011, currency: 'USD', receiver: 'attacker@example.com' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
ok(intent.status === 'needs_reconciliation', 'forged receiver rejected as association mismatch');

// Validated progression: PENDING → UNCLAIMED → SUCCESS
const good = { payoutItemId: 'ITEM1', transactionId: 'TXN1', payoutBatchId: 'FAKEBATCH123', senderItemId: 'qb-' + A + '-item', amountCents: 1011, currency: 'USD', receiver: 'sb-fictional-employee-a@personal.example.com' };
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'PENDING' } });
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'PENDING' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
ok(intent.status === 'processing', 'PENDING maps to processing, never paid');
const notifService = async () => { const r = await fetch(base + '/rest/v1/notifications?id=like.npay-' + A + '-processing-*&select=id', { headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey } }); return (await r.json()).length; };
const notifCount1 = await notifService();
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'UNCLAIMED' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
ok(intent.status === 'unclaimed', 'UNCLAIMED maps to unclaimed, not paid');
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'SUCCESS' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
rb = (await req('finance', 'reimbursements?id=eq.' + A)).data[0];
ok(intent.status === 'paid' && intent.transaction_id === 'TXN1' && intent.payout_item_id === 'ITEM1', 'validated SUCCESS marks paid with provider identifiers');
ok(rb.status === 'paid' && rb.data.paypalReference === 'TXN1', 'reimbursement paid with transaction reference');

// Stale and post-paid responses
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'PENDING' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
ok(intent.status === 'paid', 'stale PENDING cannot reopen a paid payment');
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'RETURNED' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + A)).data[0];
rb = (await req('finance', 'reimbursements?id=eq.' + A)).data[0];
ok(intent.status === 'paid' && intent.provider_status === 'RETURNED', 'later RETURNED preserved as evidence without re-enabling payment');
ok(rb.data.history.some(h => String(h.note).includes('RETURNED')), 'returned outcome recorded in history');

// Cross-user status recording boundaries
await reject(() => rpc('other', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'PENDING' } }), 'other employee cannot record status');
const own = await rpc('employee', 'record_payment_status', { _intent: 'pi-' + A, _result: { ...good, transactionStatus: 'PENDING' } });
ok(own.ok, 'reimbursed employee may check own payment');

// Confirmed failure path on fixture B
const authB = await rpc('finance', 'authorize_reimbursement_payment', { _reimbursement: B, _expected_revision: 2 });
ok(authB.ok, 'finance authorizes fixture B');
await rpc('finance', 'record_payment_dispatch', { _intent: 'pi-' + B, _outcome: { kind: 'rejected', errorName: 'INSUFFICIENT_FUNDS', errorMessage: 'simulated sandbox rejection' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + B)).data[0];
rb = (await req('finance', 'reimbursements?id=eq.' + B)).data[0];
ok(intent.status === 'failed' && rb.status === 'failed', 'confirmed provider rejection maps to failed');
const goodB = { payoutItemId: 'ITEMB', transactionId: null, payoutBatchId: null, senderItemId: 'qb-' + B + '-item', amountCents: 1987, currency: 'USD', receiver: 'sb-fictional-employee-a@personal.example.com' };
await rpc('finance', 'record_payment_status', { _intent: 'pi-' + B, _result: { ...goodB, transactionStatus: 'PENDING' } });
intent = (await req('finance', 'payment_intents?id=eq.pi-' + B)).data[0];
ok(intent.status === 'failed', 'stale non-success cannot reopen confirmed failure');

// Direct table writes denied; notifications dedupe; designated target untouched
await reject(() => req('finance', 'payment_intents', { id: 'pi-forged', reimbursement_id: A, expense_id: 'x', employee_id: 'TEST-A', amount_cents: 1, currency: 'USD', source_revision: 1, recipient_email: 'a@b.c', sender_batch_id: 'forged', sender_item_id: 'forged', paypal_request_id: 'x', payload: {}, payload_digest: 'x', authorized_by: '44444444-4444-4444-8444-444444444444' }), 'direct payment_intents insert denied');
const notifCount2 = await notifService();
ok(notifCount1 === notifCount2 && notifCount1 === 2, 'repeated polling creates no duplicate notifications (employee + finance rows)');
const target = (await req('finance', 'reimbursements?id=eq.' + TARGET)).data[0];
ok(target.status === 'awaiting_authorization', 'designated sandbox payout target remains awaiting authorization');

// Accounting: payment transitions never re-charge the budget
const totalsAfter = (await rpc('employee', 'shared_project_totals', {})).data;
const approvedAfter = (await req('employee', 'expenses?approval_status=eq.approved&select=amount_cents')).data.reduce((a, e) => a + Number(e.amount_cents), 0);
ok(JSON.stringify(totalsBefore) === JSON.stringify(totalsAfter), 'shared project totals unchanged by payment transitions');
ok(approvedBefore === approvedAfter && approvedAfter === 45488, 'approved spend unchanged at 45488 cents; no double counting');

console.log('TOTAL CHECKS', checks);
