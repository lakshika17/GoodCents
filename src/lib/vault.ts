// Pure Secure Spend Vault rules. An allowance is an authorization limit, never a wallet balance.
export interface VaultSettings { allowance: number; dailyLimit: number; perTransactionLimit: number; frozen: boolean }
export interface VaultPayment {
  id: string; kind: "reimbursement" | "vendor"; refId: string; payeeId: string; payeeName: string; amount: number;
  date: string; status: "completed" | "rejected"; sandboxReference: string | null; authorizedBy: string; note: string;
}
export type VendorRequestStatus = "pending_manager" | "manager_approved" | "rejected" | "paid";
export interface VendorRequest { id: string; requesterId: string; vendor: string; amount: number; reason: string; date: string; status: VendorRequestStatus; managerId: string | null }

export const completedTotal = (p: VaultPayment[]) => p.filter((x) => x.status === "completed").reduce((s, x) => s + x.amount, 0);
export const completedOn = (p: VaultPayment[], date: string) => p.filter((x) => x.status === "completed" && x.date === date).reduce((s, x) => s + x.amount, 0);

/** Allowance not yet used by completed payments or reserved for approved-but-unpaid items. */
export function vaultSummary(s: VaultSettings, payments: VaultPayment[], reserved: number) {
  const paid = completedTotal(payments);
  return { paid, reserved, available: Math.max(0, s.allowance - paid - reserved) };
}

/** Every reason a payment release must be blocked. Empty means it may be released by an authorized person. */
export function releaseBlockers(o: { settings: VaultSettings; payments: VaultPayment[]; amount: number; refId: string; today: string; payeeId: string; authorizerId: string; canAuthorize: boolean; approverId?: string | null }): string[] {
  const r: string[] = [];
  if (!o.canAuthorize) r.push("Only the founder or an authorized finance administrator can release payments.");
  if (o.payeeId === o.authorizerId) r.push("You cannot authorize a payment to yourself.");
  if (o.approverId && o.approverId === o.authorizerId) r.push("The manager who approved this cannot also authorize its payment.");
  if (o.settings.frozen) r.push("New payments are frozen.");
  if (!(o.amount > 0)) r.push("Amount must be positive.");
  if (o.amount > o.settings.perTransactionLimit) r.push("Exceeds the per-transaction limit.");
  if (completedOn(o.payments, o.today) + o.amount > o.settings.dailyLimit) r.push("Exceeds today's spending limit.");
  if (completedTotal(o.payments) + o.amount > o.settings.allowance) r.push("Exceeds the remaining spending allowance.");
  if (o.payments.some((p) => p.refId === o.refId && p.status === "completed")) r.push("Already paid — duplicate payment blocked.");
  return r;
}

/** Unusual-activity alerts shown to the founder and finance. */
export function securityAlerts(s: VaultSettings, payments: VaultPayment[]): string[] {
  const a: string[] = [];
  const done = payments.filter((p) => p.status === "completed");
  for (const p of done) if (p.amount >= s.perTransactionLimit * 0.8) a.push(`Large payment: ${p.payeeName} ${p.amount.toFixed(2)} on ${p.date}`);
  const byDay = new Map<string, number>();
  for (const p of done) byDay.set(`${p.payeeId}|${p.date}`, (byDay.get(`${p.payeeId}|${p.date}`) ?? 0) + 1);
  for (const [k, n] of byDay) if (n >= 3) { const [id, d] = k.split("|"); a.push(`${n} payments to the same payee (${done.find((p) => p.payeeId === id)?.payeeName}) on ${d}`); }
  if (s.frozen) a.push("Payments are currently frozen.");
  return a;
}
