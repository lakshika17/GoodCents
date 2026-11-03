import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as seed from "./seed";
import type {
  AppNotification, ApprovalPolicy, Approval, Budget, Department, Employee, Expense, NotificationType,
  Project, ProjectDepartment, Receipt, Reimbursement, ReimbursementStatus, Role,
} from "./types";

// Central in-memory demo state. All pages read/write through this hook only,
// so it can be backed by src/data/api.ts (backend) later without page rewrites.
interface State {
  departments: Department[]; employees: Employee[]; projects: Project[]; projectDepartments: ProjectDepartment[];
  budgets: Budget[]; expenses: Expense[]; receipts: Receipt[]; approvals: Approval[]; reimbursements: Reimbursement[];
  notifications: AppNotification[]; policy: ApprovalPolicy;
}
const DEMO_USERS: Record<Role, string> = { employee: "e-sam", manager: "e-maya", admin: "e-priya" };
const today = () => seed.DEMO_TODAY;
let idc = 1000;
const uid = (p: string) => `${p}-${++idc}`;

function useStoreValue() {
  const [role, setRole] = useState<Role>("admin");
  const [s, set] = useState<State>(() => ({
    departments: seed.departments, employees: seed.employees, projects: seed.projects, projectDepartments: seed.projectDepartments,
    budgets: seed.budgets, expenses: seed.expenses, receipts: seed.receipts, approvals: seed.approvals,
    reimbursements: seed.reimbursements, notifications: seed.notifications, policy: seed.defaultPolicy,
  }));
  const currentUser = s.employees.find((e) => e.id === DEMO_USERS[role])!;

  const notify = (st: State, type: NotificationType, message: string, audience: Role[], employeeId?: string): State => ({
    ...st, notifications: [{ id: uid("n"), type, message, date: today(), read: false, audience, employeeId }, ...st.notifications],
  });

  const submitExpense = useCallback((e: Omit<Expense, "id" | "approvalStatus" | "submittedAt" | "employeeId" | "receiptId">, receipt?: Omit<Receipt, "id">) => {
    set((st) => {
      const receiptId = receipt ? uid("r") : null;
      const exp: Expense = { ...e, id: uid("x"), employeeId: DEMO_USERS[role], receiptId, approvalStatus: "pending", submittedAt: today() };
      let next: State = { ...st, expenses: [exp, ...st.expenses], receipts: receipt ? [{ ...receipt, id: receiptId! }, ...st.receipts] : st.receipts };
      next = notify(next, "expense_submitted", `Expense submitted: ${e.vendor} $${e.amount.toFixed(2)}`, ["employee"], exp.employeeId);
      next = notify(next, "approval_requested", `New expense awaiting approval: ${e.vendor}`, ["manager"]);
      return next;
    });
  }, [role]);

  const decide = useCallback((expenseId: string, decision: Approval["decision"], comment: string) => {
    set((st) => {
      const exp = st.expenses.find((e) => e.id === expenseId)!;
      let next: State = {
        ...st,
        expenses: st.expenses.map((e) => (e.id === expenseId ? { ...e, approvalStatus: decision } : e)),
        approvals: [{ id: uid("a"), expenseId, managerId: DEMO_USERS[role], decision, comment, date: today() }, ...st.approvals],
      };
      if (decision === "approved") {
        next.reimbursements = [{ id: uid("rb"), expenseId, employeeId: exp.employeeId, amount: exp.amount, status: "awaiting_authorization", paypalReference: null, authorizedBy: null, history: [{ date: today(), status: "awaiting_authorization", note: "Created on approval" }] }, ...next.reimbursements];
      }
      const msg = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "returned for changes";
      next = notify(next, decision === "changes_requested" ? "changes_requested" : "expense_approved", `Your ${exp.vendor} expense was ${msg}${comment ? `: “${comment}”` : ""}`, ["employee"], exp.employeeId);
      return next;
    });
  }, [role]);

  const respondToChanges = useCallback((expenseId: string, response: string, patch: Partial<Expense>) => {
    set((st) => ({
      ...st,
      expenses: st.expenses.map((e) => (e.id === expenseId ? { ...e, ...patch, approvalStatus: "pending" } : e)),
      approvals: st.approvals.map((a) => (a.expenseId === expenseId && a.decision === "changes_requested" && !a.employeeResponse ? { ...a, employeeResponse: response } : a)),
    }));
  }, []);

  const setReimbursementStatus = useCallback((id: string, status: ReimbursementStatus, note: string) => {
    set((st) => {
      const rb = st.reimbursements.find((r) => r.id === id)!;
      let next: State = {
        ...st,
        reimbursements: st.reimbursements.map((r) => r.id === id ? { ...r, status, authorizedBy: r.authorizedBy ?? (status === "queued" ? DEMO_USERS[role] : null), history: [...r.history, { date: today(), status, note }] } : r),
      };
      if (status === "queued") next = notify(next, "reimbursement_initiated", `Reimbursement authorized and queued (demo) — $${rb.amount.toFixed(2)}`, ["employee", "admin"], rb.employeeId);
      return next;
    });
  }, [role]);

  const upsertBudget = useCallback((b: Budget) => set((st) => {
    const exists = st.budgets.some((x) => x.id === b.id);
    return { ...st, budgets: exists ? st.budgets.map((x) => (x.id === b.id ? b : x)) : [...st.budgets, b] };
  }), []);
  const upsertEmployee = useCallback((e: Employee) => set((st) => ({ ...st, employees: st.employees.some((x) => x.id === e.id) ? st.employees.map((x) => (x.id === e.id ? e : x)) : [...st.employees, e] })), []);
  const removeEmployee = useCallback((id: string) => set((st) => ({ ...st, employees: st.employees.filter((x) => x.id !== id) })), []);
  const upsertDepartment = useCallback((d: Department) => set((st) => ({ ...st, departments: st.departments.some((x) => x.id === d.id) ? st.departments.map((x) => (x.id === d.id ? d : x)) : [...st.departments, d] })), []);
  const upsertProject = useCallback((p: Project, deptIds: string[]) => set((st) => ({
    ...st,
    projects: st.projects.some((x) => x.id === p.id) ? st.projects.map((x) => (x.id === p.id ? p : x)) : [...st.projects, p],
    projectDepartments: [...st.projectDepartments.filter((pd) => pd.projectId !== p.id), ...deptIds.map((d) => ({ projectId: p.id, departmentId: d }))],
  })), []);
  const setPolicy = useCallback((policy: ApprovalPolicy) => set((st) => ({ ...st, policy })), []);
  const markAllRead = useCallback(() => set((st) => ({ ...st, notifications: st.notifications.map((n) => ({ ...n, read: true })) })), []);

  const visibleNotifications = s.notifications.filter((n) => n.audience.includes(role) && (role !== "employee" || !n.employeeId || n.employeeId === currentUser.id));

  return {
    ...s, role, setRole, currentUser, uid, visibleNotifications,
    submitExpense, decide, respondToChanges, setReimbursementStatus, upsertBudget, upsertEmployee, removeEmployee,
    upsertDepartment, upsertProject, setPolicy, markAllRead,
  };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreValue();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

/** Expenses the current role may see: employee → own, manager → own department, admin → all. */
export function useScopedExpenses() {
  const { expenses, role, currentUser } = useStore();
  return useMemo(() => {
    if (role === "employee") return expenses.filter((e) => e.employeeId === currentUser.id);
    if (role === "manager") return expenses.filter((e) => e.departmentId === currentUser.departmentId);
    return expenses;
  }, [expenses, role, currentUser]);
}
