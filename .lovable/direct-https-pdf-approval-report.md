# Direct HTTPS PDF-to-Approval Acceptance Report

Date: 2026-11-05 UTC
Draft: Receipt persistence acceptance (isolated)
Preview: https://id-preview-1--0f74dc14-d6c8-4284-a4cf-55c82c3fd3e6.lovable.app

## A. Overall verdict

**The fresh real PDF-to-approval flow is NOT RUN. The application is not yet verified ready to begin PayPal Sandbox integration.** Payment functionality is not complete and remains disabled.

A fresh Chromium session navigated directly to the specified HTTPS preview without a proxy, route interception, credential injection or mocked response. Before the application opened, the preview redirected to Lovable's auth bridge and then its platform login page. That platform session is not available to this automation environment. Fictional employee credentials belong to the application and cannot authenticate to Lovable itself. No preview access setting was weakened and no platform credentials were requested or exposed.

This is an automation access limitation, not evidence of an application upload failure. The direct upload, fresh Render call and same-document approval sequence therefore remain NOT RUN. No proxy upload was substituted. All feasible independent checks below were completed without creating an extraction job or dispatching a new Render request.

## B. Verification table

| Check | Expected result | Observed result | Evidence | Execution type | Status |
|---|---|---|---|---|---|
| Open actual HTTPS application | Application employee sign-in accessible | Redirected to Lovable auth bridge, then platform login | Browser URL and inspected login screenshot | Actual browser actions | FAIL |
| Direct HTTPS PDF upload | Original PDF reaches private Storage without proxy/interception | Application could not be opened; upload never attempted | HTTPS access probe | Checks not executed | NOT RUN |
| Fresh real Render extraction | One new canonical request; real service result | Zero new jobs; no new service call | Job count stayed 3 before/after | Checks not executed | NOT RUN |
| Fresh full original response persistence | Complete service JSON retained | No fresh response; code now saves original JSON separately from validated page DTO | Source inspection; original-response test | Checks not executed for fresh persistence | UNVERIFIED |
| Refresh recovers fresh request/result | Same new request UUID and original snapshot | Fresh request does not exist | Record mapping below | Checks not executed | NOT RUN |
| Logout/login restores fresh PDF and extracted fields | Exact document/result restored and confirmation cleared | No fresh integration draft exists | Record mapping below | Checks not executed | NOT RUN |
| Same-document employee submission | Verified extracted/corrected revision enters assigned queue | No expense created in this run | Expense count remained 10 | Checks not executed | NOT RUN |
| Assigned manager approval | Current revision approved once | No new decision in this run | No new expense | Checks not executed | NOT RUN |
| Employee/Finance same approved revision | USD 27.43, same revision awaiting payment | No approved integration record exists | Amount comparison | Checks not executed | NOT RUN |
| Existing terminal request recovery | Same historical UUID/result; no POST | Existing request returned completed via authenticated app server function | Independent recovery output; request 9053ffbf-7942-47b8-9b5c-122ee45f6a9a | Actual authenticated API requests | PASS |
| Existing original bytes/digest | Download hash matches saved SHA-256 | Match confirmed for prior fictional document | Authenticated Storage download and browser SHA-256 | Actual authenticated API requests | PASS |
| Existing employee records refresh | Authorized existing records still render | Expense list rendered after reload | Inspected employee screenshot | Actual browser actions on localhost, with required draft-backend routing | PASS |
| Existing manually saved draft recovery | Form/PDF restored; no extraction caused by opening it | Existing USD 7.65 draft restored; confirmation unchecked; job count unchanged | Inspected draft screenshot | Actual browser actions on localhost, with required draft-backend routing | PASS |
| Concurrent historical dispatch claims | Previously dispatched jobs cannot POST again | Three concurrent claims all returned false | extraction-dispatch.integration.js | Actual authenticated API requests, service-authorized local claim checks | PASS |
| Employee cannot claim dispatch | Privileged claim RPC rejected | Authenticated employee call rejected | extraction-dispatch.integration.js | Actual authenticated API requests | PASS |
| Original response preservation and request matching | Extra JSON retained; wrong UUID rejected | Focused tests passed | extraction-api.test.ts | Mocked checks | PASS |
| Exact bytes and uncertain transport | Exact bytes sent; no automatic retry inside transport helper | Focused test passed, one mocked fetch | extraction-api.test.ts | Mocked checks | PASS |
| Extraction mapping/selection guards/expense precision | Existing rules remain intact | 28/28 affected tests passed across four files | Focused test output | Mocked checks and pure unit checks | PASS |
| New first-dispatch winner | Exactly one claimant of a fresh queued job | No fresh job created to exercise winner path | SQL reviewed; only historical-denial path executed | Checks not executed | UNVERIFIED |
| No new payment or outbound notification in this run | No side effects | No new mutation flow executed; payment states unchanged, notification rows 0; no payment/sync/notification calls in inspected extraction path | Before/after readback and source inspection | Actual authenticated API requests and source inspection | PASS for this run only |
| Automatic build | No errors | Latest automatic build entry says build OK | Observability build log | Automatic project check | PASS |

