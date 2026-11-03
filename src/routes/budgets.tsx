import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import type { Budget } from "@/data/types";
import { budgetPending, budgetSpent, money } from "@/lib/calc";
import { DemoBadge, Field, PageHeader, Panel, Pill, nativeSelect } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead } from "@/lib/meta";
import { DEMO_TODAY } from "@/data/seed";

export const Route = createFileRoute("/budgets")({
  head: pageHead("Budgets", "Allocate, monitor and compare department and project budgets."),
  component: Budgets,
});

function Budgets() {
  const { budgets, expenses, departments, projects, employees, role, currentUser, upsertBudget, uid } = useStore();
  const [edit, setEdit] = useState<Budget | null>(null);
  const visible = role === "manager" ? budgets.filter((b) => b.departmentId === currentUser.departmentId) : budgets;
  const canEdit = role === "admin";
  const chart = visible.map((b) => ({ name: b.name.split(" ")[0], Budget: b.amount, Actual: Math.round(budgetSpent(b, expenses)) }));

  const blank = (): Budget => ({ id: uid("b"), name: "", departmentId: departments[0]!.id, projectId: null, ownerId: employees[0]!.id, amount: 0, period: "H2 2026", history: [] });

  return (
    <>
      <PageHeader title="Budgets" badge={<DemoBadge />} description="Budgets map to departments and projects. Actuals count approved expenses only — approval does not mean paid."
        actions={canEdit && <Button onClick={() => setEdit(blank())}><Plus className="h-4 w-4" />New budget</Button>} />
      <Panel title="Budget vs actual" className="mb-4">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Legend />
              <Bar dataKey="Budget" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Actual" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((b) => {
          const spent = budgetSpent(b, expenses); const pending = budgetPending(b, expenses);
          const pct = (spent / b.amount) * 100; const over = spent + pending > b.amount;
          return (
            <Panel key={b.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{b.name}</h3>
                  <p className="text-xs text-muted-foreground">{departments.find((d) => d.id === b.departmentId)?.name}{b.projectId && ` · ${projects.find((p) => p.id === b.projectId)?.name}`} · Owner: {employees.find((e) => e.id === b.ownerId)?.name} · {b.period}</p>
                </div>
                <div className="flex items-center gap-1">
                  {over && <Pill tone="danger"><AlertTriangle className="h-3 w-3" />At risk</Pill>}
                  {canEdit && <Button size="icon" variant="ghost" onClick={() => setEdit(b)} aria-label="Edit budget"><Pencil className="h-4 w-4" /></Button>}
                </div>
              </div>
              <Progress value={Math.min(100, pct)} className="my-3 h-2" />
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-muted-foreground">Budget</p><p className="font-semibold">{money(b.amount)}</p></div>
                <div><p className="text-muted-foreground">Actual</p><p className="font-semibold">{money(spent)}</p></div>
                <div><p className="text-muted-foreground">Pending</p><p className="font-semibold">{money(pending)}</p></div>
                <div><p className="text-muted-foreground">Remaining</p><p className={`font-semibold ${b.amount - spent < 0 ? "text-destructive" : ""}`}>{money(b.amount - spent)}</p></div>
              </div>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-primary">Budget history ({b.history.length})</summary>
                <ul className="mt-2 grid gap-1 text-muted-foreground">
                  {b.history.map((h, i) => <li key={i} className="flex justify-between"><span>{h.date} · {h.note}</span><span>{money(h.amount)}</span></li>)}
                </ul>
              </details>
            </Panel>
          );
        })}
      </div>
      {edit && <BudgetDialog budget={edit} onClose={() => setEdit(null)} onSave={(b) => {
        const prev = budgets.find((x) => x.id === b.id);
        const history = !prev ? [{ date: DEMO_TODAY, note: "Created", amount: b.amount }] : prev.amount !== b.amount ? [...b.history, { date: DEMO_TODAY, note: "Amount changed", amount: b.amount }] : b.history;
        upsertBudget({ ...b, history }); setEdit(null); toast.success("Budget saved (demo)");
      }} />}
    </>
  );
}

function BudgetDialog({ budget, onClose, onSave }: { budget: Budget; onClose: () => void; onSave: (b: Budget) => void }) {
  const { departments, projects, projectDepartments, employees } = useStore();
  const [b, setB] = useState(budget);
  const projOpts = projects.filter((p) => projectDepartments.some((pd) => pd.projectId === p.id && pd.departmentId === b.departmentId));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{budget.name ? "Edit budget" : "New budget"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Name"><Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department"><select className={nativeSelect} value={b.departmentId} onChange={(e) => setB({ ...b, departmentId: e.target.value, projectId: null })}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Project"><select className={nativeSelect} value={b.projectId ?? ""} onChange={(e) => setB({ ...b, projectId: e.target.value || null })}><option value="">None</option>{projOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (USD)"><Input type="number" value={b.amount || ""} onChange={(e) => setB({ ...b, amount: Number(e.target.value) })} /></Field>
            <Field label="Period"><Input value={b.period} onChange={(e) => setB({ ...b, period: e.target.value })} /></Field>
          </div>
          <Field label="Owner"><select className={nativeSelect} value={b.ownerId} onChange={(e) => setB({ ...b, ownerId: e.target.value })}>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
          <Button disabled={!b.name || b.amount <= 0} onClick={() => onSave(b)}>Save budget</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
