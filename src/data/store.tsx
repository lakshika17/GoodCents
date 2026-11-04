import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import { isPublicPath } from "@/lib/utils";
import * as seed from "./seed";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { loadDeveloperAccess, loadInternal, performInternal } from "./internal.functions";
import { actionSchema } from "./action-schema";
import { DEMO_PREVIEWS, isDemoPreview, type DemoPreview } from './demo-preview';
import { AuthScreen } from "@/components/auth-screen";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  AppNotification, ApprovalPolicy, Approval, Budget, Department, Employee, Expense, NotificationType,
  Project, ProjectDepartment, Receipt, Reimbursement, ReimbursementStatus, Role, SavedDocument,
} from "./types";

// Central in-memory demo state. All pages read/write through this hook only,
// so it can be backed by src/data/api.ts (backend) later without page rewrites.
interface State {
  departments: Department[]; employees: Employee[]; projects: Project[]; projectDepartments: ProjectDepartment[];
  budgets: Budget[]; expenses: Expense[]; receipts: Receipt[]; approvals: Approval[]; reimbursements: Reimbursement[];
  notifications: AppNotification[]; policy: ApprovalPolicy; documents: SavedDocument[];
}
const today = () => seed.DEMO_TODAY;
let idc = 1000;
const uid = (p: string) => `${p}-${++idc}`;

