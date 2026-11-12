# Receipt approval & recovery acceptance — isolated draft

Date: 2026-11-04 · Environment: this draft's own local backend (127.0.0.1:8001, the backend the browser uses). Company records untouched. Payments disabled; no Render/PayPal/extraction.

## Root cause of the earlier approval block
**Test data, not application code, permissions, or account setup.** The draft held two leftover approval-rules records (from generated example data, not from `db/seed.sql`) in the wrong shape — missing `restrictedCategories` and other fields. The Approvals review card calls `policyIssues`, which threw `Cannot read properties of undefined (reading 'includes')`; the route errored and the page fell back. The earlier script also matched the vendor name on the Overview list before navigation finished, which hid the real error.

Account configuration was correct: approver TEST-M is a manager in TEST-OPS, same department as Employee A; the expense was marked verified so Approve was enabled.

## Changes
- Draft data: removed the two malformed approval-rules records; inserted one valid record identical to the app's default rules.
- `db/seed.sql`: appended that valid approval-rules row so future drafts start correct.
- No product code, permission, or schema changes.
- Test harness only: fault switches for upload abort, create abort (request never reaches server), and lost response (server commits, browser receives nothing).

## Results (real sign-in, real database, real Storage)
| Check | Result | Observation |
|---|---|---|
| Employee submits (double-click on Submit) | PASS | 1 expense, 1 receipt, 1 file |
| Reload preserves expense | PASS | Visible on Expenses after reload; 31238 cents, actor = Employee A |
| Different authorized account approves in browser | PASS | Approver opened Approvals, Queue (1), Approve enabled, clicked |
| Exactly one approval / one reimbursement awaiting authorization | PASS | approvals 1, reimbursements 1, status `awaiting_authorization` |
| Totals update once and survive reload (approver + employee) | PASS | see below |
| Nothing appears paid | PASS | Paid $0; Queued $0 |
| Interrupted upload → retry | PASS | Abort: no expense created; retry: exactly 1 new expense + 1 file |
| Failed expense creation → safe cancel + cleanup | PASS | Orphan file existed (3 files), cancel wrote tombstone and removed it (back to 2), no expense |
| Lost response after commit | PASS | Server committed (200), response dropped; app checked status, recovered "saved once", 1 expense, no duplicate |
| Committed attachment protected | PASS | Cancelling committed key returned `false`; owner remove deleted nothing; download still 716 bytes |
| Unit tests | PASS | 50/50 |
| Database harness | PASS | 32 checks |

## Linked records
- Expense `c5cac313-7737-4c18-a569-d6d8e7ec0b9c` → receipt `r-c5cac313-…` (`11111111-…/aed0daaf-bcd6-4a2f-9f9c-d60b2ef25b49`) → approval `56dded2c-7e0c-4faf-9a45-c97c315b5301` (approved by TEST-M) → reimbursement `rb-c5cac313-7737-4c18-a569-d6d8e7ec0b9c` (awaiting_authorization)
- Upload-retry expense `2c21a120-5162-483e-9d9c-01d1d5981264` (pending, $10.00)
- Lost-response expense `1371b222-abd7-46c3-9832-1f97987223e6` (pending, $30.00)
- Cancelled submission tombstone `5acc09f4-7ed3-46fe-9322-96060768aa68` (no expense, file removed)

## Totals (Overview, after reload)
| | Before | After approval |
|---|---|---|
| Budget | $1,000 | $1,000 |
| Actual (approved) | $0 | $312 |
| Approved, unpaid | $0 | $312 |
| Remaining | $1,000 | $688 (69%) |
| Reimbursement awaiting authorization | $0 | $312 |

## Limits
- Browser file uploads go through a test-harness relay that resends the same PDF bytes to the real Storage service (Playwright drops multipart bodies otherwise). Storage, auth and access rules are real, but this does not prove the unmodified browser upload transport.
- Not re-run this pass: reload during an interrupted submission with account switching, return/resubmission stale-version in browser, file replacement / late extraction ordering.
- This is isolated-draft verification only, not hosted company readiness.
