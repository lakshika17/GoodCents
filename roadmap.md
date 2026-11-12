# Payment module milestone (isolated draft) — complete

## Receipt AI provider change
- [x] Remove Gemini calls; use existing DeepSeek primary and Lovable AI fallback without changing approval or access rules.
- [x] Verify provider ordering, fallback and cancellation: 89 regression tests passed; both providers read fictional USD 19.87 receipt correctly, and the signed-out demo upload populated its fields. Compilation passed; company records and payment settings untouched.

## GoodCents team cleanup and API costs
- [x] Replace visible sample identities with Lakshika (Founder), Kulvardhan, Zichen and Lokesh (Employees), preserving company records and internal identifiers; Zichen email left blank.
- [x] Verify sample references and unchanged totals with 83 tests; public demo desktop/mobile shows four requested identities with no runtime errors.
- [x] Check recorded AI credit usage (0.24459 credits across two November 12 requests) and verify direct OpenRouter/Gemini free-tier setup guidance; no provider switched.

- [x] Read PayPal Payouts docs (payouts-post, payouts-item-get, authentication)
- [x] Migration 0010 (+0011 fix): payment_intents, payout_recipients, status widening, finance RPCs, notifications
- [x] PayPal server module (OAuth, create payout, get item; sandbox-only origin)
- [x] Server functions: authorizePayment, checkPaymentStatus, same-identity recovery
- [x] UI: Finance confirmation + dispatch, status views, employee view, notifications
- [x] Unit/mocked tests: 79/79 unit, 38/38 API checks
- [x] Secrets saved via secure form
- [x] One real sandbox payout: rb-a0c2aeb1, $19.87, item SUCCESS (txn 3WK03536PJ550571X), independently verified
- [x] English report: .lovable/payment-module-report.md + Files copy

Open (blocked on platform, not code): hosted HTTPS preview UI acceptance — manual steps in report.

## Public demo AI reading
- [x] Add isolated upload-only reading and preserve internal authorization.
- [x] Verify signed-out PNG upload: Sample Stationery Shop, USD 19.87, TEST-101, 2026-11-12; all 82 regression tests pass. PDF/JPEG types validated; live PDF/JPEG reading not separately exercised.
- [x] Explain separate OpenRouter credits and public-demo privacy/cost limitations; OpenRouter not connected and no server-enforced public request limit claimed.