The independent localhost checks are explicitly not direct HTTPS acceptance. They use the prescribed sandbox routing to the draft backend, with no PDF upload. Earlier successful approvals and earlier real Render extraction are historical evidence only, not passes for this new requested sequence. No exact model invocation count is claimed.

## C. Amount comparison table

Prepared expected values were recorded before any possible upload. This document has not been uploaded.

| Field | Expected PDF value | Extracted value | Employee-confirmed value | Finance-displayed value |
|---|---|---|---|---|
| Merchant | Fictional HTTPS Paper Supply | NOT RUN | NOT RUN | NOT RUN |
| Date | 2026-11-05 | NOT RUN | NOT RUN | NOT RUN |
| Currency | USD | NOT RUN | NOT RUN | NOT RUN |
| Total | USD 27.43 (2743 cents) | NOT RUN | NOT RUN | NOT RUN |
| Receipt number | FIC-HTTPS-20261105-01 | NOT RUN | NOT RUN | NOT RUN |
| Subtotal | USD 25.00, from printed notebook 20.00 + pen set 5.00 | NOT RUN | NOT RUN | Not a Finance column |
| Tax | USD 2.43 | NOT RUN | NOT RUN | Not a Finance column |

The fictional PDF is 1845 bytes. SHA-256: `c2e58c8124a8f5179227161b1f997b5bf345c2a71205c97cd503be3fbb202019`. Its one page was rendered and visually inspected; all values fit and are legible.

Existing isolated approved/unpaid expense accounting stayed at 45488 cents, budget 100000 cents, remaining 54512 cents. No new approved amount was added. Payment states remained awaiting_authorization; none became paid. Earlier display rounding is not proof of the new integration's accounting, which remains unexecuted.

## D. Record mapping table

| Record type | Identifier | Related document or revision | Observed state |
|---|---|---|---|
| Prepared integration document | fictional-https-integration-receipt.pdf; FIC-HTTPS-20261105-01 | Expected USD 27.43; digest above | Prepared locally, never uploaded |
| New integration document identity | Not allocated | Prepared PDF | No application document created |
| New canonical extraction request | Not allocated | Prepared PDF | No new extraction job or dispatch |
| New logical expense | None | Prepared PDF | NOT RUN |
| New submitted revision | None | Prepared PDF | NOT RUN |
| New manager decision | None | Prepared PDF | NOT RUN |
| New reimbursement | None | Prepared PDF | NOT RUN; no record is approved for a later payment test |
| Historical recovery-only request | 9053ffbf-7942-47b8-9b5c-122ee45f6a9a | submission key 41bb87d1-21c2-45b1-b087-e2e38ea26ca2; prior fictional resume PDF | Existing completed result recovered; not this integration test |
| Historical original byte reference | 11111111-1111-4111-8111-111111111111/41bb87d1-21c2-45b1-b087-e2e38ea26ca2 | Same historical request | Private bytes downloaded; digest match |

