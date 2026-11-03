import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/data/store";
import { balanceAt, budgetPending, budgetSpent, money, projectScenario } from "@/lib/calc";
import { DemoBadge, Field, PageHeader, Panel, Pill, nativeSelect } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/time-machine")({
  head: pageHead("Financial Time Machine", "Simulate buying now, next month or in installments over 30, 60 and 90 days."),
  component: TimeMachine,
});

function TimeMachine() {
  const { budgets, expenses, role, currentUser } = useStore();
  const opts = role === "admin" ? budgets : budgets.filter((b) => b.departmentId === currentUser.departmentId);
  const [budgetId, setBudgetId] = useState(opts[0]?.id ?? "");
  const [amount, setAmount] = useState(2000);
  const [parts, setParts] = useState(3);
  const b = budgets.find((x) => x.id === budgetId) ?? opts[0];

  const { balance, dailyBurn, data, rows } = useMemo(() => {
    const balance = b ? b.amount - budgetSpent(b, expenses) - budgetPending(b, expenses) : 0;
    // Assumption: burn rate = average approved spend per day over the last 90 demo days (Aug–Oct).
    const recent = b ? expenses.filter((e) => e.approvalStatus === "approved" && e.departmentId === b.departmentId && e.projectId === b.projectId && e.date >= "2026-08-01" && e.date < "2026-11-01") : [];
    const dailyBurn = recent.reduce((s, e) => s + e.amount, 0) / 92;
    const now = projectScenario({ balance, dailyBurn, amount, strategy: "now", splitParts: 1 });
    const later = projectScenario({ balance, dailyBurn, amount, strategy: "next_month", splitParts: 1 });
    const split = projectScenario({ balance, dailyBurn, amount, strategy: "split", splitParts: parts });
    const base = projectScenario({ balance, dailyBurn, amount: 0, strategy: "now", splitParts: 1 });
    const data = now.map((p, i) => ({ day: p.day, "Buy now": p.balance, "Next month": later[i]!.balance, [`Split ×${parts}`]: split[i]!.balance, "No purchase": base[i]!.balance }));
    const rows = [["Buy now", now], ["Next month", later], [`Split ×${parts}`, split]] as const;
    return { balance, dailyBurn, data, rows };
  }, [b, expenses, amount, parts]);

  return (
    <>
      <PageHeader title="Financial Time Machine" badge={<><Pill tone="neutral">Optional</Pill><DemoBadge>Estimates only</DemoBadge></>} description="Simulations never change your real budget." />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel title="Scenario">
          <div className="grid gap-3">
            <Field label="Budget"><select className={nativeSelect} value={b?.id} onChange={(e) => setBudgetId(e.target.value)}>{opts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="Purchase amount (USD)"><Input type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} /></Field>
            <Field label="Split into monthly payments"><Input type="number" min={1} max={3} value={parts} onChange={(e) => setParts(Math.min(3, Math.max(1, Number(e.target.value))))} /></Field>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Assumptions</p>
              <ul className="list-disc pl-4">
                <li>Starting balance {money(balance)} (budget − approved − pending)</li>
                <li>Daily spend {money(dailyBurn, 2)} based on Aug–Oct approved expenses</li>
                <li>No new budget allocations during the window</li>
                <li>Uses fictional sample data</li>
              </ul>
            </div>
          </div>
        </Panel>
        <Panel title="Projected balance (90 days)">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => `D${d}`} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => money(v)} labelFormatter={(d) => `Day ${d}`} />
                <Legend />
                <ReferenceLine y={0} stroke="var(--destructive)" strokeDasharray="4 4" />
                <Line dataKey="No purchase" stroke="var(--chart-3)" strokeDasharray="4 4" dot={false} />
                <Line dataKey="Buy now" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line dataKey="Next month" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                <Line dataKey={`Split ×${parts}`} stroke="var(--chart-5)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Strategy</th><th className="font-medium">Day 30</th><th className="font-medium">Day 60</th><th className="font-medium">Day 90</th><th className="font-medium">Outcome</th></tr></thead>
              <tbody>
                {rows.map(([name, pts]) => {
                  const low = Math.min(...pts.map((p) => p.balance));
                  return (
                    <tr key={name} className="border-b last:border-0">
                      <td className="py-2 font-medium">{name}</td>
                      {[30, 60, 90].map((d) => <td key={d} className={`tabular-nums ${balanceAt(pts, d) < 0 ? "text-destructive" : ""}`}>{money(balanceAt(pts, d))}</td>)}
                      <td>{low < 0 ? <Pill tone="danger">Goes negative</Pill> : <Pill tone="success">Stays positive</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
