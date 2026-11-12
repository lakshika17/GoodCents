# PayPal Sandbox payment module — isolated draft report

Date: 2026-11-05. All work stayed in the isolated draft `drft_01m6jmag9jfb6vk3rczy0gbmfn`. No publish, no draft acceptance, no company-record writes, no Render or Airtable calls. Live payments were not touched; only the PayPal Sandbox API was called. The earlier direct-HTTPS PDF upload is recorded as USER-VERIFIED (verified by the user, not independently by this agent).

## Implemented changes

### Migrations (draft database only; applied to the company app only if the draft is accepted)
- `0010_paypal_sandbox_payment_intents`:
  - `payment_intents` — durable payment intent, one per reimbursement (`reimbursement_id` UNIQUE), with stable `sender_batch_id` (`qb-<reimbursement id>`), `sender_item_id`, `paypal_request_id`, immutable payload + SHA-256 digest, recipient snapshot, authorizing account and timestamp, dispatch claim marker, and provider identifiers (`paypal_batch_id`, `payout_item_id`, `transaction_id`), raw `provider_status`, sanitized `provider_error`.
  - `payout_recipients` — server-controlled employee → sandbox recipient mapping. Readable by Finance only; writable by the service role only. Never derived from PDF content, login email, or browser input.
  - Reimbursement status set widened: `awaiting_authorization`, `queued`, `processing`, `paid`, `failed`, `needs_reconciliation`, `unclaimed`.
  - RPCs (SECURITY DEFINER, authenticated EXECUTE, role-checked inside):
    - `authorize_reimbursement_payment` — Finance-only; atomically rechecks approved revision, amount, currency (USD only), and active recipient mapping under a row lock; creates or reuses the intent; recipient change before dispatch invalidates and re-snapshots, after dispatch it is rejected.
    - `claim_payment_dispatch` — exactly one caller may perform the first provider POST.
    - `record_payment_dispatch` — records accepted / duplicate-recovered / rejected / uncertain outcomes atomically with reimbursement status, history, and deduplicated notifications.
    - `record_payment_status` — records the individual item result; paid requires validated association (sender_item_id, amount, currency, receiver); stale and post-terminal responses are handled (see mapping below).
- `0011_fix_payment_status_mismatch_array` — fixed a plpgsql array-append bug in `record_payment_status` found by the controlled checks.

### Application code
- `src/lib/paypal.ts` — pure, unit-tested helpers: payload building (USD-only, exact decimal cents), item-status mapping, association validation, stale-response rules, duplicate-batch link extraction, provider-error sanitization.
- `src/lib/paypal.server.ts` — server-only client. Sandbox origin `https://api-m.sandbox.paypal.com` is hardcoded; callers cannot supply an origin or enable live mode. OAuth client-credentials token, `POST /v1/payments/payouts` with `PayPal-Request-Id`, `GET /v1/payments/payouts/{id}`, `GET /v1/payments/payouts-item/{id}`, 20 s timeouts. 5xx/timeouts are classified uncertain, never auto-retried with a new identity.
- `src/data/payments.functions.ts` — authenticated server functions:
  - `authorizePayment` — Finance authorization + single dispatch for the persisted identity. Missing credentials leave the intent authorized (queued) with no dispatch; repeated calls reuse the intent.
  - `checkPaymentStatus` — Finance or the reimbursed employee; reconciles via batch → item lookup and validates association before any state change. Controlled same-identity recovery: if the dispatch response was lost, Finance re-POSTs the identical payload with the same `sender_batch_id` and `PayPal-Request-Id` (PayPal completes a `sender_batch_id` only once within its 30-day window; the application-side UNIQUE constraint is permanent and does not rely on that window).
- UI (`src/routes/reimbursements.tsx`, `src/data/store.tsx`, `src/components/shared.tsx`, `src/data/types.ts`): Finance sees a confirmation dialog with employee, approved amount/currency, source revision, sandbox recipient, and a Sandbox label, with an explicit "Authorize and send sandbox payment" action; "Check payment status" for in-flight rows; no payment action for paid or unresolved reimbursements. Employee sees awaiting/processing/paid/failed/reconciliation states and persistent in-app notifications. Demo mode is unchanged (in-memory, no payments).
- `db/seed.sql` — fictional recipient mapping for TEST-A now points at the actual sandbox personal account used for acceptance.

