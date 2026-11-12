// GoodCents sample team with sample-only financial fixtures; never actual company purchases.
import type {
  AppNotification, ApprovalPolicy, Approval, Budget, Category, Expense,
  Project, ProjectDepartment, Receipt, Reimbursement, ReimbursementStatus,
} from "./types";

import { quanteraDepartments, quanteraEmployees } from './quantera-team';
export const departments = quanteraDepartments;
export const employees = quanteraEmployees;

export const projects: Project[] = [
  { id: "p-atlas", name: "Atlas Assay Platform", code: "ATL", status: "active" },
  { id: "p-beacon", name: "Beacon Launch", code: "BCN", status: "active" },
  { id: "p-core", name: "Core Operations", code: "COR", status: "active" },
];

export const projectDepartments: ProjectDepartment[] = [
  { projectId: "p-atlas", departmentId: "DEP-004" },
  { projectId: "p-beacon", departmentId: "DEP-005" },
  { projectId: "p-beacon", departmentId: "DEP-004" },
  { projectId: "p-core", departmentId: "DEP-003" },
];

export const budgets: Budget[] = [
  { id: "b-rnd", name: "Science & Research General", departmentId: "DEP-004", projectId: null, ownerId: "EMP-004", amount: 24000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 22000 }, { date: "2026-08-15", note: "Increased for hiring", amount: 24000 }] },
  { id: "b-atlas", name: "Atlas Assay", departmentId: "DEP-004", projectId: "p-atlas", ownerId: "EMP-004", amount: 18000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 18000 }] },
  { id: "b-ops", name: "Operations General", departmentId: "DEP-003", projectId: "p-core", ownerId: "EMP-003", amount: 16000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 16000 }] },
  { id: "b-mkt", name: "Beacon Launch Product", departmentId: "DEP-005", projectId: "p-beacon", ownerId: "EMP-002", amount: 12000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 14000 }, { date: "2026-09-01", note: "Reduced after event cancelled", amount: 12000 }] },
  { id: "b-fin", name: "Quality & Compliance Tools", departmentId: "DEP-002", projectId: null, ownerId: "EMP-002", amount: 6000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 6000 }] },
];

// Deterministic pseudo-random generator so totals are stable between reloads.
function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
const r = rng(42);

const vendorsByCat: Record<Category, string[]> = {
  "Lab Supplies": ["NorthLab Supply Co.", "BioCrate", "PipetteHub"],
  Software: ["CloudDesk", "Notely", "DataForge"],
  Travel: ["SkyRoute Air", "MetroCab", "Harbor Hotel"],
  Meals: ["Green Fork Cafe", "Bento Box", "Urban Deli"],
  Equipment: ["Precision Instruments", "TechDepot"],
  Office: ["PaperPlane Office", "DeskWorks"],
  Training: ["SkillPath Academy"],
  Services: ["Swift Couriers", "PrintPro"],
};
// Retain the original eight spending tracks and RNG order so sample totals do not change.
const spendingTracks: { employeeId: string; budget: string; cats: Category[] }[] = [
  { employeeId: 'EMP-004', budget: 'b-atlas', cats: ['Lab Supplies', 'Equipment', 'Lab Supplies'] },
  { employeeId: 'EMP-004', budget: 'b-rnd', cats: ['Software', 'Training', 'Travel'] },
  { employeeId: 'EMP-004', budget: 'b-rnd', cats: ['Travel', 'Meals'] },
  { employeeId: 'EMP-003', budget: 'b-ops', cats: ['Services', 'Office', 'Travel'] },
  { employeeId: 'EMP-003', budget: 'b-ops', cats: ['Meals', 'Travel'] },
  { employeeId: 'EMP-002', budget: 'b-mkt', cats: ['Services', 'Software', 'Meals', 'Travel'] },
  { employeeId: 'EMP-002', budget: 'b-mkt', cats: ['Travel', 'Meals'] },
  { employeeId: 'EMP-002', budget: 'b-fin', cats: ['Software'] },
];
const ranges: Record<Category, [number, number]> = {
  "Lab Supplies": [180, 1400], Software: [40, 600], Travel: [120, 1100], Meals: [25, 180],
  Equipment: [400, 2200], Office: [30, 260], Training: [200, 900], Services: [60, 700],
};

const months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];

