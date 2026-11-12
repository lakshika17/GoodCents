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
Lakshika (Founder), Kulvardhan, Zichen.

Built with [Lovable](https://lovable.dev).

## Judge's Demo Guide

### Access and roles
- Open https://goodcents.lovable.app/demo (no login), or sign in with Google — accounts without an invitation see the same sample workspace.
- Switch roles with the **Sample data preview** selector in the top bar: Developer / Admin, Employee, Manager, Finance, Founder. Only Developer / Admin and Finance can authorize payments.

### Walkthrough
1. **Upload** — submit an expense and attach a JPG, PNG or PDF (or use the camera on mobile).
2. **AI extraction** — the file is read automatically; fields the AI can't read stay blank. Reading can take up to ~30 seconds; if it fails, enter details manually.
3. **Review** — check every field against the document. Set the document type to **Paid Receipt** or **Supplier Invoice**, currency **USD**, and tick both confirmation boxes.
4. **Submit** — "Submit for approval" stays disabled until a document is attached and all of the above are complete ("Save as draft" works anytime).
5. **Manager approval** — on **Approvals**, approve the expense. Its reimbursement becomes "Awaiting authorization" (approved is not paid).
6. **Finance payment** — as Finance, open **Reimbursements** and click **Authorize**. This sends a PayPal Sandbox payout.

### Limits and requirements
- Files: JPG, PNG or PDF, up to 10 MB.
- Currency: USD only for submission and payouts.
- Demo payouts: maximum **$1,000.00** each; larger amounts are rejected before contacting PayPal.
- Quotes, orders, customer documents and drafts are stored but never count toward spending.

### Expected results and data reset
- After approval, totals and budgets update once; after authorization, a sandbox payout appears in the receiving PayPal Sandbox Personal account (Activity).
- Demo data lives in browser memory only. Reloading or leaving the demo resets it to the sample data; the selected role is kept for the browser tab. Demo actions never touch company records.

### Check the payout in PayPal Sandbox
After authorizing a payout, sign in at [sandbox.paypal.com](https://www.sandbox.paypal.com) with the demo receiver account (PayPal **Sandbox** test account only — no real money):

- **Email:** `sb-h8y43k53707459@personal.example.com`
- **Password:** `N<Wk+c2.`

Open **Activity** to see the incoming payout. Please don't change this account's settings or password.

### What is real vs. sample
| Feature | Source |
| --- | --- |
| Team, expenses, budgets, dashboard, scenarios | Sample (fictional) data |
| Receipt reading | Real AI — DeepSeek via OpenRouter, Lovable AI fallback |
| Finance "Authorize" payout | Real PayPal **Sandbox** (test money, fixed demo receiver) |
| Secure Spend Vault | Simulation, labeled DEMO ONLY |

### Troubleshooting
- **Submit button disabled** — attach a file, choose Paid Receipt/Supplier Invoice, use USD, fill vendor/amount/date, tick both boxes.
- **AI fields blank or "reading failed"** — type the values manually; the file may be unclear, over 10 MB, or the AI timed out.
- **Payout error "less than or equal to 100000"** — the amount exceeds the $1,000 demo cap.
- **Approved but not in PayPal** — approval alone doesn't pay; authorize it on Reimbursements as Finance.
- **Blank page or stale data** — reload `/demo`.
