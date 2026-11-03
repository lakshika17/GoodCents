import { describe, expect, it } from "vitest";
import { releaseBlockers, vaultSummary, type VaultPayment, type VaultSettings } from "./vault";

const s: VaultSettings = { allowance: 10000, dailyLimit: 2000, perTransactionLimit: 1500, frozen: false };
const paid = (id: string, amount: number, date = "2026-11-03"): VaultPayment => ({ id, kind: "reimbursement", refId: id, payeeId: "EMP-005", payeeName: "L", amount, date, status: "completed", sandboxReference: "S", authorizedBy: "EMP-001", note: "" });
const base = { settings: s, payments: [] as VaultPayment[], amount: 100, refId: "rb-1", today: "2026-11-03", payeeId: "EMP-005", authorizerId: "EMP-001", canAuthorize: true };

describe("secure spend vault", () => {
  it("allows a valid release by an authorized person", () => expect(releaseBlockers(base)).toEqual([]));
  it("blocks unauthorized people", () => expect(releaseBlockers({ ...base, canAuthorize: false }).length).toBeGreaterThan(0));
  it("blocks paying yourself", () => expect(releaseBlockers({ ...base, authorizerId: "EMP-005" })).toContain("You cannot authorize a payment to yourself."));
  it("separates approval from payment authorization", () => expect(releaseBlockers({ ...base, approverId: "EMP-001" })).toContain("The manager who approved this cannot also authorize its payment."));
  it("blocks when frozen", () => expect(releaseBlockers({ ...base, settings: { ...s, frozen: true } })).toContain("New payments are frozen."));
  it("enforces per-transaction limit", () => expect(releaseBlockers({ ...base, amount: 1500.01 })).toContain("Exceeds the per-transaction limit."));
  it("enforces daily limit", () => expect(releaseBlockers({ ...base, payments: [paid("a", 1000), paid("b", 950)], amount: 100 })).toContain("Exceeds today's spending limit."));
  it("daily limit resets on another day", () => expect(releaseBlockers({ ...base, payments: [paid("a", 1000, "2026-11-02"), paid("b", 950, "2026-11-02")], amount: 100 })).toEqual([]));
  it("enforces allowance", () => expect(releaseBlockers({ ...base, settings: { ...s, allowance: 50 } })).toContain("Exceeds the remaining spending allowance."));
  it("prevents duplicate payments", () => expect(releaseBlockers({ ...base, payments: [paid("rb-1", 10, "2026-11-01")] })).toContain("Already paid — duplicate payment blocked."));
  it("available = allowance − paid − reserved", () => expect(vaultSummary(s, [paid("a", 1000)], 500).available).toBe(8500));
});
