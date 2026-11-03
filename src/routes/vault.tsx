import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bot, Lock, ShieldCheck, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { updateVault, useVault, vaultId } from "@/data/vault-store";
import { completedOn, releaseBlockers, securityAlerts, vaultSummary } from "@/lib/vault";
import { DEMO_TODAY } from "@/data/seed";
import { money } from "@/lib/calc";
import { DemoBadge, Field, Kpi, NotConnected, PageHeader, Panel, Pill, ReimbursementBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/vault")({
  head: pageHead("Secure Spend Vault", "Limited spending allowance with limits, freeze controls and separate payment authorization."),
  component: Vault,
});

function Vault() {
  const { mode } = useStore();
  return (
    <>
      <PageHeader title="Secure Spend Vault" badge={<DemoBadge>DEMO ONLY · Fictional money</DemoBadge>} description="A limited spending allowance for purchases and reimbursements — never direct access to the company bank account." />
      <div className="mb-4"><NotConnected>PayPal Payouts sandbox is not connected yet. The allowance is an authorization limit, not a wallet balance — no funds are deposited or sent, and no bank or card credentials are stored.</NotConnected></div>
      {mode === "internal" ? <Panel><p className="py-8 text-center text-sm text-muted-foreground">The vault is available in the sample-data preview only until its secure backend and PayPal sandbox connection are built.</p></Panel> : <VaultBody />}
    </>
  );
}

