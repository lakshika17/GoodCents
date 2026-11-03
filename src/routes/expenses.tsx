import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Paperclip, Search } from "lucide-react";
import { useScopedExpenses, useStore } from "@/data/store";
import { CATEGORIES, type ApprovalStatus } from "@/data/types";
import { money } from "@/lib/calc";
import { ApprovalBadge, DemoBadge, PageHeader, Panel, ReimbursementBadge, nativeSelect } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { canSubmitForApproval } from "@/lib/documents";
import type { SavedDocument } from "@/data/types";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/expenses")({
  head: pageHead("Expenses", "Search and filter submitted expenses and their approval and payment status."),
  component: Expenses,
});

function Expenses() {
  const { employees, departments, reimbursements, role, currentUser, voidExpense } = useStore();
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
                    <td className="px-3"><span className="flex items-center gap-2"><ApprovalBadge s={e.approvalStatus} />{e.approvalStatus === "pending" && e.employeeId === currentUser.id && e.documentType && <button className="text-xs text-destructive hover:underline" onClick={() => { if (window.confirm(`Void ${e.vendor} ${money(e.amount, 2)}? This removes it and its approval request.`)) { voidExpense(e.id); toast.success("Expense voided and removed from the approval queue"); } }}>Void</button>}</span></td>
                    <td className="px-3">{rb ? <ReimbursementBadge s={rb.status} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-5 text-right font-medium tabular-nums">{money(e.amount, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <SavedDocuments />
    </>
  );
}

function SavedDocuments() {
  const { documents, currentUser, role, voidDocument, submitExpense, mode } = useStore();
  const visible = documents.filter((d) => role === "admin" || d.employeeId === currentUser.id);
  const submitDraft = async (d: SavedDocument) => {
    if (!d.amount || !canSubmitForApproval({ ...d, amount: d.amount })) { toast.error("Open a new upload to finish and verify this draft before submitting."); return; }
    await submitExpense({ vendor: d.vendor, amount: d.amount, date: d.date, category: d.category, departmentId: d.departmentId, projectId: d.projectId, description: d.description, documentType: d.documentType, verified: d.verified, currency: d.currency, source: d.source }, d.fileName && d.fileType ? { fileName: d.fileName, fileType: d.fileType, previewUrl: d.previewUrl, extractionSimulated: false } : undefined);
    voidDocument(d.id);
    toast.success("Draft submitted for approval");
  };
  return (
    <Panel title="Saved documents" className="mt-4 p-0">
      <p className="border-b px-5 py-3 text-xs text-muted-foreground">Drafts, quotes, purchase orders, customer documents and voided items. None of these count toward spending or reimbursements.{mode === "internal" && " Saving these to company records is not available yet."}</p>
      {visible.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No saved documents yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="px-5 py-2.5 font-medium">Date</th><th className="px-3 font-medium">Type</th><th className="px-3 font-medium">Vendor / customer</th><th className="px-3 font-medium">Details</th><th className="px-3 font-medium">Status</th><th className="px-3 font-medium">File</th><th className="px-3 text-right font-medium">Amount</th><th className="px-5" /></tr></thead>
          <tbody>{visible.map((d) => (
            <tr key={d.id} className="border-b last:border-0">
              <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{d.date || "—"}</td>
              <td className="whitespace-nowrap px-3">{d.documentType}</td>
              <td className="px-3 font-medium">{d.vendor || "—"}{d.documentNumber && <span className="block text-xs font-normal text-muted-foreground">{d.documentNumber}</span>}</td>
              <td className="whitespace-nowrap px-3 text-xs text-muted-foreground">{d.source === "ai" ? "AI-extracted" : d.source === "ai_corrected" ? "AI, corrected" : "Manual"}</td>
              <td className="px-3 capitalize text-muted-foreground">{d.status}{d.status !== "void" && !d.verified ? " · unverified" : ""}</td>
              <td className="px-3">{d.previewUrl ? <a className="text-primary hover:underline" href={d.previewUrl} target="_blank" rel="noreferrer">{d.fileName}</a> : <span className="text-muted-foreground">{d.fileName ?? "—"}</span>}</td>
              <td className="px-3 text-right tabular-nums">{d.amount ? `${d.amount.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${d.currency}` : "—"}</td>
              <td className="whitespace-nowrap px-5 text-right">{d.status === "draft" && d.employeeId === currentUser.id && <span className="flex justify-end gap-2">
                {(d.documentType === "Paid Receipt" || d.documentType === "Supplier Invoice") && <Button size="sm" variant="outline" onClick={() => void submitDraft(d)}>Submit</Button>}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => voidDocument(d.id)}>Void</Button></span>}
                {d.status === "saved" && d.employeeId === currentUser.id && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => voidDocument(d.id)}>Void</Button>}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </Panel>
  );
}
