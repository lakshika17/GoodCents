import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bot, Check, FileImage, MessageSquare, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import type { Expense } from "@/data/types";
import { budgetForExpense, budgetPending, budgetSpent, findDuplicate, money, policyIssues, recommend } from "@/lib/calc";
import { ApprovalBadge, DemoBadge, PageHeader, Panel, Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from '@/components/ui/checkbox';
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/approvals")({
  head: pageHead("Approvals", "Review expenses with budget, duplicate and policy checks plus an AI recommendation."),
  component: Approvals,
});

function Approvals() {
  const { role, mode } = useStore();
  return role === "employee" || (mode === "internal" && role !== "manager") ? <EmployeeDecisions /> : <ManagerQueue />;
}

function ManagerQueue() {
  const { expenses, role, currentUser } = useStore();
  const queue = expenses.filter((e) => e.approvalStatus === "pending" && (role === "admin" || e.departmentId === currentUser.departmentId)).sort((a, b) => b.date.localeCompare(a.date));
  const [sel, setSel] = useState<string | null>(null);
  const current = queue.find((e) => e.id === sel) ?? queue[0];
  return (
    <>
      <PageHeader title="Approvals" badge={<DemoBadge />} description="AI recommendations are suggestions only — you make the final decision." />
      {queue.length === 0 ? <Panel><p className="py-10 text-center text-sm text-muted-foreground">Nothing waiting for approval. 🎉</p></Panel> : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Panel title={`Queue (${queue.length})`} className="p-3">
            <div className="grid max-h-[70vh] gap-1 overflow-auto">
              {queue.map((e) => <QueueItem key={e.id} e={e} active={current?.id === e.id} onClick={() => setSel(e.id)} />)}
            </div>
          </Panel>
          {current && <ReviewCard key={current.id} e={current} />}
        </div>
      )}
    </>
  );
}

function QueueItem({ e, active, onClick }: { e: Expense; active: boolean; onClick: () => void }) {
  const { employees } = useStore();
  return (
    <button onClick={onClick} className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm", active ? "bg-accent" : "hover:bg-muted")}>
      <div className="min-w-0"><p className="truncate font-medium">{e.vendor}</p><p className="text-xs text-muted-foreground">{employees.find((x) => x.id === e.employeeId)?.name} · {e.date}</p></div>
      <span className="font-medium tabular-nums">{money(e.amount, 2)}</span>
    </button>
  );
}

