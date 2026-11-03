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
- All pages read/write demo state only via `useStore()` in `src/data/store.tsx`; integration stubs live in `src/data/api.ts` — keeps the backend swap to one layer.
- Financial math lives in pure functions in `src/lib/calc.ts` with tests — dashboard, budgets and scenarios must agree.
- Approval status and reimbursement status are separate fields; approved never implies paid.
