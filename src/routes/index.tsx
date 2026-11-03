import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useScopedExpenses, useStore } from "@/data/store";
import { upcomingCommitments } from "@/data/seed";
import { budgetSpent, money, summarize } from "@/lib/calc";
import { ApprovalBadge, DemoBadge, Kpi, PageHeader, Panel, ReimbursementBadge, nativeSelect, reimbursementLabels } from "@/components/shared";
import { Progress } from "@/components/ui/progress";
import { pageHead } from "@/lib/meta";
import type { ApprovalStatus, ReimbursementStatus } from "@/data/types";

export const Route = createFileRoute("/")({
  head: pageHead("Overview", "Company-wide budget, spending, approvals and reimbursement overview."),
  component: Overview,
});

const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const monthLabel = (m: string) => new Date(`${m}-15`).toLocaleString("en-US", { month: "short" });

function Overview() {
  const { budgets, departments, projects, reimbursements, employees, role, mode, sharedTotals } = useStore();
  const scoped = useScopedExpenses();
  const [f, setF] = useState({ month: "all", dept: "all", project: "all", status: "all" });

  const expenses = useMemo(() => scoped.filter((e) =>
    (f.month === "all" || e.date.startsWith(f.month)) && (f.dept === "all" || e.departmentId === f.dept) &&
    (f.project === "all" || e.projectId === f.project) && (f.status === "all" || e.approvalStatus === f.status)), [scoped, f]);
  const fBudgets = budgets.filter((b) => (f.dept === "all" || b.departmentId === f.dept) && (f.project === "all" || b.projectId === f.project));
  const ids = new Set(expenses.map((e) => e.id));
  const fReimb = reimbursements.filter((r) => ids.has(r.expenseId));
  const s = summarize(fBudgets, expenses, fReimb);

  const trend = MONTHS.map((m) => ({ month: monthLabel(m), spend: Math.round(expenses.filter((e) => e.approvalStatus === "approved" && e.date.startsWith(m)).reduce((a, e) => a + e.amount, 0)) }));
  const byDept = departments.map((d) => ({ name: d.name.split(" ")[0], spend: Math.round(expenses.filter((e) => e.approvalStatus === "approved" && e.departmentId === d.id).reduce((a, e) => a + e.amount, 0)) }));
  const rbCounts = (Object.keys(reimbursementLabels) as ReimbursementStatus[]).map((k) => ({ k, n: fReimb.filter((r) => r.status === k).length }));
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <>
      <PageHeader title="Overview" badge={<DemoBadge />} description={role === "employee" ? "Your expenses and reimbursements." : role === "manager" ? "Your department's budgets and spending." : "Company-wide financial position."} />
      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <select className={nativeSelect} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })}>
          <option value="all">All months</option>{MONTHS.map((m) => <option key={m} value={m}>{new Date(`${m}-15`).toLocaleString("en-US", { month: "long", year: "numeric" })}</option>)}
        </select>
        <select className={nativeSelect} value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}>
          <option value="all">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className={nativeSelect} value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
          <option value="all">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={nativeSelect} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="all">All statuses</option>{(["pending", "approved", "rejected", "changes_requested"] as ApprovalStatus[]).map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Allocated budget" value={money(s.allocated)} hint={`${fBudgets.length} budgets`} />
        <Kpi label="Actual expenses" value={money(s.actual)} hint="Approved only" />
        <Kpi label="Approved, unpaid" value={money(s.approvedUnpaid)} hint="Not yet reimbursed" />
        <Kpi label="Pending approvals" value={String(s.pendingCount)} hint={money(s.pendingAmount)} />
        <Kpi label="Remaining" value={money(s.remaining)} tone="primary" hint={s.allocated ? `${Math.round((s.remaining / s.allocated) * 100)}% available` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Monthly spending" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Area dataKey="spend" stroke="var(--chart-1)" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Spending by department">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byDept} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={80} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="spend" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Budget utilization">
          <div className="grid gap-4">
            {fBudgets.map((b) => {
              const spent = budgetSpent(b, expenses); const pct = Math.min(100, (spent / b.amount) * 100);
              return (
                <div key={b.id}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-foreground">{b.name}</span><span className={pct >= 90 ? "text-destructive" : "text-muted-foreground"}>{Math.round(pct)}%</span></div>
                  <Progress value={pct} className="h-2" />
                  <p className="mt-1 text-[11px] text-muted-foreground">{money(spent)} of {money(b.amount)}</p>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Recent transactions" className="lg:col-span-2" action={<Link to="/expenses" className="text-xs text-primary hover:underline">View all</Link>}>
          <div className="divide-y">
            {recent.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{e.vendor}</p>
                  <p className="text-xs text-muted-foreground">{employees.find((x) => x.id === e.employeeId)?.name} · {e.category} · {e.date}</p>
                </div>
                <div className="flex items-center gap-3"><ApprovalBadge s={e.approvalStatus} /><span className="w-20 text-right font-medium tabular-nums">{money(e.amount, 2)}</span></div>
              </div>
            ))}
            {recent.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No transactions match these filters.</p>}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Upcoming commitments">
          <div className="divide-y">
            {(mode === "demo" ? upcomingCommitments : []).filter((c) => f.dept === "all" || c.departmentId === f.dept).map((c) => (
              <div key={c.id} className="flex justify-between py-2.5 text-sm"><div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">Due {c.due}</p></div><span className="font-medium tabular-nums">{money(c.amount)}</span></div>
            ))}
          </div>
        </Panel>
        <Panel title="Reimbursement status" action={<Link to="/reimbursements" className="text-xs text-primary hover:underline">Open center</Link>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rbCounts.map(({ k, n }) => <div key={k} className="rounded-lg border p-3"><ReimbursementBadge s={k} /><p className="mt-2 font-display text-xl font-semibold">{n}</p></div>)}
          </div>
        </Panel>
      </div>
      {mode === "internal" && sharedTotals.length > 0 && <Panel title="Authorized shared project totals" className="mt-4">{sharedTotals.map(p => <div key={p.project_id} className="flex justify-between py-2 text-sm"><span>{projects.find(x => x.id === p.project_id)?.name}</span><span>{money(p.approved_total)} approved · {money(p.pending_total)} pending</span></div>)}</Panel>}
    </>
  );
}