function ReviewCard({ e }: { e: Expense }) {
  const { employees, departments, projects, budgets, expenses, receipts, policy, decide, approvals } = useStore();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const budget = budgetForExpense(e, budgets);
  const available = budget ? budget.amount - budgetSpent(budget, expenses) - (budgetPending(budget, expenses) - e.amount) : 0;
  const dup = findDuplicate(e, expenses, policy.duplicateWindowDays);
  const issues = policyIssues(e, policy);
  const rec = recommend(e, { duplicate: !!dup, issues, available });
  const receipt = receipts.find((r) => r.id === e.receiptId);

  const act = async (d: "approved" | "rejected" | "changes_requested") => {
    if (d === "changes_requested" && !comment.trim()) { toast.error("Add a comment describing the changes needed"); return; }
    if (busy) return; setBusy(true);
    try { await decide(e.id, d, comment.trim()); toast.success(`Expense ${d.replace("_", " ")}`); } catch { /* store reports the failure */ } finally { setBusy(false); }
  };

  return (
    <Panel className="min-w-0">
      <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-lg border bg-muted text-xs text-muted-foreground">
          {receipt?.previewUrl && receipt.fileType === "application/pdf" ? <object data={receipt.previewUrl} type="application/pdf" aria-label={`Preview of ${receipt.fileName}`} className="h-full w-full"><span className="grid h-full place-items-center p-3 text-center">PDF preview unavailable. <a className="text-primary underline" href={receipt.previewUrl} target="_blank" rel="noreferrer">Open PDF</a></span></object> : receipt?.previewUrl ? <img src={receipt.previewUrl} alt="Receipt" className="h-full w-full object-cover" /> : receipt ? <span className="grid justify-items-center gap-2 p-3 text-center"><FileImage className="h-6 w-6" />{receipt.fileName}<span>Preview unavailable for this file</span></span> : <span className="grid justify-items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />No receipt</span>}
        </div>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="text-xl font-semibold">{e.vendor}</h2><p className="text-sm text-muted-foreground">{e.description}</p>{e.documentType && <p className="mt-1 text-xs text-muted-foreground">{e.documentType} · {e.currency ?? "Unknown currency"} · {e.documentNumber ?? 'No document number'} · {e.source === "ai" ? "AI-extracted" : e.source === "ai_corrected" ? "AI-extracted, corrected" : "manually entered"}{e.verified === true ? " · confirmed by submitter" : " · not confirmed"}</p>}</div>
            <p className="font-display text-2xl font-semibold">{money(e.amount, 2)}</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            {[["Employee", employees.find((x) => x.id === e.employeeId)?.name], ["Date", e.date], ["Category", e.category], ["Department", departments.find((d) => d.id === e.departmentId)?.name], ["Project", projects.find((p) => p.id === e.projectId)?.name ?? "—"], ["Available budget", budget ? money(available) : "No budget"]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {dup ? <Pill tone="danger"><AlertTriangle className="h-3 w-3" />Possible duplicate of {dup.id} ({dup.date})</Pill> : <Pill tone="success"><Check className="h-3 w-3" />No duplicate found</Pill>}
            {issues.length ? issues.map((i) => <Pill key={i} tone="warning">{i}</Pill>) : <Pill tone="success"><ShieldCheck className="h-3 w-3" />Policy compliant</Pill>}
            {e.amount > available && <Pill tone="danger">Exceeds available budget</Pill>}
          </div>
          <div className="mt-4 rounded-lg border bg-accent/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold"><Bot className="h-4 w-4 text-primary" />AI recommendation: <span className="capitalize">{rec.action}</span></p>
              <DemoBadge>Rule-based demo · not live AI</DemoBadge>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Submitted revision {e.version ?? 1} · {e.currency ?? 'Unknown currency'} · {e.paymentResponsibility ?? 'Unknown responsibility'}</p>
          {approvals.filter(a => a.expenseId === e.id).map(a => <p key={a.id} className="mt-2 text-xs text-muted-foreground">Revision {a.version ?? 1}: {a.decision} — {a.comment}</p>)}
          <Textarea className="mt-4" placeholder="Comment (required when requesting changes)" value={comment} onChange={(ev) => setComment(ev.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy || e.verified !== true} onClick={() => void act("approved")}><Check className="h-4 w-4" />Approve</Button>
            <Button variant="outline" disabled={busy} onClick={() => void act("changes_requested")}><MessageSquare className="h-4 w-4" />Request changes</Button>
            <Button variant="outline" className="text-destructive" onClick={() => act("rejected")}><X className="h-4 w-4" />Reject</Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function EmployeeDecisions() {
  const { expenses, approvals, currentUser, respondToChanges } = useStore();
  const mine = expenses.filter((e) => e.employeeId === currentUser.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  return (
    <>
      <PageHeader title="My approvals" badge={<DemoBadge />} description="See manager decisions and respond to change requests." />
      <div className="grid gap-3">
        {mine.map((e) => {
          const history = approvals.filter((x) => x.expenseId === e.id).sort((a,b) => (b.version ?? 1) - (a.version ?? 1));
          const a = history[0];
          return (
            <Panel key={e.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium">{e.vendor} · {money(e.amount, 2)}</p><p className="text-xs text-muted-foreground">{e.date} · {e.category}</p></div>
                <ApprovalBadge s={e.approvalStatus} />
              </div>
              {e.approvalStatus === "approved" && <p className="mt-2 text-sm text-muted-foreground">Approved — awaiting payment · revision {e.version ?? 1}. Payments disabled.</p>}
              {a && a.comment && <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm"><span className="font-medium">Manager:</span> {a.comment}</p>}
              {e.approvalStatus === "changes_requested" && <ChangeResponse e={e} onSend={async (msg, patch) => { await respondToChanges(e.id, msg, { ...patch, verified: true }); toast.success("Resubmitted for approval"); }} />}
            </Panel>
          );
        })}
      </div>
    </>
  );
}

function ChangeResponse({ e, onSend }: { e: Expense; onSend: (msg: string, patch: Partial<Expense>) => Promise<void> }) {
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState(String(e.amount));
  const [vendor, setVendor] = useState(e.vendor);
  const [date, setDate] = useState(e.date);
  const [documentNumber, setDocumentNumber] = useState(e.documentNumber ?? '');
  const [description, setDescription] = useState(e.description);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const change = (set: (v: string) => void, v: string) => { set(v); setConfirmed(false); };
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <Input aria-label="Corrected vendor" value={vendor} onChange={ev => change(setVendor, ev.target.value)} />
      <Input type="number" step="0.01" value={amount} onChange={ev => change(setAmount, ev.target.value)} aria-label="Corrected amount" />
      <Input type="date" aria-label="Corrected date" value={date} onChange={ev => change(setDate, ev.target.value)} />
      <Input aria-label="Corrected document number" value={documentNumber} onChange={ev => change(setDocumentNumber, ev.target.value)} />
      <Input aria-label="Corrected note" value={description} onChange={ev => change(setDescription, ev.target.value)} />
      <Input placeholder="Your response" value={msg} onChange={ev => change(setMsg, ev.target.value)} />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} aria-label="Confirm corrected expense" />I checked all corrected details and my personal payment evidence against the receipt.</label>
      <Button disabled={busy || !msg.trim() || !confirmed} onClick={async () => { setBusy(true); try { await onSend(msg, { amount: Number(amount), vendor, date, documentNumber: documentNumber || null, description }); } catch { /* store reports failure */ } finally { setBusy(false); } }}>Resubmit</Button>
    </div>
  );
}
