# Receipt persistence milestone — November 4, 2026

## Status
Implemented the persistent company-path contract and authoritative mutation repair. Database integration verification passed in a separate local PostgreSQL 17.11 database with fictional identities, real transactions, RLS, and concurrent calls. **Persistent company-path browser acceptance is not completed.** The available preview points to the company backend; the isolated equivalent has no authentication/Storage HTTP service. No fictional financial mutation tests were run against company records.

This milestone is not a completed payment system. Real payments remain disabled; no Render/PayPal credentials were requested or used.

## Applied change
Migration `0004_confirmed_idempotent_receipt_workflow` applied to Lovable Cloud. Read-only hosted verification found all four new expense columns, zero company expenses, cancellation function present, and authenticated legacy-function execution denied. Existing RLS, team identities, department/project permissions, approval-to-reimbursement transaction and accounting model remain in place. An existing ambiguous JSON subtraction expression in receipt creation was reproduced in isolated testing and repaired in the private legacy implementation.

Checkpoint: `476ea269647c98caf0b422b413718e7af5317e93`; details in receipt-milestone-checkpoint.md. This is a code history checkpoint, not a verified database/storage backup.

## Field mapping and authoritative rules
| Form field | Persistent representation / validation |
|---|---|
| Counterparty | `data.vendor`, trimmed 1–200 characters |
| Amount | positive USD amount, up to two decimals; authoritative `amount_cents` bigint |
| Currency | explicit USD required; missing extraction currency stays blank |
| Document date | real calendar date, YYYY-MM-DD, validated in shared contract and PostgreSQL |
| Type | Paid Receipt or Supplier Invoice only for reimbursement submission |
| Number | `data.documentNumber`, nullable when absent; never fabricated |
| Provenance | manual / ai / ai_corrected, preserved as employee-reported provenance, not proof of AI accuracy |
| Confirmation | true required; `confirmedBy`/`confirmedAt` derived at database boundary from authenticated identity/time |
| Payment responsibility | employee_paid plus supporting attached payment-evidence confirmation required |
| Selections | existing category enum, own department and assigned project enforced |
| Attachment | one private receipt path `authenticated actor/submission UUID`; object ownership, MIME and 1 byte–10 MB checked |
| Ownership/version | server-derived employee and actor; version 1 then incremented on confirmed return/resubmission |

Unpaid supplier invoices, company-paid documents and unknown payment responsibility cannot create employee reimbursement. Direct supplier payments are deferred. Quotes and drafts remain outside spending; persistent non-expense storage is still unavailable, unchanged from the previous implementation. Historical missing metadata is not backfilled as verified and cannot be approved without review.

## Recovery and duplicate handling
Actor-scoped durable unique submission key plus transaction advisory lock: identical retries return the existing result; changed content using the same key is rejected. Private legacy mutation cannot be called by authenticated users. Receipt and expense creation remain atomic inside the database.

The form retains a retry key and pending manifest in actor-scoped session storage, restores pending information after reload, and checks database commit status before retry/cleanup. Attachments are not deleted after uncertain outcomes. Explicit cancellation uses the same database lock, records a cancellation tombstone only if uncommitted, and permits deleting only owned unreferenced cancelled objects. Delayed commits using cancelled keys roll back. Cancellation status and hosted file cleanup still require isolated browser/Storage acceptance; the implemented PostgreSQL rules passed isolated integration tests.

Approvals lock the target, require current confirmed version, preserve existing approver permissions, disallow self-approval, and make identical concurrent/repeated approval a no-op. Exactly one reimbursement remains protected by the existing expense uniqueness constraint. Corrected amounts require renewed confirmation and a new version; stale-version approval is rejected. No new budget reservation/hard-limit rules were introduced.

## Extraction consistency
Each selected file has a selection identity and edit revision. Replacing a file clears document fields, payment evidence and confirmation. Old results cannot alter a new file's fields/loading/error state; manual edits are retained against late responses. Server extraction deadline is 25 seconds, client deadline 30 seconds; transport cancellation is not exposed by the existing RPC adapter, so stale results are ignored instead. Existing adapter was retained.