function useStoreValue() {
  const [preview, setPreviewState] = useState<DemoPreview>('developer');
  useEffect(() => {
    const saved = sessionStorage.getItem('ai-cfo-preview');
    if (isDemoPreview(saved)) setPreviewState(saved);
  }, []);
  const setPreview = (next: DemoPreview) => { setPreviewState(next); sessionStorage.setItem('ai-cfo-preview', next); };
  const role = DEMO_PREVIEWS[preview].role;
  const setRole = (next: Role) => setPreview(next === 'admin' ? 'developer' : next);
  const [s, set] = useState<State>(() => ({
    departments: seed.departments, employees: seed.employees, projects: seed.projects, projectDepartments: seed.projectDepartments,
    budgets: seed.budgets, expenses: seed.expenses, receipts: seed.receipts, approvals: seed.approvals,
    reimbursements: seed.reimbursements, notifications: seed.notifications, policy: seed.defaultPolicy, documents: [],
  }));
  const currentUser = s.employees.find((e) => e.id === DEMO_PREVIEWS[preview].employeeId);
  if (!currentUser) throw new Error("Demo persona unavailable");

  const notify = (st: State, type: NotificationType, message: string, audience: Role[], employeeId?: string): State => ({
    ...st, notifications: [{ id: uid("n"), type, message, date: today(), read: false, audience, employeeId }, ...st.notifications],
  });

  const submitExpense = useCallback((e: Omit<Expense, "id" | "approvalStatus" | "submittedAt" | "employeeId" | "receiptId">, receipt?: Omit<Receipt, "id">) => {
    set((st) => {
      const receiptId = receipt ? uid("r") : null;
      const exp: Expense = { ...e, id: uid("x"), employeeId: currentUser.id, receiptId, approvalStatus: "pending", submittedAt: today() };
      let next: State = { ...st, expenses: [exp, ...st.expenses], receipts: receipt ? [{ ...receipt, id: receiptId ?? uid("r") }, ...st.receipts] : st.receipts };
      next = notify(next, "expense_submitted", `Expense submitted: ${e.vendor} $${e.amount.toFixed(2)}`, ["employee"], exp.employeeId);
      next = notify(next, "approval_requested", `New expense awaiting approval: ${e.vendor}`, ["manager"]);
      return next;
    });
  }, [currentUser.id]);

  const saveDocument = useCallback((d: Omit<SavedDocument, "id" | "employeeId" | "createdAt">) => {
    set((st) => ({ ...st, documents: [{ ...d, id: uid("doc"), employeeId: currentUser.id, createdAt: today() }, ...st.documents] }));
  }, [currentUser.id]);
  const voidDocument = useCallback((id: string) => {
    set((st) => ({ ...st, documents: st.documents.map((d) => (d.id === id && d.employeeId === currentUser.id ? { ...d, status: "void" as const } : d)) }));
  }, [currentUser.id]);
  /** Voids the current user's own pending expense: removes it from spending and the approval queue, keeps a void record. */
  const voidExpense = useCallback((expenseId: string) => {
    set((st) => {
      const exp = st.expenses.find((e) => e.id === expenseId);
      if (!exp || !exp.documentType || exp.employeeId !== currentUser.id || exp.approvalStatus !== "pending") return st;
      const r = st.receipts.find((x) => x.id === exp.receiptId);
      const record: SavedDocument = { id: uid("doc"), employeeId: exp.employeeId, documentType: exp.documentType ?? "Paid Receipt", status: "void", vendor: exp.vendor, amount: exp.amount, date: exp.date, category: exp.category, departmentId: exp.departmentId, projectId: exp.projectId, description: exp.description, verified: exp.verified ?? false, currency: exp.currency ?? "USD", source: exp.source ?? "manual", documentNumber: "", fileName: r?.fileName ?? null, fileType: r?.fileType ?? null, previewUrl: r?.previewUrl ?? null, createdAt: today() };
      return {
        ...st,
        expenses: st.expenses.filter((e) => e.id !== expenseId),
        receipts: st.receipts.filter((x) => x.id !== exp.receiptId),
        approvals: st.approvals.filter((a) => a.expenseId !== expenseId),
        documents: [record, ...st.documents],
        notifications: st.notifications.filter((n) => !(n.date === today() && n.message.includes(exp.vendor) && (n.type === "approval_requested" || n.type === "expense_submitted"))),
      };
    });
  }, [currentUser.id]);

  const decide = useCallback((expenseId: string, decision: Approval["decision"], comment: string) => {
    set((st) => {
      const exp = st.expenses.find((e) => e.id === expenseId);
      if (!exp) return st;
      let next: State = {
        ...st,
        expenses: st.expenses.map((e) => (e.id === expenseId ? { ...e, approvalStatus: decision } : e)),
        approvals: [{ id: uid("a"), expenseId, managerId: currentUser.id, decision, comment, date: today() }, ...st.approvals],
      };
      // Unverified documents never enter the reimbursement process.
      if (decision === "approved" && exp.verified === true && !st.reimbursements.some(r => r.expenseId === exp.id)) {
        next.reimbursements = [{ id: uid("rb"), expenseId, employeeId: exp.employeeId, amount: exp.amount, status: "awaiting_authorization", paypalReference: null, authorizedBy: null, history: [{ date: today(), status: "awaiting_authorization", note: "Created on approval" }] }, ...next.reimbursements];
      }
      const msg = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "returned for changes";
      next = notify(next, decision === "changes_requested" ? "changes_requested" : "expense_approved", `Your ${exp.vendor} expense was ${msg}${comment ? `: “${comment}”` : ""}`, ["employee"], exp.employeeId);
      return next;
    });
  }, [currentUser.id]);

  const respondToChanges = useCallback((expenseId: string, response: string, patch: Partial<Expense>) => {
    set((st) => ({
      ...st,
      expenses: st.expenses.map((e) => (e.id === expenseId ? { ...e, ...patch, approvalStatus: "pending" } : e)),
      approvals: st.approvals.map((a) => (a.expenseId === expenseId && a.decision === "changes_requested" && !a.employeeResponse ? { ...a, employeeResponse: response } : a)),
    }));
  }, []);

  const setReimbursementStatus = useCallback((id: string, status: ReimbursementStatus, note: string) => {
    set((st) => {
      const rb = st.reimbursements.find((r) => r["id"] === id);
      if (!rb) return st;
      let next: State = {
        ...st,
        reimbursements: st.reimbursements.map((r) => r.id === id ? { ...r, status, authorizedBy: r.authorizedBy ?? (status === "queued" ? currentUser.id : null), history: [...r.history, { date: today(), status, note }] } : r),
      };
      if (status === "queued") next = notify(next, "reimbursement_initiated", `Reimbursement authorized and queued (demo) — $${rb.amount.toFixed(2)}`, ["employee", "admin"], rb.employeeId);
      return next;
    });
  }, [currentUser.id]);

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
    ...s, role, setRole, preview, setPreview, authenticatedDevelopment: false, currentUser, uid, visibleNotifications, mode: "demo" as "demo" | "internal", canAuthorize: DEMO_PREVIEWS[preview].canAuthorize, sharedTotals: [] as { project_id: string; approved_total: number; pending_total: number }[],
    submitExpense, saveDocument, voidDocument, voidExpense, decide, respondToChanges, setReimbursementStatus, upsertBudget, upsertEmployee, removeEmployee,
    upsertDepartment, upsertProject, setPolicy, markAllRead,
  };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);