### Secrets
`PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_CLIENT_SECRET` were saved through the secure secret form and are available to backend code only. No credential appears in code, logs, or this report.

## Preview page and Finance actions
Preview: https://id-preview-1--0f74dc14-d6c8-4284-a4cf-55c82c3fd3e6.lovable.app → sign in as the isolated Finance account → **Reimbursements** → row "Fictional Three Role … corrected · $19.87" → **Authorize** → review the Sandbox confirmation → **Authorize and send sandbox payment** → **Check status** until Paid.

## Verification results

| Check | Expected result | Observed result | Evidence | Execution type | Status |
|---|---|---|---|---|---|
| Employee/manager cannot authorize | Rejected | Rejected | payments.integration.js checks 1–2 | Actual app RPC (mocked provider) | PASS |
| Forged revision rejected | Error | "Approved revision changed" | check 3 | Actual app RPC | PASS |
| Legacy-shape reimbursement | Fails closed | Rejected (no amountCents/revision snapshot) | check 4 | Actual app RPC | PASS |
| Authorization snapshots server values | Server-derived amount/currency/revision/recipient | 1011¢ USD rev 1, mapped recipient | checks 5–9 | Actual app RPC | PASS |
| Concurrent/duplicate authorization | One intent, one identity | 3 parallel calls → 1 row, same PayPal-Request-Id | checks 10–11 | Actual app RPC | PASS |
| Recipient mapping visibility | Finance only | Employee read returns 0 rows | checks 12–13 | Actual app RPC | PASS |
| Dispatch claim | Exactly one claimant | First true, second false; employee denied | checks 14–15 | Actual app RPC | PASS |
| Timeout/lost response after POST | needs_reconciliation, identity preserved | Status + reimbursement + notification set; re-auth reuses identity | checks 16–18 | Mocked outcome via app RPC | PASS |
| Duplicate-batch recovery | Original reference recovered | paypal_batch_id stored, processing | check 19 | Mocked outcome via app RPC | PASS |
| Forged amount / receiver in provider result | Association mismatch, not paid | needs_reconciliation + ASSOCIATION_MISMATCH | checks 20–21 | Mocked outcome via app RPC | PASS |
| PENDING / UNCLAIMED / ONHOLD | Never paid | processing / unclaimed | checks 22–23 + unit tests | Mocked outcome via app RPC | PASS |
| Validated SUCCESS | Paid with identifiers | paid + transaction id + reimbursement updated | checks 24–25 | Mocked outcome via app RPC | PASS |
| Stale PENDING after paid | Ignored | Still paid | check 26 | Mocked outcome via app RPC | PASS |
| RETURNED after paid | Evidence preserved, no repayment | provider_status=RETURNED, history note, still paid | checks 27–28 | Mocked outcome via app RPC | PASS |
| Cross-user status recording | Owner employee + Finance only | Other employee rejected | checks 29–30 | Actual app RPC | PASS |
| Confirmed failure | failed, terminal to non-success | INSUFFICIENT_FUNDS → failed; later PENDING ignored | checks 31–33 | Mocked outcome via app RPC | PASS |
| Direct table writes | Denied | payment_intents insert rejected | check 34 | Actual app RPC | PASS |
| Notification dedupe | No duplicates on repeat polling | Exactly 2 rows per status (employee + finance) | check 35 | Actual app RPC | PASS |
| Accounting | No double counting | Approved spend 45488¢ before and after all payment transitions; shared totals unchanged | checks 37–38 | Actual app RPC | PASS |
| Unit tests | All pass | 79/79 (13 new PayPal tests) | vitest run | Mocked/unit | PASS |
| Real sandbox payout via Finance UI | One payout, item SUCCESS | Authorized 06:45:37 UTC, dispatched 06:45:38, paid 06:45:55 | screenshots 2_confirm, 4_final; DB record | Actual app request + actual PayPal Sandbox call | PASS |
| Independent provider verification | Item SUCCESS, amount/currency/receiver match | SUCCESS, USD 19.87, correct receiver, fee $0.25 kept separate | payouts-item GET | Actual PayPal Sandbox call | PASS |
| Employee view | Paid + transaction ref, no Authorize button | Confirmed; 0 authorize buttons | 5_employee_view.png | Actual app UI | PASS |
| Notifications persist | Survive refresh/login | Persisted rows for employee + finance (queued/processing/paid) | DB query | Actual app RPC | PASS |
| Background reconciliation with all pages closed | — | Does not exist; polling runs only while a page is open or on manual "Check payment status" | code inspection | — | UNVERIFIED (not implemented by design) |
| Multi-tab concurrent browser dispatch | One payout | Covered at RPC level (claim + UNIQUE), not with two live browser tabs | checks 10–11, 14–15 | Actual app RPC | PASS (RPC level) |
| Hosted HTTPS preview UI | Same flow | Not run; platform sign-in blocks automation. Manual steps above. | — | — | NOT RUN |