The new integration must use a newly persisted application UUID on its first actual upload. No earlier acceptance UUID was reused to represent this run. Historical receipts and expenses were not deleted, including the accidental-script expenses 188562ca-70be-487a-a8a7-816f47b5a8b9 and 14b3dbb0-7d7d-4b3d-893f-cec0c4a7120e. They are not the intended future payment record.

## E. Changes and remaining work

### Actual fixes
1. Repeated starts on a nonterminal persisted job previously could POST again. Migration `0009_extraction_dispatch_claim` adds a durable service-only atomic claim before dispatch. The first winner may POST; historical jobs are conservatively marked dispatched. Other starts return the same identity for GET recovery. A crash after claim is intentionally outcome-unknown, not permission to automatically repost.
2. Recovery previously polled only when no envelope existed, so a queued/processing envelope could remain stuck. Recovery now checks terminal state and polls nonterminal results, while preserving saved corrections.
3. Restoring a metadata-only uploaded document with no job can now start using the same persisted document key/bytes. Opening a manually saved form with no extraction does not initiate new reading.
4. “Type manually” previously discarded the attachment and extraction association. It now retains both and clears confirmation, preserving later logical-expense linkage.
5. Parsed response validation previously stripped additional provider fields before persistence. The server-only transport now keeps the full original JSON for the trusted snapshot write while returning a validated DTO to the page. A response bearing another UUID is rejected as uncertain.

No secrets were changed. No Render service, company record, approval policy, payment integration or invitation settings were modified. No new fictional login or data rows were needed. The migration ran only against this draft and is recorded for acceptance; the draft remains unaccepted and unpublished. No seed rows reference the changed extraction table.

### Verification scope and limits
Affected regressions: 28/28 passed. Local authenticated existing-job checks: concurrent denied claims, snapshot/identity unchanged, employee denial all passed. Browser existing-record reload and manual-draft restoration passed. Build is OK. Existing return/resubmit behavior was not repeated; its transition code was not changed.

Fresh first-dispatch concurrency, new raw-response database readback, a new nonterminal recovery reaching completion and the real same-document approval sequence remain unverified. Do not infer them from mocked tests or the historical request readback.

### Shortest manual acceptance
1. Open the specified preview from your signed-in Lovable session, then sign in with the existing isolated Employee A account. Do not change site access settings or use Demo preview.
2. Upload **fictional-https-integration-receipt.pdf once** through Submit Expense. Do not replace/reupload it or enter the merchant/date/currency/total manually. Wait for actual AI reading. Expected values are Fictional HTTPS Paper Supply, 2026-11-05, USD 27.43.
3. Record the new document key/request UUID from its authenticated extraction record. If a timeout occurs, reopen this same saved document to check that UUID; do not upload again or create a replacement job. If status remains missing/uncertain, stop and preserve the document for diagnosis.
4. After extraction, choose Paid Receipt and save as draft. Refresh, then sign out/in and Open draft. Verify the PDF and extracted fields restore, the same request UUID persists, and confirmation is unchecked. Make only necessary corrections; compare the immutable original response separately.
5. Select “I personally paid”, confirm actual fictional payment evidence and human review, then Submit for approval once. As the assigned manager approve current revision. As employee and Finance verify USD 27.43 and the same source revision awaiting payment, with no payment action.
6. Read back and record the document key → request → expense → revision → decision → reimbursement identifiers and original digest. That newly approved reimbursement, only after this verification, is the candidate for a later separately authorized PayPal Sandbox test. Do not pay in this milestone.

**Remaining blocker:** a signed-in platform browser session is required to reach the HTTPS preview. This environment has application test sessions, not that Lovable platform session. Direct upload and the downstream fresh sequence must remain NOT RUN until those manual actions or equivalent authorized browser access are available.
