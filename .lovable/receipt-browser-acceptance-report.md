# Isolated receipt acceptance — 4 November 2026

## Verdict: NOT VERIFIED
The authenticated persistent upload and owner download passed, but the full browser approval flow and critical recovery cases did not complete. This is not hosted-company readiness and is not a completed milestone acceptance.

## Environment and changes
Browser: http://localhost:8080. Browser Supabase target was confirmed before writes as the draft-specific lovableproject.com/_port_8001 address; requests were sent only to 127.0.0.1:8001. Real local Auth, PostgreSQL, Data API and Storage were used. No company service writes, payment calls, invitations, paid extraction or Render calls occurred.

The environment was not actually empty: generated incompatible example accounts and legacy expenses existed. These generated rows were removed using local service-role requests. Added three clearly fictional .invalid accounts, two departments, trigger-created profiles and employee/manager roles, and a $1,000 budget through db/seed.sql applied with psql in one transaction. The third employee exists solely for cross-account isolation. No expense, approval or reimbursement was manually inserted. Existing private-receipts bucket and production receipt policies were retained without relaxation. No schema migrations or product-code changes were made.

Changed project files: db/seed.sql, roadmap.md, .lovable/receipt-browser-acceptance-report.md, .lovable/receipt-browser-acceptance-checkpoint.md. Temporary test scripts, credentials and captures are under /tmp/browser/receipt-acceptance. db/seed.sql contains fictional throwaway login credentials, never real credentials.

## Actual observations
| Check | Result | Observation |
|---|---|---|
| Real employee sign-in | PASS | Password sign-in loaded authorized internal records, not the demo provider. |
| Blank initial currency | PASS | Currency input empty after PDF selection. |
| Confirmation gates | PASS | USD, personally paid responsibility, payment evidence and human confirmation entered before submission. |
| Persistent submission/reload | PASS | Normal app submission created linked expense and receipt; authenticated readback preserved fields, actor, exact 31238 cents and version 1. |
| Real PDF stored/downloaded | PASS, with transport limitation | Real Storage retained the 716-byte PDF; owner browser download returned 716 bytes; direct authenticated download returned HTTP 200 application/pdf. |
| Owner signed URL | PARTIAL/BLOCKED browser | Direct authenticated HTTP request returned 200 with a signed URL. Browser SDK request through the test forwarding path returned “body must be object”; usable browser signed-preview opening not established. |
| Employee B private download | PASS | Real signed-in B download returned Object not found. |
| Employee B signed URL denial | BLOCKED | Browser signing request failed transport validation, which does not prove authorization denial. |
| Self approval | PASS | Real authenticated database request rejected with Approval not permitted. |
| Forged direct expense status | PASS | Authenticated update returned no rows; subsequent database read showed all records still pending. |
| Different manager sign-in | PASS | Real approver sign-in loaded internal department records. |
| Browser approve and reimbursement | BLOCKED | Approvals navigation repeatedly stayed/reverted to Overview; target queue did not become available to click. No approval or reimbursement created. Root cause not established or fixed. |
| Double-click/repeated submission | NOT EXECUTED | Four separately initiated submissions used distinct keys while diagnosing transport; these are not an idempotency test. |
| Lost response after commit; pending reload/account switch | NOT EXECUTED | No controlled commit-response interruption completed. |
| Failed create/orphan cancellation/committed attachment protection | NOT EXECUTED | Real Storage failure/cancellation acceptance not completed. |
| Return/resubmit/stale approval | NOT EXECUTED | Browser approval flow did not complete. |
| Replacement/late extraction ordering/timeouts | NOT EXECUTED | Paid extraction was blocked at transport. This was not a successful simulated-ordering test and is not live extraction verification. |
| Unit suite | PASS | bunx vitest run: 9 files / 50 tests. |
| Isolated PostgreSQL harness | PASS | 32 checks using PostgreSQL 17.11 at its installed package path. Initial default /tmp binary path was missing; supplied RECEIPT_TEST_PG_BIN and reran successfully. |

### Browser test transport limitation
The prescribed route.fetch forwarding produced empty multipart bodies (real Storage stored zero bytes) and malformed signing bodies. For successful upload tests the forwarding layer sent the selected fictional PDF bytes as multipart to the real local Storage API, preserving the actual user bearer token, path, MIME type and service authorization. This is real Auth/Storage/persistence but not proof of an unmodified browser multipart transport. Zero-byte diagnostic objects remain unreferenced in this disposable draft; their safe application cancellation was not verified. No policy was changed to permit invalid files.

## Linked persistent records
All below are fictional draft records created by separate normal submissions; each is $312.38, pending, confirmed by employee A, version 1. These distinct submissions are not duplicate retries.
- Expense `eb5554d3-2a79-4141-a8db-916514b6b090`; receipt `r-eb5554d3-2a79-4141-a8db-916514b6b090`; submission `6205d86e-8b5f-455a-a4cc-2e9506ef26f9`; actor `11111111-1111-4111-8111-111111111111`.
- Expense `0177e977-cf12-4625-9ab0-18e92de61d84`; receipt `r-0177e977-cf12-4625-9ab0-18e92de61d84`; submission `8d02179a-52bc-4d8f-a2f7-5ee318b82d68`; actor `11111111-1111-4111-8111-111111111111`.
- Expense `89a9707d-bf6b-48d9-af9d-2f0bbf4b8f1c`; receipt `r-89a9707d-bf6b-48d9-af9d-2f0bbf4b8f1c`; submission `45e15d48-3eb6-4b79-a8ae-6f4dcd73f959`; actor `11111111-1111-4111-8111-111111111111`.
- Expense `c0930c96-a842-496a-b208-45476c1a5fb4`; receipt `r-c0930c96-a842-496a-b208-45476c1a5fb4`; submission `4a42b5df-aa6f-43d0-b8eb-ea64aeef14c4`; actor `11111111-1111-4111-8111-111111111111`.

Approval identifiers: none. Reimbursement identifiers: none.

## Accounting
Initial fictional budget: $1,000.00; approved spending $0.00; approved unpaid $0.00; remaining $1,000.00.
Final observed: four pending expenses totaling $1,249.52; approved spending $0.00; approved unpaid $0.00; remaining $1,000.00. No payments or paid statuses. Approval-count-once and reimbursement-not-double-counted remain unverified in the persistent browser environment. The separate transaction harness passed $312.38 approved spending and approved unpaid, $687.62 remaining from $1,000; do not confuse those ephemeral records with this draft’s browser records.

## Evidence and remaining work
Attached captures: before-sign-in accounting, confirmed upload form, persisted internal Overview. Database JSON snapshots and browser transcripts remain under /tmp/browser/receipt-acceptance, not attached because credential-bearing signed URLs must not be published. Screenshot of final Overview shows four pending, zero approved and zero unpaid.

Exact remaining blockers: browser Approvals navigation does not settle on the target queue; browser-to-local signing/multipart forwarding is not reliable; critical recovery fault-injection and resubmission acceptance therefore remain incomplete. No overall verification or company readiness claim is made. Product design and accounting rules were not changed.