function DemoProvider({ children, authenticated = false }: { children: ReactNode; authenticated?: boolean }) {
  const v = useStoreValue();
  return <Ctx.Provider value={{ ...v, authenticatedDevelopment: authenticated }}>{children}</Ctx.Provider>;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const isDemo = sessionStorage.getItem('ai-cfo-demo') === 'true';
    setDemo(isDemo);
    if (isDemo) { setReady(true); return; }
    void supabase.auth.getUser().then(({ data }) => { setSignedIn(!!data.user); setReady(true); }).catch(() => setReady(true));
  }, [path]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setSignedIn(!!session?.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (isPublicPath(path)) return <>{children}</>;
  if (!ready) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (demo) return <DemoProvider>{children}</DemoProvider>;
  if (!signedIn) return <AuthScreen />;
  return <SignedInProvider>{children}</SignedInProvider>;
}
function SignedInProvider({ children }: { children: ReactNode }) {
  const loadAccess = useServerFn(loadDeveloperAccess);
  const access = useQuery({ queryKey: ['developer-access'], queryFn: () => loadAccess(), retry: false });
  if (access.isPending) return <p className="p-6 text-muted-foreground">Checking verified access…</p>;
  if (access.error) return <div className="p-6"><p role="alert">Development access could not be verified.</p><Button onClick={() => void supabase.auth.signOut()}>Sign out</Button></div>;
  if (access.data?.authorized) return <DemoProvider authenticated>{children}</DemoProvider>;
  return <InternalProvider>{children}</InternalProvider>;
}
function InternalProvider({ children }: { children: ReactNode }) {
  const fetchData = useServerFn(loadInternal);
  const perform = useServerFn(performInternal);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['internal'], queryFn: () => fetchData(), retry: false });
  if (query.isPending) return <p className="p-6 text-muted-foreground">Loading your authorized records…</p>;
  if (query.error || !query.data) return <div className="p-6"><p role="alert">{query.error?.message ?? 'Employee access unavailable.'}</p><Button onClick={() => void supabase.auth.signOut()}>Sign out</Button></div>;
  const tables = query.data.tables;
  type Row = Record<string, any>;
  const rows = (name: string) => (tables[name] ?? []) as Row[];
  const dataRows = <T,>(name: string) => rows(name).map(r => ({ ...r["data"], id: r["id"] })) as T[];
  const employees: Employee[] = rows('employees').map(r => ({ id: r["id"], name: r["name"], email: r["email"], title: r["title"], role: r["access_role"] === 'Founder' ? 'admin' : r["access_role"] === 'Manager' ? 'manager' : 'employee', departmentId: r["department_id"], managerId: r["manager_id"] }));
  const employeeId = query.data.profile.employee_id;
  const currentUser = employees.find(e => e.id === employeeId);
  if (!currentUser) return <p className="p-6">Employee profile unavailable.</p>;
  const role = currentUser.role;
  const mutate = async (action: string, payload: unknown) => {
    try { const validated = actionSchema.parse({ action, payload }); await perform({ data: validated }); await qc.invalidateQueries({ queryKey: ['internal'] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Action failed'); throw error; }
  };
  const denied = () => { toast.error('Workbook employee and department records are managed by Terry through invitations.'); };
  const expenses = dataRows<Expense>('expenses');
  const notifications = dataRows<AppNotification>('notifications');
  const value: Store = {
    departments: rows('departments').map(r => ({ id: r["id"], name: r["name"], managerId: r["manager_id"] })), employees,
    projects: dataRows<Project>('projects'), projectDepartments: rows('project_departments').map(r => ({ projectId: r["project_id"], departmentId: r["department_id"] })),
    budgets: dataRows<Budget>('budgets'), expenses, receipts: dataRows<Receipt>('receipts'), approvals: dataRows<Approval>('approvals'), reimbursements: dataRows<Reimbursement>('reimbursements'), notifications,
    policy: (rows('approval_policies')[0]?.['data'] ?? seed.defaultPolicy) as ApprovalPolicy,
    role, setRole: denied, preview: 'developer', setPreview: denied, authenticatedDevelopment: false, currentUser, uid: prefix => `${prefix}-${crypto.randomUUID()}`, visibleNotifications: notifications,
    mode: 'internal', canAuthorize: rows('user_roles').some(r => r["role"] === 'finance'), sharedTotals: query.data.sharedTotals,
    documents: [],
    saveDocument: () => { toast.error('Drafts, quotes and other non-expense documents cannot be saved to company records yet.'); },
    voidDocument: () => { toast.error('Voiding company records is not available yet.'); },
    voidExpense: () => { toast.error('Voiding company records is not available yet.'); },
    submitExpense: async (e, receipt) => { await mutate('expense', { ...e, documentNumber: e.documentNumber ?? null, receipt: receipt ? { fileName: receipt.fileName, fileType: receipt.fileType, storagePath: receipt.storagePath } : undefined }); },
    decide: (id, decision, comment) => mutate('decision', { id, version: expenses.find(e => e.id === id)?.version ?? 1, decision, comment }),
    respondToChanges: (id, response, patch) => mutate('respond', { id, version: expenses.find(e => e.id === id)?.version ?? 1, verified: patch.verified, response, amount: patch.amount }),
    setReimbursementStatus: (id, status) => mutate('reimbursement', { id, status }),
    upsertBudget: b => mutate('budget', b), upsertEmployee: denied, removeEmployee: denied, upsertDepartment: denied,
    upsertProject: (p, departmentIds) => mutate('project', { id: p.id, project: p, departmentIds }),
    setPolicy: p => mutate('policy', p),
    markAllRead: async () => { for (const n of notifications) await supabase.from('notifications').update({ data: { ...n, read: true } }).eq('id', n.id); await qc.invalidateQueries({ queryKey: ['internal'] }); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useOptionalStore() { return useContext(Ctx); }
export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

/** Expenses the current role may see: employee → own, manager → own department, admin → all. */
export function useScopedExpenses() {
  const { expenses, role, currentUser, mode } = useStore();
  return useMemo(() => {
    if (mode === "internal") return expenses;
    if (role === "employee") return expenses.filter((e) => e.employeeId === currentUser.id);
    if (role === "manager") return expenses.filter((e) => e.departmentId === currentUser.departmentId);
    return expenses;
  }, [expenses, role, currentUser, mode]);
}
