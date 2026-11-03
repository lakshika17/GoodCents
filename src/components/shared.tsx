import type { ReactNode } from "react";
import { FlaskConical, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalStatus, ReimbursementStatus } from "@/data/types";
import { useStore } from "@/data/store";

export function PageHeader({ title, description, actions, badge }: { title: string; description?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string | undefined; tone?: "primary" }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", tone === "primary" && "border-primary/20 bg-accent")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold text-foreground sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const tones = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-accent text-accent-foreground",
};
export function Pill({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

const approvalMap: Record<ApprovalStatus, [keyof typeof tones, string]> = {
  pending: ["warning", "Pending"], approved: ["success", "Approved"], rejected: ["danger", "Rejected"], changes_requested: ["info", "Changes requested"],
};
export const ApprovalBadge = ({ s }: { s: ApprovalStatus }) => <Pill tone={approvalMap[s][0]}>{approvalMap[s][1]}</Pill>;

export const reimbursementLabels: Record<ReimbursementStatus, string> = {
  awaiting_authorization: "Awaiting authorization", queued: "Queued", processing: "Processing", paid: "Paid", failed: "Failed",
};
const rbTone: Record<ReimbursementStatus, keyof typeof tones> = { awaiting_authorization: "warning", queued: "info", processing: "primary", paid: "success", failed: "danger" };
export const ReimbursementBadge = ({ s }: { s: ReimbursementStatus }) => <Pill tone={rbTone[s]}>{reimbursementLabels[s]}</Pill>;

export function DemoBadge({ children }: { children?: ReactNode }) {
  const { mode } = useStore();
  return <Pill tone="primary"><FlaskConical className="h-3 w-3" />{children ?? (mode === "demo" ? "Demo data" : "Authorized records")}</Pill>;
}
export function NotConnected({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/60 p-3 text-xs text-muted-foreground">
      <PlugZap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

export const nativeSelect = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
