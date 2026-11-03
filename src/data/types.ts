// Entity types mirror the planned backend tables 1:1 so demo data can be swapped for API responses.
export type Role = "employee" | "manager" | "admin";

export interface Department { id: string; name: string; managerId: string | null }
export interface Employee { id: string; name: string; email: string; role: Role; departmentId: string; managerId: string | null; title: string }
export interface Project { id: string; name: string; code: string; status: "active" | "closed" }
export interface ProjectDepartment { projectId: string; departmentId: string }

export interface BudgetHistoryEntry { date: string; note: string; amount: number }
export interface Budget {
  id: string; name: string; departmentId: string; projectId: string | null; ownerId: string;
  amount: number; period: string; history: BudgetHistoryEntry[];
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";
export const CATEGORIES = ["Lab Supplies", "Software", "Travel", "Meals", "Equipment", "Office", "Training", "Services"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: string; employeeId: string; vendor: string; amount: number; date: string;
  category: Category; departmentId: string; projectId: string | null; description: string;
  receiptId: string | null; approvalStatus: ApprovalStatus; submittedAt: string;
}
export interface Receipt { id: string; fileName: string; fileType: string; previewUrl: string | null; extractionSimulated: boolean; storagePath?: string | undefined }

export interface Approval {
  id: string; expenseId: string; managerId: string; decision: Exclude<ApprovalStatus, "pending">;
  comment: string; date: string; employeeResponse?: string;
}

// Kept separate from ApprovalStatus: approved never implies paid.
export type ReimbursementStatus = "awaiting_authorization" | "queued" | "processing" | "paid" | "failed";
export interface Reimbursement {
  id: string; expenseId: string; employeeId: string; amount: number; status: ReimbursementStatus;
  paypalReference: string | null; authorizedBy: string | null;
  history: { date: string; status: ReimbursementStatus; note: string }[];
}

export interface PurchaseRequest { id: string; employeeId: string; prompt: string; maxBudget: number | null; departmentId: string; selectedQuoteId: string | null; createdAt: string }
export interface VendorQuote { id: string; vendor: string; product: string; price: number; deliveryDays: number; rating: number; notes: string; isExample: true }
export interface FinancialScenario { id: string; name: string; amount: number; budgetId: string; strategy: "now" | "next_month" | "split"; splitParts: number; createdAt: string }

export type NotificationType =
  | "expense_submitted" | "missing_info" | "approval_requested" | "expense_approved"
  | "changes_requested" | "reimbursement_initiated" | "payment_completed" | "payment_failed" | "budget_threshold";
export interface AppNotification { id: string; type: NotificationType; message: string; date: string; read: boolean; audience: Role[]; employeeId?: string | undefined }

export interface ApprovalPolicy { autoFlagAbove: number; receiptRequiredAbove: number; duplicateWindowDays: number; restrictedCategories: Category[]; budgetAlertPercent: number }
