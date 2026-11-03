import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ShoppingCart, Sparkles, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import type { VendorQuote } from "@/data/types";
import { budgetForExpense, budgetPending, budgetSpent, money } from "@/lib/calc";
import { DemoBadge, NotConnected, PageHeader, Panel, Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/negotiator")({
  head: pageHead("Purchase Negotiator", "Optional assistant that compares example vendor quotes against your budget."),
  component: Negotiator,
});

// Fictional example quotes. Not live offers.
function exampleQuotes(prompt: string): VendorQuote[] {
  const p = prompt.toLowerCase();
  const kind = p.includes("lab") ? "Laboratory supply kit" : p.includes("laptop") || p.includes("computer") ? "Laptop" : p.includes("software") ? "Software seats (annual)" : "Requested item";
  const base = Number(prompt.match(/\$?\s?(\d[\d,]*)/)?.[1]?.replace(/,/g, "")) || 1000;
  return [
    { id: "q1", vendor: "NorthLab Supply Co.", product: `${kind} — Standard`, price: Math.round(base * 0.82), deliveryDays: 5, rating: 4.6, notes: "Bulk discount example", isExample: true },
    { id: "q2", vendor: "BioCrate", product: `${kind} — Premium`, price: Math.round(base * 1.07), deliveryDays: 2, rating: 4.8, notes: "Fastest delivery", isExample: true },
    { id: "q3", vendor: "PipetteHub", product: `${kind} — Value`, price: Math.round(base * 0.71), deliveryDays: 9, rating: 4.1, notes: "Lowest price", isExample: true },
  ];
}

function Negotiator() {
  const { currentUser, budgets, expenses } = useStore();
  const [prompt, setPrompt] = useState("I need laboratory supplies under $900.");
  const [quotes, setQuotes] = useState<VendorQuote[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const cap = Number(prompt.match(/\$?\s?(\d[\d,]*)/)?.[1]?.replace(/,/g, "")) || null;
  const budget = budgetForExpense({ departmentId: currentUser.departmentId, projectId: null }, budgets);
  const available = budget ? budget.amount - budgetSpent(budget, expenses) - budgetPending(budget, expenses) : 0;
  const ranked = quotes ? [...quotes].sort((a, b) => a.price / a.rating - b.price / b.rating) : [];
  const best = ranked.find((q) => !cap || q.price <= cap);
  const maxPrice = quotes ? Math.max(...quotes.map((q) => q.price)) : 0;

  return (
    <>
      <PageHeader title="AI Purchase Negotiator" badge={<Pill tone="neutral">Optional</Pill>} description="Use this only if it helps. You can always buy as usual and submit the receipt." />
      <Panel>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); setQuotes(exampleQuotes(prompt)); setPicked(null); }}>
          <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe what you need and your limit" />
          <Button type="submit"><Sparkles className="h-4 w-4" />Compare options</Button>
        </form>
        <div className="mt-3"><NotConnected>Vendor data and AI negotiation are not connected. Results below are fictional example quotes, not verified live offers.</NotConnected></div>
      </Panel>
      {quotes && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><DemoBadge>Example quotes — not live</DemoBadge> Budget available for {budget?.name}: <span className="font-semibold text-foreground">{money(available)}</span></div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {quotes.map((q) => {
              const fits = q.price <= available && (!cap || q.price <= cap);
              return (
                <Panel key={q.id} className={cn("relative", best?.id === q.id && "border-primary/40 ring-1 ring-primary/30", picked === q.id && "bg-accent")}>
                  {best?.id === q.id && <Pill tone="primary" className="absolute right-4 top-4">Recommended</Pill>}
                  <p className="text-xs text-muted-foreground">{q.vendor}</p>
                  <h3 className="mt-1 pr-24 font-semibold">{q.product}</h3>
                  <p className="mt-3 font-display text-2xl font-semibold">{money(q.price)}</p>
                  <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><Truck className="h-4 w-4" />{q.deliveryDays} days (estimate)</span>
                    <span className="flex items-center gap-2"><Star className="h-4 w-4" />{q.rating} rating</span>
                    <span>{q.notes}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone={fits ? "success" : "danger"}>{fits ? "Fits budget" : "Over limit"}</Pill>
                    {maxPrice - q.price > 0 && <Pill tone="info">Saves {money(maxPrice - q.price)}</Pill>}
                  </div>
                  <Button variant={picked === q.id ? "default" : "outline"} className="mt-4 w-full" onClick={() => { setPicked(q.id); toast.success("Preferred option saved (demo). Buy as usual, then submit the receipt."); }}>
                    {picked === q.id ? <><Check className="h-4 w-4" />Selected</> : <><ShoppingCart className="h-4 w-4" />Select</>}
                  </Button>
                </Panel>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
