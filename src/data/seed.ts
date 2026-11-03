// Entirely fictional demo data. Replace via src/data/api.ts once the backend / Excel import is connected.
import type {
  AppNotification, ApprovalPolicy, Approval, Budget, Category, Department, Employee, Expense,
  Project, ProjectDepartment, Receipt, Reimbursement, ReimbursementStatus,
} from "./types";

export const departments: Department[] = [
  { id: "d-rnd", name: "Research & Development", managerId: "e-maya" },
  { id: "d-ops", name: "Operations", managerId: "e-omar" },
  { id: "d-mkt", name: "Marketing", managerId: "e-lena" },
  { id: "d-fin", name: "Finance", managerId: "e-priya" },
];

export const employees: Employee[] = [
  { id: "e-priya", name: "Priya Nair", email: "priya@demo.example", role: "admin", departmentId: "d-fin", managerId: null, title: "Head of Finance" },
  { id: "e-maya", name: "Maya Chen", email: "maya@demo.example", role: "manager", departmentId: "d-rnd", managerId: "e-priya", title: "R&D Lead" },
  { id: "e-omar", name: "Omar Haddad", email: "omar@demo.example", role: "manager", departmentId: "d-ops", managerId: "e-priya", title: "Operations Manager" },
  { id: "e-lena", name: "Lena Fischer", email: "lena@demo.example", role: "manager", departmentId: "d-mkt", managerId: "e-priya", title: "Marketing Manager" },
  { id: "e-sam", name: "Sam Rivera", email: "sam@demo.example", role: "employee", departmentId: "d-rnd", managerId: "e-maya", title: "Lab Scientist" },
  { id: "e-aiko", name: "Aiko Tanaka", email: "aiko@demo.example", role: "employee", departmentId: "d-rnd", managerId: "e-maya", title: "Data Analyst" },
  { id: "e-jon", name: "Jon Okafor", email: "jon@demo.example", role: "employee", departmentId: "d-ops", managerId: "e-omar", title: "Logistics Coordinator" },
  { id: "e-ines", name: "Inés Morales", email: "ines@demo.example", role: "employee", departmentId: "d-mkt", managerId: "e-lena", title: "Content Strategist" },
];

export const projects: Project[] = [
  { id: "p-atlas", name: "Atlas Assay Platform", code: "ATL", status: "active" },
  { id: "p-beacon", name: "Beacon Launch", code: "BCN", status: "active" },
  { id: "p-core", name: "Core Operations", code: "COR", status: "active" },
];

export const projectDepartments: ProjectDepartment[] = [
  { projectId: "p-atlas", departmentId: "d-rnd" },
  { projectId: "p-beacon", departmentId: "d-mkt" },
  { projectId: "p-beacon", departmentId: "d-rnd" },
  { projectId: "p-core", departmentId: "d-ops" },
];

