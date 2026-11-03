import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import type { Reimbursement, ReimbursementStatus } from "@/data/types";
import { money } from "@/lib/calc";
import { DemoBadge, Kpi, NotConnected, PageHeader, Panel, ReimbursementBadge, nativeSelect, reimbursementLabels } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/reimbursements")({
  head: pageHead("Reimbursements", "PayPal reimbursement center with authorization and payment status tracking."),
  component: Reimbursements,
});

function Reimbursements() {
  const { reimbursements, expenses, employees, role, currentUser, setReimbursementStatus } = useStore();
  const [filter, setFilter] = useState<"all" | ReimbursementStatus>("all");
  const [confirm, setConfirm] = useState<Reimbursement | null>(null);
  const [detail, setDetail] = useState<Reimbursement | null>(null);
  const scoped = role === "employee" ? reimbursements.filter((r) => r.employeeId === currentUser.id)
    : role === "manager" ? reimbursements.filter((r) => employees.find((e) => e.id === r.employeeId)?.departmentId === currentUser.departmentId) : reimbursements;
  const rows = scoped.filter((r) => filter === "all" || r.status === filter);
  const sum = (s: ReimbursementStatus) => scoped.filter((r) => r.status === s).reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <PageHeader title="PayPal Reimbursement Center" badge={<DemoBadge>Demo statuses only</DemoBadge>} description="Approved expenses become reimbursements. Payouts require explicit authorization by Finance." />
      <div className="mb-4"><NotConnected>PayPal Payouts is not connected. No money is sent and no credentials are stored. Authorizing only changes the demo status to “Queued”.</NotConnected></div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Awaiting authorization" value={money(sum("awaiting_authorization"))} />
        <Kpi label="Queued / processing" value={money(sum("queued") + sum("processing"))} />
        <Kpi label="Paid (demo)" value={money(sum("paid"))} />
        <Kpi label="Failed" value={money(sum("failed"))} />
      </div>
      <Panel className="p-0">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
          <p className="text-sm font-semibold">Payments</p>
          <select className={`${nativeSelect} w-52`} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All statuses</option>{Object.entries(reimbursementLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="px-5 py-2.5 font-medium">Employee</th><th className="px-3 font-medium">Expense</th><th className="px-3 font-medium">Status</th><th className="px-3 font-medium">PayPal reference</th><th className="px-3 text-right font-medium">Amount</th><th className="px-5" /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const e = expenses.find((x) => x.id === r.expenseId);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-2.5 font-medium">{employees.find((x) => x.id === r.employeeId)?.name}</td>
                    <td className="whitespace-nowrap px-3 text-muted-foreground">{e?.vendor} · {e?.date}</td>
                    <td className="px-3"><ReimbursementBadge s={r.status} /></td>
                    <td className="whitespace-nowrap px-3 font-mono text-xs text-muted-foreground">{r.paypalReference ?? "—"}</td>
                    <td className="px-3 text-right font-medium tabular-nums">{money(r.amount, 2)}</td>
                    <td className="whitespace-nowrap px-5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>History</Button>
                      {role === "admin" && (r.status === "awaiting_authorization" || r.status === "failed") && <Button size="sm" variant="outline" onClick={() => setConfirm(r)}><ShieldCheck className="h-3.5 w-3.5" />Authorize</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Authorize reimbursement?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && `${money(confirm.amount, 2)} to ${employees.find((e) => e.id === confirm.employeeId)?.name}. `}
              This is a demo: the status will move to “Queued”. No PayPal payment will be made.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) { setReimbursementStatus(confirm.id, "queued", `Authorized by ${currentUser.name} (demo)`); toast.success("Queued (demo) — no payment sent"); } setConfirm(null); }}>Authorize (demo)</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment history</DialogTitle></DialogHeader>
          <ol className="grid gap-3">
            {reimbursements.find((r) => r.id === detail?.id)?.history.map((h, i) => (
              <li key={i} className="flex items-start justify-between gap-2 border-l-2 border-primary/30 pl-3 text-sm"><div><ReimbursementBadge s={h.status} /><p className="mt-1 text-muted-foreground">{h.note}</p></div><span className="text-xs text-muted-foreground">{h.date}</span></li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
