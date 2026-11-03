# AI CFO — Intelligent Budgeting & Expense Automation (Frontend Demo)

A fully navigable, responsive app with fictional data, demo role switching, and clear "Demo / Not connected" labels on every simulated AI, database, or PayPal action. No backend or real payments.

## Design
- White and smoke-gray surfaces, deep plum primary, lavender highlights, thin borders, minimal shadows.
- Fonts: Sora (headings) + Manrope (body). Recharts for charts, shadcn tables/cards.
- Collapsible icon sidebar on desktop; sheet drawer + bottom quick actions on mobile.
- Top bar: role switcher (Employee / Manager / Admin), notification bell, "Submit Expense" button.

## Screens (one page each)
1. **Overview** — KPI cards (allocated, actual, approved-unpaid, pending, remaining), monthly trend, spend by department, utilization bars, recent transactions, upcoming commitments, reimbursement status. Filters: month, department, project, status. All derived from the sample transactions.
2. **Budgets** — create/edit budgets, allocate to department/project, set owner, budget vs actual, overspend flags, history log.
3. **Expenses** — filterable table; Submit Expense dialog: upload JPG/PNG/PDF or camera capture, manual entry, labeled "Simulated extraction" preview, editable fields, submit. Note on future WhatsApp / Google Chat / SMS intake.
4. **Approvals** — queue with receipt preview, available budget, duplicate warning, policy check, labeled AI recommendation + reasoning; Approve / Reject / Request changes with comment. Employees see decisions and can respond.
5. **Purchase Negotiator (optional)** — prompt input, fictional quotes labeled "Example quotes — not live", comparison, delivery, budget fit, savings, select option.
6. **Financial Time Machine (optional)** — amount, department/project, buy now vs later vs split; 30/60/90-day projected balance chart; assumptions listed; never changes real budget.
7. **AI CFO Assistant** — chat UI with suggested questions answered from sample data; unsupported questions get a clear "needs live AI backend" reply.
8. **Reimbursements** — PayPal-style center; statuses Awaiting authorization / Queued / Processing / Paid / Failed; "Authorize payout" admin-only with confirm dialog, labeled demo; history and transaction references.
9. **Employees & Departments** — CRUD for employees, departments, roles, manager links, projects, project-department links.
10. **Settings** — approval policies (thresholds, categories), integration status panel (all "Not connected").
- **Notification center** — dropdown covering all listed event types, driven by demo state.

Role visibility: employees see their own expenses/reimbursements; managers see their department; admins see everything.

## Technical details
- `src/data/types.ts` mirrors entities: departments, employees, projects, project_departments, budgets, expenses, approvals, receipts, purchase_requests, vendor_quotes, financial_scenarios, reimbursements, notifications. Approval status and reimbursement status are separate fields.
- `src/data/seed.ts` fictional dataset; `src/data/api.ts` centralized async data-access layer (later swapped for backend calls); demo state in a zustand-like React context store in memory.
- `src/lib/calc.ts` pure budget/scenario calculations with vitest tests (remaining budget, approved ≠ paid, scenario projections).
- Routes under `src/routes/` per section with unique head() metadata; `/` is Overview.
- No secrets, no live API calls.

## Deliverable summary
After building: what works, what's simulated, what the backend teammate must implement, open decisions.
