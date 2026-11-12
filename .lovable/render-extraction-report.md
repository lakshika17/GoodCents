# Render extraction integration — implementation and verification report

Date: 2026-11-05 · Scope: employee receipt-extraction and confirmation flow in the isolated draft. Payments, Airtable synchronization, notifications, and approval initiation remain disabled and untouched. The Render service was not modified.

## 1. What was built

**Contract source:** `docs/EXTRACTION_API_HANDOFF.md` on branch `feature/extraction-jobs` of `Zichen2505/receipt_automation` (read in full before implementing).

**Database (this draft only, migrations 0005 and 0006):**
- `extraction_jobs` table: persisted attempt per document version — `request_id` (canonical lowercase UUID, also the Idempotency-Key), owner, submission key, private storage path, SHA-256 of the exact PDF bytes, status, and the immutable extraction envelope. `UNIQUE(owner_id, submission_key)` makes concurrent clicks, tabs, and refreshes reuse the same attempt. RLS: owners can only read their own rows; writes go through security-definer functions.
- `begin_extraction(...)`: validates the employee, the storage path ownership, and the PDF hash; reuses the existing attempt for the same document version or creates it atomically under an advisory lock.
- `save_extraction_snapshot(...)`: stores the envelope; once a terminal snapshot (completed/needs_review/failed/unknown) exists, later writes are ignored — the snapshot is immutable.
- `expenses.extraction_request_id`: links a confirmed expense to its source extraction. `internal_action` re-checks that the referenced request belongs to the submitting user and the same submission key.

**Server-only connection (never in the browser):**
- `src/lib/extraction-api.server.ts`: POST `/api/v1/extractions` (multipart, exactly one `file` field, original stored bytes, `X-API-Key` + `Idempotency-Key`) and GET `/api/v1/extractions/{id}`. 401/4xx map to rejected; 429/5xx/timeouts/connection loss map to uncertain — the persisted request is preserved and checked, never blindly reposted. A GET 404 never spawns a replacement request.
- `src/data/extraction.functions.ts`: `startExtraction` (downloads the stored PDF through the caller's own access rules, hashes it, persists/reuses the attempt, dispatches) and `getExtractionStatus` (ownership check against the persisted job before every proxied query). Both require a verified sign-in plus an active employee record or development Admin.
- Secrets: `EXTRACTION_API_BASE_URL` and `EXTRACTION_API_KEY` are server-only environment values; no `VITE_` variant exists.

**Browser flow (`submit-expense-dialog.tsx`):**
- PDF selected → uploaded to private storage → extraction starts → polled every ~2–3.5 s with jitter, bounded to ~2 minutes of foreground waiting.
- completed/needs_review: the five fields (merchant, date, receipt number, currency, total) populate from the snapshot; the total keeps its exact decimal string; validation issues are shown for needs_review; unknown values stay blank — no invented zeros or default currencies.
- failed/unknown: truthful message, polling stops, manual entry remains available.
- Refreshing or reopening the dialog resumes via the persisted request (sessionStorage pointer + storage download + `begin_extraction` reuse).
- Stale responses after edits, document replacement, or confirmation are discarded by the existing selection/revision guard; terminal snapshots cannot be overwritten server-side.
- Confirmation is the existing verified submission: server re-checks ownership, version, required fields, and monetary validity; repeated confirmation stays idempotent. Confirmation saves a reviewed draft — it does not initiate approval, payment, Airtable sync, or notifications.

## 2. Verification results

**Simulated transport tests (no live calls), `src/lib/extraction-api.test.ts` + `extraction-map.test.ts` — 12 checks, all pass:**
- Key and Idempotency-Key sent server-side; 202 queued envelope parsed.
- 401 → rejected (no retry); 429/5xx/network failure → uncertain (request preserved); unparseable body → uncertain (no fabricated result).
- GET 404 → not_found without replacement; terminal failed envelope parsed truthfully; timeout → uncertain.
- Field mapping preserves decimal strings (`"12.30"` stays a string), keeps unknown currency/date blank, rejects invalid calendar dates, maps null data to blank fields.

**Live integration checks (real app ↔ real Render service, fictional PDFs, fictional .invalid accounts):**

| Check | Result | Evidence |
|---|---|---|
| Invalid/missing credentials rejected | PASS | Live: HTTP 401 `unauthorized` for wrong and missing key |
| Unauthenticated server-function call rejected | PASS | `Unauthorized: No authorization header provided` |
| Account without employee record rejected | PASS | `Automatic reading is not available for this account.` |
| Upload → extraction → display | PASS | Note "Read by AI — check every field against the document."; fields filled: merchant `Fictional Stationery Co …`, total `12.30`, USD, receipt number, date 2026-11-05 |
| Correction tracked separately | PASS | Source line "AI-extracted, corrected by you"; snapshot kept original merchant while the expense kept the corrected one |
| Confirm → persist → reload | PASS | Expense `a79f8111-c357-481e-a0ec-246a108357be`, 1230 cents, source `ai_corrected`, `extraction_request_id` `9cc49bd5-a329-40d6-ae73-23c0d545b637`; visible after reload |
| Double-click submit | PASS | Exactly one expense for the submission |
| Reload mid-extraction → reopen resumes same request | PASS | Same `request_id` `9053ffbf-7942-47b8-9b5c-122ee45f6a9a` before/after reopen; exactly 1 job for the document |
| Snapshot immutable after terminal state | PASS | Forged overwrite attempt ignored; stored merchant unchanged |
| Employee B cannot read or proxy Employee A's job | PASS | 0 rows under RLS; proxied status → `Extraction request not found.` |
| No extraction key in browser traffic | PASS | Network tap: zero browser requests to the Render host, zero `X-API-Key` headers |
| No approval/payment/Airtable triggered | PASS | Expense stays `pending`; no approval, reimbursement, or external sync created |

**Regressions:** 63/63 unit tests pass; isolated PostgreSQL harness 32/32 checks pass; build OK.

**Not executed live (covered by simulated tests only):** needs_review, failed, and unknown display states (the live service returned completed for both fictional PDFs); 502/timeout preservation (no transient failure occurred during the live runs).

## 3. Environment and limits

- All verification ran in this draft's isolated backend with fictional accounts and documents; company records were untouched and payments remain disabled.
- Browser storage uploads in this sandbox still pass through the byte-preserving local proxy (the sandbox storage service omits a CORS header on upload responses); hosted preview behavior should be spot-checked after merge.
- This is isolated-draft verification, not hosted company readiness.

## 4. Acceptance path for the reviewer

1. Open the draft preview, sign in as `employee-a@receipt-test.invalid` (fictional test account).
2. Expenses → Submit Expense → upload a PDF receipt.
3. Watch "Reading document with AI…" resolve to populated fields; correct any field; choose the document type and payment responsibility; tick both confirmations; Submit for approval.
4. Reload — the expense persists with its receipt and extraction reference.
