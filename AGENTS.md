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
- Workbook directory fixtures live in a shared browser-safe module; sample spending tracks reference its employee and department IDs while preserving deterministic financial values independently of display names.
- Development Admin authorization is owner-provisioned separately from employee roles and requires a revalidated, confirmed account; it opens the fictional provider only, never company finance permissions.
- Uploaded documents are classified by type in `src/lib/documents.ts`; only paid receipts and supplier invoices become expenses, others (quotes, orders, customer documents, drafts) are stored separately and never affect spending — keeps approval queue and totals limited to real spending evidence.
- Document AI reading runs only in an authenticated server function for verified employees or development Admins; results are suggestions that users must verify — keeps the AI key server-side and prevents unverified data from reaching approvals.
