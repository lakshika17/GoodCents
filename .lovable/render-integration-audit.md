# Render integration audit — handoff (read-only)

Date: 2026-11-05 · Scope: inspection only. No code, schema, configuration, or data changed. No PDFs uploaded, no extraction invoked, no Airtable writes, no payments. External service reviewed from the provided description only: `https://receipt-automation-kpfs.onrender.com`, `POST /api/v1/receipts` (multipart, field `file`, `X-API-Key`), branch `chore/render-predeploy` @ 4e5cad9. **The existing endpoint is not extraction-only — it persists and syncs to Airtable — so it must not be called from this app as-is.**

## 1. Actual integration location

| Layer | File | What it does |
|---|---|---|
| Browser | `src/components/submit-expense-dialog.tsx` | `runRead()` base64-encodes the selected file (≤10 MB) and calls the `readDocument` server function with a 30 s client deadline. |
| Server function | `src/data/extraction.functions.ts` | `readDocument` (POST), guarded by `requireSupabaseAuth`; zod input: fileName, mimeType (pdf/jpeg/png), base64 ≤ 14,000,000 chars. Requires a verified (email-confirmed) sign-in plus an active employee record or development Admin. |
| Extraction implementation | `src/lib/document-extraction.server.ts` | Calls the Lovable AI Gateway (`ai.gateway.lovable.dev`) with `LOVABLE_API_KEY`, structured output against `extractionSchema`, 25 s server timeout. This is the module a Render call would replace or sit beside. |
| Server runtime | `src/server.ts` | Serverless Worker (Cloudflare workerd) fetch entry. No Node host, no Supabase Edge Functions anywhere in the project. |
| Private Storage | `private-receipts` bucket | The **browser** uploads the file directly to Storage at `{userId}/{submissionKey}` (policies in migration 0001: insert only into own folder; read own files, or approvers via `can_expense`). **No server code reads file bytes today** — the browser sends base64 to the server function. |

## 2. Runtime constraints

**Inspected in this project:**
- Client deadline 30 s; server `AbortSignal.timeout(25_000)`; file cap 10 MB; base64 cap ~10.5 MB binary.
- No background execution, queue, cron handler, or task table exists in app code. Nothing can continue processing after a response is sent.
- All npm packages must be fully bundled at build time; no runtime module resolution. A Render client is plain `fetch` — compatible.

**Unknowns (not in project config):** the hosting Worker's per-request CPU/duration ceiling and max request/response body size. The 10 MB base64 upload already works through this path in the published app, so the practical request-size ceiling is above that.

**Is a synchronous PDF request practical?** For the current AI path, yes — 25 s fits. For Render, the documented **504 = outcome unknown, processing may continue** makes a naive synchronous call unsafe: a client retry after a 504 would be a blind retry. Against the *existing* endpoint that is unacceptable (it would duplicate Render-side receipts and Airtable rows). Against a future *extraction-only* endpoint it is acceptable **only if** the endpoint is side-effect-free or honors an idempotency key.

**Smallest supported recoverable task mechanism:** none exists server-side today. The current recovery model is client-side: `ExtractionAttempt` (selection/revision guard) + `submissionKey` + `submission_status` RPC + sessionStorage pending record. If an asynchronous job pattern is wanted, task state would need a new table in this app's database (this app would own task IDs, polling, and deadlines) — that is a design addition, not an existing capability.

## 3. Field mapping

| Render `ReceiptData` | App form field | Persisted? | Notes |
|---|---|---|---|
| `merchant` | `vendor` | yes | Direct. |
| `date` | `date` | yes | Must pass `calendarDate` (strict YYYY-MM-DD); invalid → blank. |
| `receipt_number` | `documentNumber` | yes | Optional in app. |
| `currency` | `currency` | yes | App rule: only explicit, unambiguous currency; null → blank, never guessed. Only USD can enter approval. |
| `total` | `amount` | yes | Decimal string → number; must pass `moneyInCents` (exact cents, > 0). |
| `subtotal`, `tax`, `tip`, `discount`, `items` | — | no | No app fields exist. Could inform `description`, but not persisted structurally. |
| `validation.issues` | `readNote` (display) | no | Shown to the user as caution text. |
| `status: needs_review` | — | — | Must surface as "check every field", never as success. |