## Real sandbox payout record

| Reimbursement | Approved revision | Amount/currency | Payment intent | Sender batch ID | PayPal batch/item IDs | Individual item status |
|---|---|---|---|---|---|---|
| rb-a0c2aeb1-d120-4d59-80a5-2fa70b855c59 (Fictional Employee A, "Fictional Three Role … corrected") | 2 | 1987 cents / USD | pi-rb-a0c2aeb1-d120-4d59-80a5-2fa70b855c59 | qb-rb-a0c2aeb1-d120-4d59-80a5-2fa70b855c59 | batch U5RJVXAEBRL5A / item RQFSYQA5FPP82 / txn 3WK03536PJ550571X | SUCCESS (verified independently) |

Only this one explicitly identified fictional reimbursement was paid. The remaining approved test reimbursements were not paid; the accidental-script expenses were not payment targets. Provider fee $0.25 is provider-side only and never enters the approved reimbursement amount or budget accounting.

## Business status mapping

| Business status | Database state | Provider evidence | Employee display | Finance action |
|---|---|---|---|---|
| Awaiting Finance authorization | reimbursements.status=awaiting_authorization, no intent | — | "Awaiting authorization" | Authorize (confirmation dialog) |
| Authorized, submitting/processing | queued → processing; intent processing | batch accepted, item PENDING/PROCESSING | "Authorized" / "Processing" | Check status |
| Paid | paid; intent paid | item SUCCESS, validated association + amount + currency + receiver | "Paid" + transaction reference | None (no repayment action) |
| Confirmed failure | failed; intent failed | item FAILED/DENIED/RETURNED/REFUNDED or dispatch rejected | "Failed" + reason | None (replacement attempts out of scope) |
| Outcome needs reconciliation | needs_reconciliation | timeout/5xx/lost response, association mismatch, unknown status | "Needs reconciliation" | Check status (controlled same-identity recovery) |
| Unclaimed or held | unclaimed | item UNCLAIMED/ONHOLD | "Unclaimed / held" | Check status |

Raw provider status is always retained in `payment_intents.provider_status`; later RETURNED/REFUNDED after SUCCESS is preserved as evidence with a history note and never re-enables payment.

## Background reconciliation
None. Status advances only while a page polls or a user presses "Check payment status". No cron, queue, or webhook exists in this milestone. A payout dispatched with all browser pages closed stays in its last persisted state until someone opens the app and checks; the identity and payload are preserved, so recovery is always possible.

## Remaining blockers and limitations
- Hosted-preview UI acceptance (real HTTPS origin) remains NOT RUN because automation cannot pass Lovable platform sign-in; the manual steps above cover it. The sandbox-local UI flow was fully executed.
- Webhooks not implemented (optional for this milestone); polling only.
- Automatic replacement attempts after confirmed failure are out of scope by design.
- Non-USD currencies are explicitly rejected; multi-currency is future work.
- The recipient mapping is service-role-managed; changing it requires a server-side update (no UI), which is intentional for this milestone.
- This is sandbox-only verification. No live-payment readiness is claimed; live mode is not implemented and the origin is hardcoded to sandbox.
