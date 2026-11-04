import { describe, expect, it } from "vitest";
import { canSubmitForApproval, isExpenseEligible } from "./documents";
import { recommend } from "./calc";
import type { Expense } from "@/data/types";

const ok = { vendor: "Stockwell Elastomerics", amount: 312.38, date: "2026-10-07", verified: true, currency: 'USD', paymentResponsibility: 'employee_paid', paymentEvidenceConfirmed: true };

describe("document eligibility", () => {
  it("only paid receipts and supplier invoices enter the approval queue", () => {
    expect(isExpenseEligible("Paid Receipt")).toBe(true);
    expect(isExpenseEligible("Supplier Invoice")).toBe(true);
    for (const t of ["Vendor Quote", "Purchase Order", "Customer Invoice", "Customer Purchase Order"] as const) expect(isExpenseEligible(t)).toBe(false);
  });
  it("a vendor quote can never be submitted for approval", () => {
    expect(canSubmitForApproval({ ...ok, documentType: "Vendor Quote" })).toBe(false);
  });
  it("an eligible document needs verified details before approval", () => {
    expect(canSubmitForApproval({ ...ok, documentType: "Paid Receipt", verified: false })).toBe(false);
    expect(canSubmitForApproval({ ...ok, documentType: "Paid Receipt", amount: null })).toBe(false);
    expect(canSubmitForApproval({ ...ok, documentType: "Paid Receipt" })).toBe(true);
    expect(canSubmitForApproval({ ...ok, documentType: "Paid Receipt", currency: "EUR" })).toBe(false);
  });
  it("never recommends approving unverified details", () => {
    const e: Expense = { id: "x", employeeId: "EMP-005", vendor: "V", amount: 10, date: "2026-10-07", category: "Office", departmentId: "DEP-005", projectId: null, description: "", receiptId: null, approvalStatus: "pending", submittedAt: "", verified: false };
    expect(recommend(e, { duplicate: false, issues: [], available: 1000 }).action).toBe("review");
    expect(recommend({ ...e, verified: true }, { duplicate: false, issues: [], available: 1000 }).action).toBe("approve");
  });
});
