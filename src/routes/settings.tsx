import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { integrations } from "@/data/api";
import { CATEGORIES } from "@/data/types";
import { DemoBadge, Field, PageHeader, Panel, Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/settings")({
  head: pageHead("Settings", "Approval policies and integration status."),
  component: Settings,
});

function Settings() {
  const { policy, setPolicy, role } = useStore();
  const [p, setP] = useState(policy);
  const canEdit = role === "admin";
  return (
    <>
      <PageHeader title="Settings" badge={<DemoBadge />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Approval policy">
          <fieldset disabled={!canEdit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Flag expenses above (USD)"><Input type="number" value={p.autoFlagAbove} onChange={(e) => setP({ ...p, autoFlagAbove: Number(e.target.value) })} /></Field>
              <Field label="Receipt required above (USD)"><Input type="number" value={p.receiptRequiredAbove} onChange={(e) => setP({ ...p, receiptRequiredAbove: Number(e.target.value) })} /></Field>
              <Field label="Duplicate window (days)"><Input type="number" value={p.duplicateWindowDays} onChange={(e) => setP({ ...p, duplicateWindowDays: Number(e.target.value) })} /></Field>
              <Field label="Budget alert at (%)"><Input type="number" value={p.budgetAlertPercent} onChange={(e) => setP({ ...p, budgetAlertPercent: Number(e.target.value) })} /></Field>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Categories needing finance review</p>
            <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => {
              const on = p.restrictedCategories.includes(c);
              return <button type="button" key={c} onClick={() => setP({ ...p, restrictedCategories: on ? p.restrictedCategories.filter((x) => x !== c) : [...p.restrictedCategories, c] })} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{c}</button>;
            })}</div>
            <Button onClick={() => { setPolicy(p); toast.success("Policy saved (demo)"); }}>Save policy</Button>
            {!canEdit && <p className="text-xs text-muted-foreground">Only Finance can change policies.</p>}
          </fieldset>
        </Panel>
        <Panel title="Integrations">
          <div className="divide-y">{integrations.map((i) => (
            <div key={i.key} className="flex items-start justify-between gap-3 py-3">
              <div><p className="text-sm font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.note}</p></div>
              <Pill tone="neutral">Not connected</Pill>
            </div>
          ))}</div>
        </Panel>
      </div>
    </>
  );
}
