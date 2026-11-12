<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All financial pages read/write via `useStore()`; internal data uses authenticated server functions and database authorization, while the explicit hackathon demo uses isolated in-memory fixtures — preserves one page-facing contract without mixing records.
- Keep workbook directory data separate from immutable server-managed user roles; enforce access and atomic audited mutations in database functions and RLS — browser controls never grant authority.
- Financial content remains hidden by the central provider until a verified employee session loads; public auth, recovery and demo-entry screens bypass the app shell — prevents pre-login financial rendering.
- Financial math lives in pure functions in `src/lib/calc.ts` with tests — dashboard, budgets and scenarios must agree.
- Approval status and reimbursement status are separate fields; approved never implies paid.
- Sample-data preview personas are defined in a pure configuration module and only affect the in-memory demo provider; displayed workbook employee identities never assign backend roles or grant access to company records.
- Sample directory fixtures live in the existing browser-safe module; every financial track and preview must reference an existing sample employee, and identity changes preserve RNG order and aggregate financial values — avoids orphaned records without affecting authenticated identities.
- Development Admin authorization is owner-provisioned separately from employee roles and requires a revalidated, confirmed account; it opens the fictional provider only, never company finance permissions.
- Uploaded documents are classified by type in `src/lib/documents.ts`; only paid receipts and supplier invoices become expenses, others (quotes, orders, customer documents, drafts) are stored separately and never affect spending — keeps approval queue and totals limited to real spending evidence.
- Internal document AI reading requires verified employee authorization; public demo reading uses a separate upload-only function with no database or storage access, sharing the server-only extractor — preserves company isolation while returning suggestions requiring verification.
- Secure Spend Vault rules (limits, freeze, duplicate and self/approver separation) live in pure `src/lib/vault.ts`; the sample-data vault state is in-memory and labeled DEMO ONLY until a server-enforced backend and PayPal sandbox exist — prevents implying real funds or browser-enforced security.
- New persistent expense submissions use a shared validated document contract, actor-scoped database idempotency and exact cents; confirmation identity/time and versions are server-derived, while cancellation tombstones guard attachment cleanup against delayed commits.
- Extraction responses are gated by document selection and edit revisions with bounded deadlines; unknown values remain blank so older files and late responses cannot silently confirm new information.

- Persist editable documents separately from submitted expense revisions; immutable revision snapshots and atomic assigned-manager transitions preserve review history without creating payable drafts.
- Extraction job creation and envelope writes are service-only RPCs after employee authorization and owner-scoped byte reads; browser RPCs cannot establish trusted extraction results.
- Persist a service-only dispatch claim before the first extraction POST; subsequent starts and uncertain outcomes only check the same request UUID, preventing automatic redispatch after reload or concurrency.
- Uninvited signed-in accounts fall back to the in-memory sample provider; the server's employee check remains the only path to company data — lets judges sign in with Google safely.
- Demo Finance authorization sends a capped PayPal Sandbox payout to the DEMO_PAYPAL_RECEIVER_EMAIL secret via a public no-database server function — browser never chooses the receiver.
