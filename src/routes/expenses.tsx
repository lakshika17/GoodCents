import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Paperclip, Search } from "lucide-react";
import { useScopedExpenses, useStore } from "@/data/store";
import { CATEGORIES, type ApprovalStatus } from "@/data/types";
import { money } from "@/lib/calc";
import { ApprovalBadge, DemoBadge, PageHeader, Panel, ReimbursementBadge, nativeSelect } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/expenses")({
  head: pageHead("Expenses", "Search and filter submitted expenses and their approval and payment status."),
  component: Expenses,
});

function Expenses() {
  const { employees, departments, reimbursements, role } = useStore();
  const scoped = useScopedExpenses();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");
  const rows = useMemo(() => scoped
    .filter((e) => (status === "all" || e.approvalStatus === status) && (cat === "all" || e.category === cat) && `${e.vendor} ${e.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [scoped, q, status, cat]);
  const total = rows.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader title={role === "employee" ? "My expenses" : "Expenses"} badge={<DemoBadge />} description="Approval status and reimbursement status are tracked separately." />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search vendor or note" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={nativeSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>{(["pending", "approved", "rejected", "changes_requested"] as ApprovalStatus[]).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select className={nativeSelect} value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <Panel className="p-0">
        <div className="flex justify-between border-b px-5 py-3 text-xs text-muted-foreground"><span>{rows.length} expenses</span><span>Total {money(total, 2)}</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr className="border-b">
              <th className="px-5 py-2.5 font-medium">Date</th><th className="px-3 font-medium">Vendor</th><th className="px-3 font-medium">Employee</th><th className="px-3 font-medium">Department</th><th className="px-3 font-medium">Category</th><th className="px-3 font-medium">Approval</th><th className="px-3 font-medium">Payment</th><th className="px-5 text-right font-medium">Amount</th>
            </tr></thead>
            <tbody>
              {rows.map((e) => {
                const rb = reimbursements.find((r) => r.expenseId === e.id);
                return (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{e.date}</td>
                    <td className="px-3 font-medium"><span className="flex items-center gap-1.5">{e.vendor}{e.receiptId && <Paperclip className="h-3 w-3 text-muted-foreground" />}</span></td>
                    <td className="whitespace-nowrap px-3">{employees.find((x) => x.id === e.employeeId)?.name}</td>
                    <td className="whitespace-nowrap px-3 text-muted-foreground">{departments.find((d) => d.id === e.departmentId)?.name}</td>
                    <td className="whitespace-nowrap px-3 text-muted-foreground">{e.category}</td>
                    <td className="px-3"><ApprovalBadge s={e.approvalStatus} /></td>
                    <td className="px-3">{rb ? <ReimbursementBadge s={rb.status} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-5 text-right font-medium tabular-nums">{money(e.amount, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