function VaultBody() {
  const { role, canAuthorize, currentUser, reimbursements, employees, setReimbursementStatus } = useStore();
  const v = useVault();
  const controller = role === "admin" || canAuthorize; // Terry (Founder) or an authorized finance administrator
  const name = (id: string) => employees.find((e) => e.id === id)?.name ?? id;
  const open = reimbursements.filter((r) => ["awaiting_authorization", "queued", "processing"].includes(r.status));
  const approvedVendor = v.requests.filter((r) => r.status === "manager_approved");
  const reserved = open.reduce((s, r) => s + r.amount, 0) + approvedVendor.reduce((s, r) => s + r.amount, 0);
  const sum = vaultSummary(v.settings, v.payments, reserved);
  const alerts = securityAlerts(v.settings, v.payments);
  const actor = `${currentUser.name}`;

  const release = (o: { kind: "reimbursement" | "vendor"; refId: string; payeeId: string; payeeName: string; amount: number; done: () => void }) => {
    const blockers = releaseBlockers({ settings: v.settings, payments: v.payments, amount: o.amount, refId: o.refId, today: DEMO_TODAY, payeeId: o.payeeId, authorizerId: currentUser.id, canAuthorize: controller });
    if (blockers.length) { toast.error(blockers.join(" ")); updateVault((s) => s, actor, `Blocked release of ${money(o.amount, 2)} to ${o.payeeName}: ${blockers.join(" ")}`); return; }
    const ref = `SANDBOX-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    updateVault((s) => ({ ...s, payments: [{ id: vaultId("vp"), kind: o.kind, refId: o.refId, payeeId: o.payeeId, payeeName: o.payeeName, amount: o.amount, date: DEMO_TODAY, status: "completed", sandboxReference: ref, authorizedBy: currentUser.id, note: "Simulated PayPal sandbox payout" }, ...s.payments] }), actor, `Released ${money(o.amount, 2)} to ${o.payeeName} (demo ${ref})`);
    o.done();
    toast.success(`Demo payment recorded (${ref}) — no real money sent`);
  };

  return (
    <div className="grid gap-4">
      {v.settings.frozen && <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-danger-soft px-4 py-3 text-sm text-destructive"><Snowflake className="h-4 w-4" />New payments are frozen. Requests can still be submitted and approved.</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Authorized allowance" value={money(v.settings.allowance)} hint="Demo limit, not a balance" />
        <Kpi label="Available allowance" value={money(sum.available)} tone="primary" />
        <Kpi label="Reserved for approved payments" value={money(sum.reserved)} />
        <Kpi label="Payments completed (demo)" value={money(sum.paid, 2)} />
        <Kpi label="Pending reimbursements" value={String(open.length)} hint={money(open.reduce((s, r) => s + r.amount, 0), 2)} />
        <Kpi label="Vendor payment requests" value={String(v.requests.filter((r) => r.status === "pending_manager" || r.status === "manager_approved").length)} />
        <Kpi label="Daily limit" value={money(v.settings.dailyLimit)} hint={`${money(completedOn(v.payments, DEMO_TODAY), 2)} used today`} />
        <Kpi label="Per-transaction limit" value={money(v.settings.perTransactionLimit)} />
      </div>

      {controller ? <Controls /> : <Panel title="Vault controls"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" />Only Terry or an authorized finance administrator can change limits, freeze payments or release funds.</p></Panel>}

      <VendorRequests />

      <Panel title="Reimbursements awaiting payment" className="p-0">
        {open.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Nothing awaiting payment.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>
            {open.filter((r) => controller || r.employeeId === currentUser.id).map((r) => {
              const blockers = releaseBlockers({ settings: v.settings, payments: v.payments, amount: r.amount, refId: r.id, today: DEMO_TODAY, payeeId: r.employeeId, authorizerId: currentUser.id, canAuthorize: controller });
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-5 py-2.5 font-medium">{name(r.employeeId)}</td>
                  <td className="px-3"><ReimbursementBadge s={r.status} /></td>
                  <td className="px-3 text-xs text-muted-foreground"><Bot className="mr-1 inline h-3 w-3" />{blockers.filter((b) => !b.startsWith("Only")).length ? `Vault check: ${blockers.filter((b) => !b.startsWith("Only")).join(" ")}` : "Vault check passed — human authorization required"}</td>
                  <td className="px-3 text-right tabular-nums">{money(r.amount, 2)}</td>
                  <td className="px-5 text-right">{controller && <Button size="sm" disabled={blockers.length > 0} onClick={() => release({ kind: "reimbursement", refId: r.id, payeeId: r.employeeId, payeeName: name(r.employeeId), amount: r.amount, done: () => setReimbursementStatus(r.id, "paid", "Paid via PayPal sandbox (DEMO ONLY)") })}>Authorize demo payment</Button>}</td>
                </tr>
              );
            })}
          </tbody></table></div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent payment activity">
          {v.payments.filter((p) => controller || p.payeeId === currentUser.id).length === 0 ? <p className="text-sm text-muted-foreground">No demo payments yet.</p> :
            <ul className="grid gap-2 text-sm">{v.payments.filter((p) => controller || p.payeeId === currentUser.id).slice(0, 12).map((p) => (
              <li key={p.id} className="flex justify-between gap-2"><span><span className="font-medium">{p.payeeName}</span> <span className="text-xs text-muted-foreground">· {p.kind} · {p.sandboxReference} · by {name(p.authorizedBy)}</span></span><span className="tabular-nums">{money(p.amount, 2)}</span></li>))}</ul>}
        </Panel>
        {controller && <Panel title="Security alerts & audit history">
          <div className="mb-3 flex flex-wrap gap-2">{alerts.length ? alerts.map((a) => <Pill key={a} tone="warning"><AlertTriangle className="h-3 w-3" />{a}</Pill>) : <Pill tone="success"><ShieldCheck className="h-3 w-3" />No unusual activity</Pill>}</div>
          <ul className="grid max-h-64 gap-1.5 overflow-auto text-xs text-muted-foreground">{v.audit.map((a) => <li key={a.id}><span className="tabular-nums">{a.date}</span> · <span className="text-foreground">{a.actor}</span> — {a.action}</li>)}{!v.audit.length && <li>No vault activity yet.</li>}</ul>
        </Panel>}
      </div>
    </div>
  );
}

function Controls() {
  const { currentUser } = useStore();
  const v = useVault();
  const [f, setF] = useState({ allowance: String(v.settings.allowance), dailyLimit: String(v.settings.dailyLimit), perTransactionLimit: String(v.settings.perTransactionLimit) });
  const save = () => {
    const next = { allowance: Number(f.allowance), dailyLimit: Number(f.dailyLimit), perTransactionLimit: Number(f.perTransactionLimit) };
    if (Object.values(next).some((x) => !(x >= 0))) { toast.error("Limits must be zero or more"); return; }
    if (next.perTransactionLimit > next.dailyLimit) { toast.error("Per-transaction limit cannot exceed the daily limit"); return; }
    updateVault((s) => ({ ...s, settings: { ...s.settings, ...next } }), currentUser.name, `Set allowance ${money(next.allowance)}, daily ${money(next.dailyLimit)}, per-transaction ${money(next.perTransactionLimit)}`);
    toast.success("Vault limits updated (demo)");
  };
  const toggle = () => { const frozen = !v.settings.frozen; updateVault((s) => ({ ...s, settings: { ...s.settings, frozen } }), currentUser.name, frozen ? "Froze new payments" : "Unfroze payments"); toast.success(frozen ? "New payments frozen" : "Payments unfrozen"); };
  return (
    <Panel title="Terry's controls" action={<Button size="sm" variant={v.settings.frozen ? "default" : "outline"} className={v.settings.frozen ? "" : "text-destructive"} onClick={toggle}><Snowflake className="h-4 w-4" />{v.settings.frozen ? "Unfreeze payments" : "Emergency freeze"}</Button>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Spending allowance (USD)"><Input type="number" min="0" value={f.allowance} onChange={(e) => setF({ ...f, allowance: e.target.value })} /></Field>
        <Field label="Daily limit (USD)"><Input type="number" min="0" value={f.dailyLimit} onChange={(e) => setF({ ...f, dailyLimit: e.target.value })} /></Field>
        <Field label="Per-transaction limit (USD)"><Input type="number" min="0" value={f.perTransactionLimit} onChange={(e) => setF({ ...f, perTransactionLimit: e.target.value })} /></Field>
        <Button onClick={save}>Save limits</Button>
      </div>
    </Panel>
  );
}

function VendorRequests() {
  const { role, canAuthorize, currentUser, employees } = useStore();
  const v = useVault();
  const controller = role === "admin" || canAuthorize;
  const [f, setF] = useState({ vendor: "", amount: "", reason: "" });
  const name = (id: string) => employees.find((e) => e.id === id)?.name ?? id;
  const submit = () => {
    const amount = Number(f.amount);
    if (!f.vendor.trim() || !(amount > 0) || !f.reason.trim()) { toast.error("Enter vendor, amount and reason"); return; }
    updateVault((s) => ({ ...s, requests: [{ id: vaultId("vr"), requesterId: currentUser.id, vendor: f.vendor.trim(), amount, reason: f.reason.trim(), date: DEMO_TODAY, status: "pending_manager", managerId: null }, ...s.requests] }), currentUser.name, `Requested vendor purchase ${f.vendor.trim()} ${money(amount, 2)}`);
    setF({ vendor: "", amount: "", reason: "" }); toast.success("Vendor purchase requested — awaiting manager approval");
  };
  const setStatus = (id: string, status: "manager_approved" | "rejected" | "paid", action: string) => updateVault((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? { ...r, status, managerId: status === "manager_approved" ? currentUser.id : r.managerId } : r)) }), currentUser.name, action);
  const visible = v.requests.filter((r) => controller || role === "manager" ? true : r.requesterId === currentUser.id);
  const today = v.payments.filter((p) => p.status === "completed" && p.date === DEMO_TODAY).reduce((s, p) => s + p.amount, 0);
  return (
    <Panel title="Vendor purchase requests">
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_140px_1.4fr_auto] sm:items-end">
        <Field label="Vendor"><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="Amount (USD)"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Reason"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <Button variant="outline" onClick={submit}>Request purchase</Button>
      </div>
      <ul className="grid gap-2 text-sm">
        {visible.map((r) => {
          const mine = r.requesterId === currentUser.id;
          const aiNote = r.amount > v.settings.perTransactionLimit ? "AI check: exceeds per-transaction limit — recommend reject or split" : today + r.amount > v.settings.dailyLimit ? "AI check: would exceed today's limit — recommend waiting" : "AI check: within limits — recommendation only";
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="min-w-0"><p className="font-medium">{r.vendor} · {money(r.amount, 2)}</p><p className="text-xs text-muted-foreground">{name(r.requesterId)} · {r.reason} · {r.date}</p><p className="text-xs text-muted-foreground"><Bot className="mr-1 inline h-3 w-3" />{aiNote}</p></div>
              <div className="flex items-center gap-2">
                <Pill tone={r.status === "paid" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{r.status === "pending_manager" ? "Awaiting manager" : r.status === "manager_approved" ? "Awaiting finance authorization" : r.status === "paid" ? "Paid (demo)" : "Rejected"}</Pill>
                {r.status === "pending_manager" && (role === "manager" || role === "admin") && !mine && <>
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "manager_approved", `Manager approved ${r.vendor} ${money(r.amount, 2)}`)}>Approve</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(r.id, "rejected", `Rejected ${r.vendor} ${money(r.amount, 2)}`)}>Reject</Button></>}
                {r.status === "manager_approved" && controller && <VendorRelease id={r.id} />}
              </div>
            </li>
          );
        })}
        {!visible.length && <li className="text-muted-foreground">No vendor requests.</li>}
      </ul>
    </Panel>
  );
}

function VendorRelease({ id }: { id: string }) {
  const { currentUser, canAuthorize, role } = useStore();
  const v = useVault();
  const r = v.requests.find((x) => x.id === id)!;
  const blockers = releaseBlockers({ settings: v.settings, payments: v.payments, amount: r.amount, refId: r.id, today: DEMO_TODAY, payeeId: r.requesterId, authorizerId: currentUser.id, canAuthorize: role === "admin" || canAuthorize, approverId: r.managerId });
  const go = () => {
    if (blockers.length) { toast.error(blockers.join(" ")); return; }
    const ref = `SANDBOX-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    updateVault((s) => ({ ...s, requests: s.requests.map((x) => (x.id === id ? { ...x, status: "paid" } : x)), payments: [{ id: vaultId("vp"), kind: "vendor", refId: r.id, payeeId: r.requesterId, payeeName: r.vendor, amount: r.amount, date: DEMO_TODAY, status: "completed", sandboxReference: ref, authorizedBy: currentUser.id, note: "Simulated PayPal sandbox vendor payout" }, ...s.payments] }), currentUser.name, `Released vendor payment ${r.vendor} ${money(r.amount, 2)} (demo ${ref})`);
    toast.success(`Demo vendor payment recorded (${ref}) — no real money sent`);
  };
  return <>
    <Button size="sm" disabled={blockers.length > 0} title={blockers.join(" ")} onClick={go}>Authorize demo payment</Button>
    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateVault((s) => ({ ...s, requests: s.requests.map((x) => (x.id === id ? { ...x, status: "rejected" } : x)) }), currentUser.name, `Rejected payment authorization ${r.vendor} ${money(r.amount, 2)}`)}>Reject</Button>
    {blockers.length > 0 && <span className="w-full text-right text-xs text-destructive">{blockers.join(" ")}</span>}
  </>;
}
