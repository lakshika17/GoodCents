# Receipt acceptance — gap closure (isolated draft)

Date: 2026-11-04 · Environment: this draft's own local backend (127.0.0.1:8001). Company records untouched. Payments disabled. No live extraction calls (the app's automatic-reading request is blocked in tests; no fake results are injected).

## 1. PDF upload through the unmodified browser path — PASS (with one stated environment difference)
- Previous relay (Playwright re-sending the PDF) is **not used**. Playwright now intercepts nothing on Auth/REST/Storage.
- Browser traffic goes through a plain network pass-through (`/tmp/browser/relayfree/proxy.mjs`) standing in for the preview's `/_port_8001` forwarding: request bodies are piped byte-for-byte; it only strips `/_port_8001` from the path.
- Observed browser upload: `POST /storage/v1/object/private-receipts/1111…/13a360d8-8f4b-4c16-ad14-7e470d3166c2`, `multipart/form-data; boundary=----WebKitFormBoundary…` (Chrome's own encoder), 1015 request bytes → **200**. Stored object: 716 bytes, `application/pdf`, owner = Employee A. Owner download from the browser: 716 bytes.
- **Environment difference found:** the local Storage service sends CORS headers on preflight but **not** on the actual upload response. Without help, Chrome blocks the response, the app treats the upload as failed and no expense is created (reproduced 3 times; left 3 unreferenced files in this draft). The pass-through therefore adds `Access-Control-Allow-Origin: *` to responses that lack it — it changes no request. The hosted service is expected to send this header itself; **this was not checked on the hosted setup**.
- Manual check still pending on the real preview: sign in as a fictional employee → Submit Expense → upload a small PDF → submit → reload Expenses → the expense shows and its attachment opens. In browser dev tools, the Storage upload request should be `multipart/form-data` with status 200 and no CORS error.

## 2. Exact persisted accounting — PASS
Database (cents, directly from stored rows): approved **31238**, approved-unpaid **31238**, remaining **68762** (100000 − 31238), paid reimbursements **0**. Pending expenses (1000, 3000, 1234) are excluded.
App calculation: new test in `src/lib/calc.test.ts` feeds the same values to `summarize()` and asserts 31238 / 31238 / 68762 cents and remaining exactly 687.62. Overview shows $312 / $688 because the display rounds to whole dollars; that rounding is display-only (`money()`) and is not used in the calculation.

## 3. How the approved expense became verified — established; fresh submission PASS
- Expense `c5cac313-…` was verified by the browser test ticking the dialog's "I verified these details", "Payment evidence confirmed" and choosing "I personally paid" (`fill()` in the test script). `confirmedBy` = Employee A and `confirmedAt` 20:16:25 were written by the server at submission. The activity log shows only one submission by Employee A and one decision by approver TEST-M; no direct field edits. The earlier forged-status probe changed 0 rows.
- Fresh submission now, normal UI, no database writes by the test: expense `f855eaa4-988a-49a1-a8dc-f9b7597ff812`, 1234 cents, USD, employee_paid, verified true, confirmedBy Employee A, confirmedAt 2026-11-04T20:48:08Z (server time), receipt `r-f855eaa4-…` → stored file above. Visible after reload. Left pending (not approved).

## Changes
- `src/lib/calc.test.ts`: one exact-cents acceptance test. No product code, permission or schema changes.
- Tests: `bunx vitest run` 51/51 passed. Integration harness not re-run (no database or product code changed).

## Remaining limitations
- Hosted Storage CORS behaviour and the real preview forwarding are unverified (manual steps above).
- 3 orphan files from the CORS-blocked attempts remain in this draft. Each was a new dialog, so in-session recovery didn't apply. This shows that when the upload succeeds but its response is lost and the user closes and reopens the dialog, the file is left behind with no cleanup. That's a real gap, but it's outside this scope.
- Not re-run: account switching during an interrupted submission, return/resubmission in browser, file replacement during reading.

---

# Render integration checklist (preparation only — nothing called)

Nothing in this project mentions Render or Airtable: no endpoint, secret, code, or notes. Today reading goes through the app's own AI service (`src/lib/document-extraction.server.ts`). Every item below is **missing information** unless marked otherwise.

| Item | Known now | Needed from you |
|---|---|---|
| Endpoint | None | Exact Render URL + path, method, staging vs production URL |
| Authentication | None | Scheme (API key header / bearer / signed request), header name, who issues and rotates it, where to store it (server secret only) |
| Request | App can send fileName, mimeType, file bytes (≤10 MB, PDF/JPG/PNG) | Accepts base64 JSON, multipart, or a signed file link? Size limit? Extra fields (company, user ID)? |
| Response mapping | App needs: documentType (6 types), counterparty, amount, currency (ISO, null if not printed), date (YYYY-MM-DD), documentNumber, notes | Render's field names, types, a sample success and error body, how "unknown" is represented |
| Validation issues | App rejects: non-calendar dates, amounts not exact to cents, guessed currency (bare "$" ≠ USD), unknown document types | Does Render default currency, round amounts, or return confidence scores? Any field that can't be null? |
| Timeout / recovery | App waits 30 s (server 25 s), then falls back to manual entry. Late answers are discarded after file change or user edit | Typical and max processing time; sync or job-based (job ID + polling/webhook)? Retry-safe (idempotency key)? Rate limits and error codes |
| Airtable sync | Not present in this project | What syncs (expenses? receipts? directory?), direction, which side is source of truth, base/table IDs, trigger (Render or this app), conflict and duplicate rules, whether unconfirmed AI results may ever reach Airtable (current rule: they must not) |
| Privacy | Receipts are private per employee | Does Render store files? Retention, region, and whether it may receive company receipts |

Rules that must not change: AI results stay suggestions until a person confirms; only USD paid receipts/supplier invoices with employee-paid evidence become reimbursements; payments remain disabled.
