import { describe, expect, it } from "vitest";
import { balanceAt, budgetSpent, projectScenario, summarize } from "./calc";
import type { Budget, Expense, Reimbursement } from "@/data/types";

const b: Budget = { id: "b", name: "B", departmentId: "d", projectId: null, ownerId: "o", amount: 1000, period: "", history: [] };
const ex = (id: string, amount: number, s: Expense["approvalStatus"]): Expense => ({ id, employeeId: "e", vendor: "V", amount, date: "2026-10-01", category: "Office", departmentId: "d", projectId: null, description: "", receiptId: null, approvalStatus: s, submittedAt: "" });

describe("budget calculations", () => {
  it("counts only approved expenses as spent", () => {
    expect(budgetSpent(b, [ex("1", 100, "approved"), ex("2", 50, "pending"), ex("3", 30, "rejected")])).toBe(100);
  });
  it("treats approved but unpaid as unpaid", () => {
    const r: Reimbursement[] = [{ id: "r", expenseId: "1", employeeId: "e", amount: 100, status: "paid", paypalReference: null, authorizedBy: null, history: [] }];
    const s = summarize([b], [ex("1", 100, "approved"), ex("2", 40, "approved")], r);
    expect(s.approvedUnpaid).toBe(40);
    expect(s.remaining).toBe(860);
  });
  it("projects buy-now vs next month", () => {
    const now = projectScenario({ balance: 5000, dailyBurn: 10, amount: 2000, strategy: "now", splitParts: 1 });
    const later = projectScenario({ balance: 5000, dailyBurn: 10, amount: 2000, strategy: "next_month", splitParts: 1 });
    expect(balanceAt(now, 0)).toBe(3000);
    expect(balanceAt(later, 0)).toBe(5000);
    expect(balanceAt(later, 30)).toBe(2700);
    expect(balanceAt(now, 90)).toBe(balanceAt(later, 90));
  });
});

describe("acceptance totals stay exact in cents", () => {
  it("$312.38 approved and awaiting reimbursement against a $1,000 budget", () => {
    const r: Reimbursement[] = [{ id: "rb", expenseId: "a", employeeId: "e", amount: 312.38, status: "awaiting_authorization", paypalReference: null, authorizedBy: null, history: [] }];
    const s = summarize([b], [ex("a", 312.38, "approved"), ex("p1", 10, "pending"), ex("p2", 30, "pending"), ex("p3", 12.34, "pending")], r);
    expect(Math.round(s.actual * 100)).toBe(31238);
    expect(Math.round(s.approvedUnpaid * 100)).toBe(31238);
    expect(Math.round(s.remaining * 100)).toBe(68762);
    expect(s.remaining).toBe(687.62);
  });
});
