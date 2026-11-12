# Three-role approval milestone — isolated draft

## Scope and isolation
Only this draft's fictional accounts and records were used. No publish, acceptance, company-record writes, PayPal/payment calls, Airtable synchronization or outbound notifications ran. Render calls were blocked during browser acceptance; fields were entered manually. Existing terminal extraction requests were reused in controlled database checks without calling Render.

## Confirmed defects and changes
- Authenticated legacy extraction RPCs could establish a forged first trusted envelope. Migration 0007 revokes those calls, adds service-only trusted writers, and preserves owner-scoped byte reads in authenticated server handlers.
- Draft recovery relied on browser storage. Owner-scoped persistent document drafts now restore the selected document/form after logout/login, clearing confirmation. Save Draft is distinct from Submit for Approval.
- Migration 0008 adds workflow state, immutable submitted revision snapshots and atomic assigned-manager decisions/resubmissions. Return needs a reason; current version is checked; approved records cannot be edited through resubmission; duplicate decisions do not duplicate reimbursements.
- Finance is a distinct UI role sourced from server-maintained roles, not an admin impersonation. Internal payment authorization is blocked and its button removed.
- File selection/edit guards also protect delayed draft recovery and upload association. Saved results must persist successfully before being returned as trusted extraction output.
- Existing idempotent expense creation and private storage ownership were retained, not weakened.

Recorded changes: `0007_trusted_extraction_and_drafts`, `0008_three_role_revision_transitions` in the migration journal. Accepting applies these structural changes automatically; draft test rows do not transfer. This draft has not been accepted.

## Actual results
### Live authenticated browser (fictional accounts)
PASS: employee submission and reload; different assigned manager returns with reason; employee sees reason and edits amount/vendor; renewed confirmation; resubmit same logical expense revision 2; stale version rejected; manager approves; employee sees approved-awaiting-payment; Finance sees approved amount/currency/employee/source revision with no authorize button.
PASS: independent straight submit/approve flow; Finance refresh reads that expense.
PASS: Save Draft, sign out, sign in, Open Draft restores exact vendor/amount and PDF; verification and payment-evidence confirmation are unchecked.
Browser storage used the existing byte-preserving local proxy due sandbox CORS constraints. This is not relay-free hosted-preview upload acceptance.

### Controlled authenticated API checks
20/20 passed against the local draft backend: exact revision amounts, two preserved revisions, concurrent original submission retries create one logical expense, duplicate approval calls preserve one return + one approval, one reimbursement, stale and conflicting decisions rejected, approved edits rejected, self-approval and finance-as-manager rejected, payment transition denied, legacy and trusted extraction writer calls denied to employee, other employee isolation, finance approved-only expense reads, no paid states, invalid credentials denied, three service-authorized concurrent starts reuse the existing persisted document request.
The concurrent start check reuses an existing fictional job and performs no live extraction. It validates database identity reuse, not multi-tab live Render transport.

63/63 existing unit tests passed after workflow changes. The final recovery-guard change reran affected extraction-attempt, expense-contract and action-schema checks (see execution output). Legacy disposable PostgreSQL harness: 32/32 passed; that harness covers migrations 0000/0001/0004, not the new transitions. The 20 draft API checks cover the new transitions instead. Final affected checks: 17/17 passed. Latest automatic build at 05:43:42 UTC passed. Final Finance page was inspected after its distinct role change.

## Linked evidence and accounting
Returned flow expense `a0c2aeb1-d120-4d59-80a5-2fa70b855c59`; receipt `r-a0c2aeb1-d120-4d59-80a5-2fa70b855c59`; return decision `8bee21bf-fe23-452b-8dc5-2e65d305d42b`; approval `652e34c2-70fc-4496-aa19-0f6807b5d23a`; reimbursement `rb-a0c2aeb1-d120-4d59-80a5-2fa70b855c59`, source revision 2, awaiting_authorization. Revision 1 = 2123 cents; revision 2 = 1987 cents. Returned state had no reimbursement.
Straight-flow expense `c80d9228-36f9-40a4-9c59-e091c110838b` = 1011 cents, revision 1.
Before the first pair: approved/unpaid = 39492 cents; after the first pair: 42490 cents. A recovery script imported the browser script before its main guard was added, unintentionally executing a second pair of fictional approval flows: expenses 188562ca-70be-487a-a8a7-816f47b5a8b9 (1987 cents) and 14b3dbb0-7d7d-4b3d-893f-cec0c4a7120e (1011 cents). These are separate submissions, not duplicate retry records. Final approved/unpaid = 45488 cents; aggregate increase 5996 cents; paid = 0. For the fictional 100000-cent budget, remaining moved 60508 → 54512 cents. The test-script main guard now prevents import side effects. Earlier unrelated fictional pending rows remain; they are not counted as new approved spending.
Screenshots inspected: submitted, manager decision, employee awaiting-payment, Finance approved rows, logout/login draft restoration. Screenshots live under temporary browser evidence paths and are not durable user deliverables.

## Business/database mapping
| Meaning | Storage/state |
|---|---|
| Draft | document_drafts; not an expense or manager queue entry |
| Awaiting manager | expenses.workflow_state=awaiting_manager; approval_status=pending |
| Returned | workflow_state=returned; approval_status=changes_requested |
| Approved awaiting payment | workflow_state=approved_awaiting_payment; approval_status=approved; reimbursement.status=awaiting_authorization |
| Rejected | workflow_state=rejected; approval_status=rejected |
Extraction states remain independent. Approval does not mean paid.

## Manual three-role acceptance
Preview: https://id-preview-1--0f74dc14-d6c8-4284-a4cf-55c82c3fd3e6.lovable.app
1. Use the isolated Employee A account; upload a fictional receipt. Choose Paid Receipt, enter values, employee-paid responsibility, and check evidence plus human confirmation. Save as Draft first: verify it is not in the manager queue. Sign out/in and Open Draft; confirm again and Submit for Approval.
2. Sign in as the isolated assigned manager, open Approvals, select the expense, enter a reason and Request Changes.
3. Employee opens My Approvals, edits returned details, enters a response, reconfirms and Resubmits. Reload: same logical expense, new revision.
4. Manager reloads and approves current revision. A previously loaded old version must be rejected.
5. Employee reloads: Approved — awaiting payment. Isolated Finance opens Reimbursements: matching amount/currency/employee/source revision; no payment action. Do not use Demo preview for this acceptance.
No passwords included. Existing isolated accounts must be supplied through the project's authorized account access, not real company invitations.

## Remaining limitations
- Relay-free PDF upload on the actual HTTPS preview remains pending; sandbox upload used the local byte-preserving proxy.
- Multi-tab UI concurrent starts, interrupted-submit account switching, file replacement with deliberately delayed transport, and new trusted-writer transport failure scenarios were not executed in this milestone. Pure revision-guard tests and controlled identity reuse are not substitutes.
- No fresh live Render needs_review/failed/unknown or timeout calls; prior mocked transport tests are retained.
- No inactive-account fixture or development-Admin account was used for a fresh browser rejection check; authorization source requires active verified employee/manager and removes the extraction Admin bypass.
- No payment workflow, synchronization, production-readiness or comprehensive security certification is claimed.
