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
