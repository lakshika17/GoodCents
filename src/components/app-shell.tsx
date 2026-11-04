import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Bot, Building2, CalendarClock, CheckSquare, HandCoins, LayoutDashboard, Menu, PiggyBank, Plus,
  Receipt, Settings, ShieldCheck, ShoppingCart, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useOptionalStore, useStore } from "@/data/store";
import type { Role } from "@/data/types";
import { cn } from "@/lib/utils";
import { SubmitExpenseDialog } from "./submit-expense-dialog";
import { DEMO_PREVIEWS, isDemoPreview } from '@/data/demo-preview';
import { nativeSelect } from './shared';

type NavItem = { to: string; label: string; icon: typeof Bell; roles?: Role[]; optional?: boolean };
const nav: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/budgets", label: "Budgets", icon: PiggyBank, roles: ["manager", "admin"] },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/negotiator", label: "Purchase Negotiator", icon: ShoppingCart, optional: true },
  { to: "/time-machine", label: "Time Machine", icon: CalendarClock, optional: true },
  { to: "/assistant", label: "AI CFO Assistant", icon: Bot },
  { to: "/reimbursements", label: "Reimbursements", icon: HandCoins },
  { to: "/vault", label: "Secure Spend Vault", icon: ShieldCheck },
  { to: "/people", label: "Employees & Depts", icon: Building2 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="grid gap-0.5">
      {nav.filter((n) => !n.roles || n.roles.includes(role)).map((n) => {
        const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
        return (
          <Link key={n.to} to={n.to} onClick={onNavigate}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-muted")}>
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {n.optional && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">optional</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  const { mode } = useStore();
  return (
    <div className="flex items-center gap-2 px-3">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold">AI CFO</p>
        <p className="text-[11px] text-muted-foreground">{mode === "demo" ? "Quantera · Sample data" : "Quantera · Internal"}</p>
      </div>
    </div>
  );
}

function RoleSwitcher() {
  const { role, preview, setPreview, currentUser, mode, authenticatedDevelopment } = useStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  if (mode === "internal") return <div className="flex items-center gap-2"><div className="text-right text-xs"><p className="font-medium">{currentUser.name}</p><p className="text-muted-foreground">{role === "admin" ? "Founder" : role === "manager" ? "Manager" : "Employee"}</p></div><Button variant="outline" size="sm" onClick={() => void navigate({ to: '/demo' })}>Demo preview</Button><Button variant="outline" size="sm" onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: "/auth", replace: true }); }}>Sign out</Button></div>;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right text-xs leading-tight md:block">
        <p className="font-medium text-foreground">{currentUser.name}</p>
        <p className="text-muted-foreground">Sample data preview</p>
      </div>
      <select aria-label="Sample data preview" className={cn(nativeSelect, 'max-w-44')} value={preview} onChange={event => { if (isDemoPreview(event.target.value)) setPreview(event.target.value); }}>
        {Object.entries(DEMO_PREVIEWS).map(([key, item]) => <option key={key} value={key}>{item.label} · Demo</option>)}
      </select>
      {authenticatedDevelopment && <Button variant="outline" size="sm" onClick={async () => { await qc.cancelQueries(); qc.clear(); sessionStorage.removeItem('ai-cfo-demo'); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }); }}>Sign out</Button>}
    </div>
  );
}

function Notifications() {
  const { visibleNotifications: list, markAllRead } = useStore();
  const unread = list.filter((n) => !n.read).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
        </div>
        <div className="max-h-80 overflow-auto">
          {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">No notifications</p>}
          {list.map((n) => (
            <div key={n.id} className={cn("border-b px-3 py-2.5 text-sm last:border-0", !n.read && "bg-accent/50")}>
              <p className="text-foreground">{n.message}</p>
              <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{n.type.replace(/_/g, " ")} · {n.date}</p>
            </div>
          ))}
        </div>
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">In-app demo notifications only</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Renders the financial shell only when a store exists; public screens (demo, sign-in) never crash here. */
export function AppShell({ children }: { children: ReactNode }) {
  return useOptionalStore() ? <FinancialShell>{children}</FinancialShell> : <>{children}</>;
}
function FinancialShell({ children }: { children: ReactNode }) {
  const { mode } = useStore();
  const [open, setOpen] = useState(false);
  const [submit, setSubmit] = useState(false);
  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-sidebar py-5 lg:flex">
        <Brand />
        <div className="flex-1 overflow-auto px-3"><NavLinks /></div>
        <p className="px-6 text-[11px] text-muted-foreground">{mode === "demo" ? "Sample finances · Quantera team · No real payments" : "Private employee access · PayPal disabled"}</p>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 py-5">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <div className="mt-6 px-3"><NavLinks onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          <div className="flex-1" />
          <RoleSwitcher />
          <Notifications />
          <Button size="sm" onClick={() => setSubmit(true)} className="hidden sm:inline-flex"><Plus className="h-4 w-4" />Submit Expense</Button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:py-8">{children}</main>
      </div>
      <Button onClick={() => setSubmit(true)} className="fixed bottom-5 right-5 z-30 h-12 rounded-full px-5 shadow-lg sm:hidden"><Plus className="h-4 w-4" />Expense</Button>
      <SubmitExpenseDialog open={submit} onOpenChange={setSubmit} />
    </div>
  );
}
