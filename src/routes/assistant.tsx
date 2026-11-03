import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, User } from "lucide-react";
import { useStore } from "@/data/store";
import { DEMO_TODAY } from "@/data/seed";
import { budgetSpent, money, summarize } from "@/lib/calc";
import { DemoBadge, NotConnected, PageHeader, Panel } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistant")({
  head: pageHead("AI CFO Assistant", "Ask questions about spending, budgets, approvals and reimbursements."),
  component: Assistant,
});

const SUGGESTED = [
  "How much money have we spent this month?",
  "Which department is spending the most?",
  "Can we afford another $2,000 purchase?",
  "How many reimbursements are pending?",
  "What expenses need approval?",
];

type Msg = { from: "user" | "bot"; text: string; unsupported?: boolean };

function Assistant() {
  const store = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "Hi! I can answer a few questions from the demo dataset. Try a suggestion below." }]);
  const [q, setQ] = useState("");

  // Deterministic answers from sample data. Future: replace with askAssistant() via a server function.
  const answer = (raw: string): Msg => {
    const t = raw.toLowerCase();
    const { expenses, budgets, departments, reimbursements } = store;
    if (store.mode === "internal" && expenses.length === 0 && budgets.length === 0) return { from: "bot", text: "No authorized company financial records have been supplied yet. No sample transactions are included." };
    const month = DEMO_TODAY.slice(0, 7);
    if (t.includes("spent") && t.includes("month")) {
      const v = expenses.filter((e) => e.approvalStatus === "approved" && e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
      return { from: "bot", text: `Approved spending in November 2026 so far is ${money(v, 2)}. Pending items are not included.` };
    }
    if (t.includes("department") && (t.includes("most") || t.includes("highest"))) {
      const ranked = departments.map((d) => ({ d, v: expenses.filter((e) => e.approvalStatus === "approved" && e.departmentId === d.id).reduce((s, e) => s + e.amount, 0) })).sort((a, b) => b.v - a.v);
      const first = ranked[0]; const second = ranked[1];
      return { from: "bot", text: first ? `${first.d.name} has the highest visible approved spend at ${money(first.v)}${second ? `, followed by ${second.d.name} (${money(second.v)})` : ""}." : "No authorized department spending available." };
    }
    if (t.includes("afford")) {
      const amt = Number(t.match(/\$?\s?(\d[\d,]*)/)?.[1]?.replace(/,/g, "")) || 2000;
      const s = summarize(budgets, expenses, reimbursements);
      const free = s.remaining - s.pendingAmount;
      const fits = budgets.filter((b) => b.amount - budgetSpent(b, expenses) >= amt).map((b) => b.name);
      return { from: "bot", text: `Company-wide, ${money(free)} remains after approved and pending expenses, so ${money(amt)} ${free >= amt ? "fits" : "does not fit"}. Budgets with room: ${fits.join(", ") || "none"}. Try the Time Machine for timing.` };
    }
    if (t.includes("reimburse")) {
      const open = reimbursements.filter((r) => r.status !== "paid");
      const by = (s: string) => open.filter((r) => r.status === s).length;
      return { from: "bot", text: `${open.length} reimbursements are not paid: ${by("awaiting_authorization")} awaiting authorization, ${by("queued")} queued, ${by("processing")} processing, ${by("failed")} failed (demo statuses).` };
    }
    if (t.includes("approval") || t.includes("approve")) {
      const p = expenses.filter((e) => e.approvalStatus === "pending");
      return { from: "bot", text: `${p.length} expenses need approval, totalling ${money(p.reduce((s, e) => s + e.amount, 0), 2)}. Largest: ${[...p].sort((a, b) => b.amount - a.amount).slice(0, 3).map((e) => `${e.vendor} (${money(e.amount)})`).join(", ")}.` };
    }
    return { from: "bot", unsupported: true, text: "I can't answer that yet. This needs the live AI backend, which isn't connected — I won't guess. Try one of the suggested questions." };
  };

  const ask = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: "user", text }, answer(text)]);
    setQ("");
  };

  return (
    <>
      <PageHeader title="AI CFO Assistant" badge={<DemoBadge>{store.mode === "demo" ? "Answers from sample data" : "Authorized data only · rule-based"}</DemoBadge>} />
      <Panel className="flex h-[70vh] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-auto p-5">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.from === "user" && "flex-row-reverse")}>
              <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", m.from === "bot" ? "bg-accent text-primary" : "bg-primary text-primary-foreground")}>{m.from === "bot" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}</div>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm", m.from === "bot" ? (m.unsupported ? "border border-dashed bg-muted" : "bg-muted") : "bg-primary text-primary-foreground")}>{m.text}</div>
            </div>
          ))}
        </div>
        <div className="border-t p-4">
          <div className="mb-3 flex flex-wrap gap-2">{SUGGESTED.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-accent">{s}</button>)}</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about spending, budgets, approvals…" />
            <Button type="submit" size="icon" aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
          <div className="mt-3"><NotConnected>Live AI model not connected. Open-ended questions will show an explanation instead of an invented answer.</NotConnected></div>
        </div>
      </Panel>
    </>
  );
}
