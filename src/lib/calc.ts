import type { ApprovalPolicy, Budget, Expense, Reimbursement } from "@/data/types";

export const money = (n: number, frac = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: frac, minimumFractionDigits: frac });

export const expenseMatchesBudget = (e: Expense, b: Budget) => e.departmentId === b.departmentId && e.projectId === b.projectId;

/** Actual spend = approved expenses only (pending/rejected excluded). */
export function budgetSpent(b: Budget, expenses: Expense[]) {
  return expenses.filter((e) => e.approvalStatus === "approved" && expenseMatchesBudget(e, b)).reduce((s, e) => s + e.amount, 0);
}
export function budgetPending(b: Budget, expenses: Expense[]) {
  return expenses.filter((e) => e.approvalStatus === "pending" && expenseMatchesBudget(e, b)).reduce((s, e) => s + e.amount, 0);
}
export function budgetForExpense(e: Pick<Expense, "departmentId" | "projectId">, budgets: Budget[]) {
  return budgets.find((b) => b.departmentId === e.departmentId && b.projectId === e.projectId) ?? budgets.find((b) => b.departmentId === e.departmentId);
}

export function summarize(budgets: Budget[], expenses: Expense[], reimbursements: Reimbursement[]) {
  const allocated = budgets.reduce((s, b) => s + b.amount, 0);
  const approved = expenses.filter((e) => e.approvalStatus === "approved");
  const actual = approved.reduce((s, e) => s + e.amount, 0);
  const paidIds = new Set(reimbursements.filter((r) => r.status === "paid").map((r) => r.expenseId));
  // Approved is not paid: anything approved without a paid reimbursement counts as unpaid.
  const approvedUnpaid = approved.filter((e) => !paidIds.has(e.id)).reduce((s, e) => s + e.amount, 0);
  const pending = expenses.filter((e) => e.approvalStatus === "pending");
  return { allocated, actual, approvedUnpaid, pendingCount: pending.length, pendingAmount: pending.reduce((s, e) => s + e.amount, 0), remaining: allocated - actual };
}

export function findDuplicate(e: Expense, all: Expense[], windowDays: number) {
  const t = new Date(e.date).getTime();
  return all.find((o) => o.id !== e.id && o.employeeId === e.employeeId && o.vendor === e.vendor && Math.abs(o.amount - e.amount) < 0.01 && o.approvalStatus !== "rejected" && Math.abs(new Date(o.date).getTime() - t) <= windowDays * 864e5);
}

export function policyIssues(e: Expense, p: ApprovalPolicy) {
  const issues: string[] = [];
  if (e.amount > p.autoFlagAbove) issues.push(`Amount exceeds ${money(p.autoFlagAbove)} review threshold`);
  if (!e.receiptId && e.amount > p.receiptRequiredAbove) issues.push(`Receipt required above ${money(p.receiptRequiredAbove)}`);
  if (p.restrictedCategories.includes(e.category)) issues.push(`${e.category} requires finance review`);
  return issues;
}

export type Recommendation = { action: "approve" | "review" | "reject"; reasons: string[] };
export function recommend(e: Expense, opts: { duplicate: boolean; issues: string[]; available: number }): Recommendation {
  const reasons: string[] = [];
  if (opts.duplicate) reasons.push("Matches an earlier expense with the same vendor and amount.");
  if (e.amount > opts.available) reasons.push("Exceeds remaining budget.");
  reasons.push(...opts.issues);
  if (opts.duplicate) return { action: "reject", reasons };
  if (reasons.length) return { action: "review", reasons };
  return { action: "approve", reasons: ["Within budget, policy compliant, no duplicates found."] };
}

/** Deterministic 90-day projection of a budget balance under a purchase strategy. */
export function projectScenario(p: { balance: number; dailyBurn: number; amount: number; strategy: "now" | "next_month" | "split"; splitParts: number }) {
  const points: { day: number; balance: number }[] = [];
  const parts = Math.max(1, Math.floor(p.splitParts));
  for (let day = 0; day <= 90; day += 5) {
    let purchased = 0;
    if (p.strategy === "now") purchased = p.amount;
    else if (p.strategy === "next_month") purchased = day >= 30 ? p.amount : 0;
    else purchased = (p.amount / parts) * Math.min(parts, Math.floor(day / 30) + 1);
    points.push({ day, balance: Math.round(p.balance - p.dailyBurn * day - purchased) });
  }
  return points;
}
export const balanceAt = (pts: { day: number; balance: number }[], day: number) => pts.find((x) => x.day === day)?.balance ?? 0;