export const budgets: Budget[] = [
  { id: "b-rnd", name: "R&D General", departmentId: "d-rnd", projectId: null, ownerId: "e-maya", amount: 24000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 22000 }, { date: "2026-08-15", note: "Increased for hiring", amount: 24000 }] },
  { id: "b-atlas", name: "Atlas Assay", departmentId: "d-rnd", projectId: "p-atlas", ownerId: "e-maya", amount: 18000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 18000 }] },
  { id: "b-ops", name: "Operations General", departmentId: "d-ops", projectId: "p-core", ownerId: "e-omar", amount: 16000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 16000 }] },
  { id: "b-mkt", name: "Beacon Launch Marketing", departmentId: "d-mkt", projectId: "p-beacon", ownerId: "e-lena", amount: 12000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 14000 }, { date: "2026-09-01", note: "Reduced after event cancelled", amount: 12000 }] },
  { id: "b-fin", name: "Finance Tools", departmentId: "d-fin", projectId: null, ownerId: "e-priya", amount: 6000, period: "H2 2026", history: [{ date: "2026-06-01", note: "Initial allocation", amount: 6000 }] },
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
const empBudget: Record<string, { budget: string; cats: Category[] }> = {
  "e-sam": { budget: "b-atlas", cats: ["Lab Supplies", "Equipment", "Lab Supplies"] },
  "e-aiko": { budget: "b-rnd", cats: ["Software", "Training", "Travel"] },
  "e-maya": { budget: "b-rnd", cats: ["Travel", "Meals"] },
  "e-jon": { budget: "b-ops", cats: ["Services", "Office", "Travel"] },
  "e-omar": { budget: "b-ops", cats: ["Meals", "Travel"] },
  "e-ines": { budget: "b-mkt", cats: ["Services", "Software", "Meals", "Travel"] },
  "e-lena": { budget: "b-mkt", cats: ["Travel", "Meals"] },
  "e-priya": { budget: "b-fin", cats: ["Software"] },
};
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
    for (const [empId, cfg] of Object.entries(empBudget)) {
      const count = 1 + Math.floor(r() * 2);
      for (let i = 0; i < count; i++) {
        const cat = cfg.cats[Math.floor(r() * cfg.cats.length)]!;
        const vendors = vendorsByCat[cat];
        const [lo, hi] = ranges[cat];
        const amount = Math.round((lo + r() * (hi - lo)) * 100) / 100;
        const maxDay = month === "2026-11" ? 2 : 28;
        const day = String(1 + Math.floor(r() * maxDay)).padStart(2, "0");
        const b = budgets.find((x) => x.id === cfg.budget)!;
        const isLast = month === "2026-11" || (month === "2026-10" && r() < 0.5);
        const status = isLast ? (r() < 0.75 ? "pending" : "approved") : r() < 0.92 ? "approved" : "rejected";
        const id = `x-${String(n++).padStart(3, "0")}`;
        const hasReceipt = r() > 0.12;
        if (hasReceipt) receipts.push({ id: `r-${id}`, fileName: `receipt-${id}.jpg`, fileType: "image/jpeg", previewUrl: null, extractionSimulated: true });
        expenses.push({
          id, employeeId: empId, vendor: vendors[Math.floor(r() * vendors.length)]!, amount, date: `${month}-${day}`,
          category: cat, departmentId: b.departmentId, projectId: b.projectId, description: `${cat} purchase`,
          receiptId: hasReceipt ? `r-${id}` : null, approvalStatus: status, submittedAt: `${month}-${day}`,
        });
      }
    }
  }
  // An intentional likely-duplicate for the approval agent demo.
  const dup = expenses.find((e) => e.employeeId === "e-sam" && e.approvalStatus === "approved")!;
  expenses.push({ ...dup, id: `x-${String(n++).padStart(3, "0")}`, approvalStatus: "pending", date: "2026-11-02", submittedAt: "2026-11-02", receiptId: null });
  return { expenses, receipts };
}

export const { expenses, receipts } = buildExpenses();

export const approvals: Approval[] = expenses
  .filter((e) => e.approvalStatus !== "pending")
  .map((e, i) => ({
    id: `a-${i + 1}`, expenseId: e.id,
    managerId: departments.find((d) => d.id === e.departmentId)!.managerId!,
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
      authorizedBy: status === "awaiting_authorization" ? null : "e-priya",
      history: [{ date: e.date, status, note: "Demo status — no real payment was made" }],
    };
  });

export const notifications: AppNotification[] = [
  { id: "n1", type: "approval_requested", message: "Sam Rivera submitted an expense for your approval", date: "2026-11-02", read: false, audience: ["manager"] },
  { id: "n2", type: "budget_threshold", message: "Atlas Assay budget passed 80% utilization", date: "2026-11-01", read: false, audience: ["manager", "admin"] },
  { id: "n3", type: "missing_info", message: "A recent expense is missing a receipt", date: "2026-11-02", read: false, audience: ["employee"], employeeId: "e-sam" },
  { id: "n4", type: "payment_failed", message: "A demo reimbursement is marked failed — review details", date: "2026-10-28", read: false, audience: ["admin"] },
  { id: "n5", type: "expense_approved", message: "Your NorthLab Supply Co. expense was approved", date: "2026-10-20", read: true, audience: ["employee"], employeeId: "e-sam" },
  { id: "n6", type: "payment_completed", message: "Reimbursement marked paid (demo status)", date: "2026-09-30", read: true, audience: ["employee", "admin"] },
];

export const defaultPolicy: ApprovalPolicy = { autoFlagAbove: 1000, receiptRequiredAbove: 75, duplicateWindowDays: 120, restrictedCategories: ["Equipment"], budgetAlertPercent: 80 };

export const upcomingCommitments = [
  { id: "c1", name: "CloudDesk annual renewal", departmentId: "d-fin", amount: 2400, due: "2026-11-20" },
  { id: "c2", name: "Atlas reagent restock (planned)", departmentId: "d-rnd", amount: 3100, due: "2026-12-05" },
  { id: "c3", name: "Beacon launch event deposit", departmentId: "d-mkt", amount: 1800, due: "2026-12-12" },
];

export const DEMO_TODAY = "2026-11-03";
