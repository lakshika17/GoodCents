# GoodCents — AI CFO for Team Spending (PayPal Hackathon)

GoodCents helps small teams keep spending within budget and get employees repaid quickly. Employees upload receipts, AI reads them, managers approve, and Finance pays reimbursements through **PayPal Payouts (Sandbox)**.

## Try it
- **Live demo:** https://goodcents.lovable.app/demo — no login, fictional sample data.
- **Sign in with Google:** judges can sign in; accounts without an invitation see the sample workspace only.

## Features
- **AI receipt reading** — upload a photo/PDF; DeepSeek (via OpenRouter) extracts merchant, date, amount and currency, with Lovable AI as fallback. Users must verify every value before submitting.
- **Document types** — paid receipts and supplier invoices become expenses; quotes, orders and drafts never count toward spending.
- **Approval workflow** — employee submits → manager approves → Finance authorizes payment. Approval and payment are separate steps; approved never means paid.
- **PayPal Sandbox payouts** — authorizing a reimbursement sends a capped sandbox payout.
- **Budgets, dashboard and scenarios** — one tested calculation module keeps all totals consistent.
- **Secure Spend Vault (demo)** — spending limits, freeze, duplicate detection and self-approval prevention.
- **Security** — invite-only company data, server-side roles, row-level security, idempotent submissions, amounts stored in exact cents.

## Tech stack
TanStack Start (React 19, Vite 7), Tailwind CSS v4, shadcn/ui, Postgres with row-level security (Lovable Cloud), Drizzle migrations, Vitest, PayPal Payouts REST API, OpenRouter.

## Project structure
```
src/routes/        Pages (dashboard, approvals, reimbursements, demo, auth…)
src/lib/calc.ts    Financial math (tested)
src/lib/vault.ts   Spend Vault rules
src/lib/documents.ts  Document classification
src/data/          Data providers and server functions
drizzle/migrations Database schema and security policies
```

## Run locally
```sh
git clone https://github.com/lakshika17/GoodCents.git
cd GoodCents
bun install   # or npm i
bun run dev
bun run test
```
The included `.env` holds only public (publishable) backend keys. Server secrets — `OPENROUTER_API_KEY`, `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, `DEMO_PAYPAL_RECEIVER_EMAIL` — are configured as hosting secrets and are never committed.

## Team
Lakshika (Founder), Kulvardhan, Zichen, Lokesh.

Built with [Lovable](https://lovable.dev).