Live AI extraction was **not invoked** in this milestone. Selection-race regression tests exercise the production guard; they are not a real network A/B extraction test. Browser acceptance exercised manual entry with a valid generated fictional PDF and confirmed that currency starts blank.

## Commands and outcomes
- `bunx vitest run`: 9 test files, 50 tests passed (existing math/team/access/vault tests and new document-contract/selection tests).
- `bash src/test/integration/run-receipt-workflow.sh`: 32 isolated database assertions passed, fresh database from migrations 0000, 0001 and the exact applied 0004 migration; local managed-platform equivalents are explicitly defined in local-platform.sql. The script refuses to use managed database environment credentials and listens on a private Unix socket.
- `python3 /tmp/browser/receipt-milestone/check_upload.py`: manual currency/eligibility/payment-evidence/human-confirmation gates passed; valid PDF displayed; one sample expense appeared through normal navigation; no runtime errors. Sample reload persistence is not claimed.
- Harness build/typecheck: intermediate test-script typing and UUID-ref typing errors were found and repaired; final observed entry at 06:07:17 UTC reported `build OK`. Manual builds/typechecks were not run because this project runs them automatically.

### Database assertions actually run
Unknown currency; invalid calendar date; extra monetary precision; missing human confirmation; quote; company-paid expense; unpaid supplier invoice; unknown payer; missing amount; concurrent identical submission; preserved metadata/cents/actor; one receipt; changed-content retry; post-commit status recovery; other actor cannot attach; private receipt read denial; employee cannot approve; direct sensitive update denied; private legacy bypass denied; concurrent duplicate approval; one awaiting-authorization reimbursement; one accounting increase; committed cancellation denied; uploaded object followed by department failure; cancellation proven uncommitted; orphan cleanup; delayed cancelled submission rollback; legacy unknown verification denied; stale version denied; changed amount needs confirmation; corrected version stale approval denied; corrected reimbursement amount readback.

### Linked isolated evidence
First successful expense from retained final suite:
- Expense: `9e609dfa-c966-4ddf-afdc-4c995e7853b0`
- Receipt: `r-9e609dfa-c966-4ddf-afdc-4c995e7853b0`
- Reimbursement: `rb-9e609dfa-c966-4ddf-afdc-4c995e7853b0`
- Amount: $312.38; pending before approval, awaiting_authorization after approval.
- Allocated test budget: $1,000.00.
- Approved spending: $0.00 → $312.38.
- Approved unpaid: $0.00 → $312.38.
- Remaining budget: $1,000.00 → $687.62.
- Receipt links through expenseId, approval through expenseId, reimbursement through expenseId; concurrent calls produced one approval and reimbursement.

IDs are fictional isolated records, not company records; fresh test cluster is removed automatically. The suite additionally exercises a separate returned/resubmitted $200 record; it is not included in the first-expense figures above.

## Unexecuted / remaining
- Persistent browser receipt upload → reload → authorized approval → dashboard/reimbursement readback with isolated authenticated identities.
- Hosted Storage ownership, upload timeout/deduplication and cancellation/delete behavior, private signed PDF URLs.
- Actual network extraction A/B out-of-order and manual-edit races, deadline behavior and live AI accuracy.
- An actual lost HTTP response after database commit (database commit-status recovery was tested, not network fault injection).
- Browser return/resubmission and session-storage recovery after interruption.
- Render integration/source-of-truth alignment; PayPal Sandbox payout dispatch, authorization separation, outbox/idempotent reconciliation and webhooks. All sending payments remains deferred.
- Existing separate roadmap blockers: owner's OAuth acceptance, collaborator invitation/verified identity, external repo access, real employee invitation and HTTPS recovery acceptance remain unchanged.

Do not treat demo success or local-platform equivalent tests as proof that the hosted company browser workflow is verified. Real-record readiness is not claimed.