function buildExpenses(): { expenses: Expense[]; receipts: Receipt[] } {
  const expenses: Expense[] = [];
  const receipts: Receipt[] = [];
  let n = 1;
  for (const month of months) {
    for (const cfg of spendingTracks) {
      const empId = cfg.employeeId;
      const count = 1 + Math.floor(r() * 2);
      for (let i = 0; i < count; i++) {
        const cat = cfg.cats[Math.floor(r() * cfg.cats.length)];
        if (!cat) throw new Error('Sample category unavailable');
        const vendors = vendorsByCat[cat];
        const [lo, hi] = ranges[cat];
        const amount = Math.round((lo + r() * (hi - lo)) * 100) / 100;
        const maxDay = month === "2026-11" ? 2 : 28;
        const day = String(1 + Math.floor(r() * maxDay)).padStart(2, "0");
        const b = budgets.find((x) => x.id === cfg.budget);
        if (!b) throw new Error('Sample budget unavailable');
        const isLast = month === "2026-11" || (month === "2026-10" && r() < 0.5);
        const status = isLast ? (r() < 0.75 ? "pending" : "approved") : r() < 0.92 ? "approved" : "rejected";
        const id = `x-${String(n++).padStart(3, "0")}`;
        const hasReceipt = r() > 0.12;
        if (hasReceipt) receipts.push({ id: `r-${id}`, fileName: `receipt-${id}.jpg`, fileType: "image/jpeg", previewUrl: null, extractionSimulated: true });
        expenses.push({
          id, employeeId: empId, vendor: vendors[Math.floor(r() * vendors.length)] ?? vendors[0] ?? 'Sample vendor', amount, date: `${month}-${day}`,
          category: cat, departmentId: b.departmentId, projectId: b.projectId, description: `${cat} purchase`,
          receiptId: hasReceipt ? `r-${id}` : null, approvalStatus: status, submittedAt: `${month}-${day}`,
          verified: true, // Explicitly confirmed fictional fixture; never applied to company records.
        });
      }
    }
  }
  // An intentional likely-duplicate for the approval agent demo.
  const dup = expenses.find((e) => e.employeeId === "EMP-004" && e.approvalStatus === "approved");
  if (!dup) throw new Error('Sample duplicate source unavailable');
  expenses.push({ ...dup, id: `x-${String(n++).padStart(3, "0")}`, approvalStatus: "pending", date: "2026-11-02", submittedAt: "2026-11-02", receiptId: null });
  return { expenses, receipts };
}

export const { expenses, receipts } = buildExpenses();

export const approvals: Approval[] = expenses
  .filter((e) => e.approvalStatus !== "pending")
  .map((e, i) => ({
    id: `a-${i + 1}`, expenseId: e.id,
    managerId: employees.find(x => x.id === e.employeeId)?.managerId ?? 'EMP-001',
    decision: e.approvalStatus as Approval["decision"],
    comment: e.approvalStatus === "rejected" ? "Outside policy for this category." : "Looks good.",
    date: e.date,
  }));

export const reimbursements: Reimbursement[] = expenses
  .filter((e) => e.approvalStatus === "approved")
  .map((e, i) => {
    const old = e.date < "2026-10-01";
    const status: ReimbursementStatus = old ? (i % 17 === 5 ? "failed" : "paid") : i % 3 === 0 ? "queued" : i % 3 === 1 ? "processing" : "awaiting_authorization";
    return {
      id: `rb-${i + 1}`, expenseId: e.id, employeeId: e.employeeId, amount: e.amount, status,
      paypalReference: status === "paid" ? `DEMO-REF-${1000 + i}` : null,
      authorizedBy: status === "awaiting_authorization" ? null : "EMP-003",
      history: [{ date: e.date, status, note: "Demo status — no real payment was made" }],
    };
  });

export const notifications: AppNotification[] = [
  { id: "n1", type: "approval_requested", message: "Kulvardhan submitted a sample expense for your approval", date: "2026-11-02", read: false, audience: ["manager", "admin"] },
  { id: "n2", type: "budget_threshold", message: "Atlas Assay budget passed 80% utilization", date: "2026-11-01", read: false, audience: ["manager", "admin"] },
  { id: "n3", type: "missing_info", message: "A recent sample expense is missing a receipt", date: "2026-11-02", read: false, audience: ["employee"], employeeId: "EMP-002" },
  { id: "n4", type: "payment_failed", message: "A demo reimbursement is marked failed — review details", date: "2026-10-28", read: false, audience: ["admin"] },
  { id: "n5", type: "expense_approved", message: "Your sample NorthLab Supply Co. expense was approved", date: "2026-10-20", read: true, audience: ["employee"], employeeId: "EMP-002" },
  { id: "n6", type: "payment_completed", message: "Reimbursement marked paid (demo status)", date: "2026-09-30", read: true, audience: ["employee", "admin"] },
];

export const defaultPolicy: ApprovalPolicy = { autoFlagAbove: 1000, receiptRequiredAbove: 75, duplicateWindowDays: 120, restrictedCategories: ["Equipment"], budgetAlertPercent: 80 };

export const upcomingCommitments = [
  { id: "c1", name: "CloudDesk annual renewal", departmentId: "DEP-002", amount: 2400, due: "2026-11-20" },
  { id: "c2", name: "Atlas reagent restock (planned)", departmentId: "DEP-004", amount: 3100, due: "2026-12-05" },
  { id: "c3", name: "Beacon launch event deposit", departmentId: "DEP-005", amount: 1800, due: "2026-12-12" },
];

export const DEMO_TODAY = "2026-11-03";