**Not supplied by the extractor (must stay manual):** document type (the app has 6 types; Render handles receipts only — eligibility must not be inferred from receipt text), payment responsibility, payment-evidence confirmation, category, department, project, description, and the human verification checkbox. These gates (`canSubmitForApproval`, `persistedExpense` contract) stay exactly as they are.

## 4. Correlation and recovery (current linkage)

1. File selection → `attempts.select()` (new selection revision) + new `submissionKey` UUID + form reset.
2. Extraction response applies only if `canApply(attempt)` — same selection, no edits since (`edit()` bumps the revision). Late or stale responses are discarded.
3. Submit → browser uploads file to `{userId}/{submissionKey}`, records a pending marker in sessionStorage, then `internal_action` persists expense + receipt atomically and idempotently on `submission_key`.
4. Lost response after commit → `submission_status` RPC reports `committed`; UI recovers without duplicating. Uncertain outcome → attachment left in place; explicit `cancel_expense_submission` tombstone gates cleanup so a committed expense's file can never be deleted.

**Required behavior for a Render path:** key every extraction attempt to the same `submissionKey`/selection pair; treat 504/timeout as "automatic reading unavailable — enter manually" (current fallback), never auto-retry without an idempotency key; file replacement already resets the key and discards in-flight results. Unknown extraction outcome must never create an expense — only the validated `persistedExpense` submission does that.

## 5. Security and configuration

- **Key storage:** a new server-only secret (proposed name `RENDER_API_KEY`), read via `process.env` inside the server-function handler only — never `VITE_`-prefixed, never returned to the browser. Current `.env` contains only Supabase variables; no Render config exists.
- **Ownership before forwarding bytes:** two viable designs —
  - (a) *Keep the current shape:* the browser sends base64; the server function's auth middleware + employee check already authorize the caller. No Storage read needed.
  - (b) *Server reads from Storage:* use `context.supabase` (the caller's own RLS-scoped client — the `receipt_file_read` policy enforces ownership), validate the path is exactly `{context.userId}/{submissionKey}`. Never use `supabaseAdmin` for this read.
- The existing endpoint's Airtable sync conflicts with the standing rule that unconfirmed AI results must never reach company records — another reason it cannot be called as-is.

## 6. Proposals for the Python developer (proposals, not agreed contract)

1. **Extraction-only endpoint**: `POST` multipart `file`, `X-API-Key`; returns `ReceiptData` + structured `validation.issues`; **no persistence, no Airtable sync, no notifications**.
2. **Idempotency**: accept an `Idempotency-Key` header (this app would send `submissionKey`); repeated keys return the same result without re-processing side effects.
3. **Latency**: synchronous with p95 ≤ 20 s, or job-based (`task_id` + status poll). If job-based, this app owns polling and deadlines.
4. **Semantics**: 200 with `needs_review` ≠ success; unknown fields are null; amounts stay decimal strings; no currency guessing; no silent defaults.
5. **Errors**: distinct codes for unsupported type, unreadable document, rate limit, and internal failure; 504 reserved for unknown outcome with a retrievable task ID.

## 7. Unresolved dependencies / essential questions

- The extraction-only endpoint's path, contract, and availability — **not implemented or agreed yet** (Python developer to provide).
- Who issues and rotates the Render API key, and confirmation it may be stored as a Lovable server secret.
- Whether Render may receive company receipt images at all (privacy/retention/region) — unanswered from the earlier checklist.
- Hosting Worker request-duration and body-size ceilings — not documented in this project; the 10 MB path works in practice.
- Whether the existing `/api/v1/receipts` endpoint's Airtable sync will ever be wanted for *confirmed* expenses — currently out of scope and against standing rules.
