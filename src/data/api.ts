/**
 * Integration contract for the backend teammate. Nothing here is called live yet;
 * the demo uses in-memory state in ./store.tsx. Each function maps to a planned endpoint/table.
 * Never put API secrets (OpenAI, PayPal) in frontend code — call server functions instead.
 */
import type { Expense, Reimbursement, VendorQuote } from "./types";

export const integrations = [
  { key: "database", name: "Database persistence", status: "not_connected", note: "Tables: departments, employees, projects, project_departments, budgets, expenses, approvals, receipts, purchase_requests, vendor_quotes, financial_scenarios, reimbursements, notifications" },
  { key: "receipt_ai", name: "AI receipt extraction", status: "not_connected", note: "Extraction preview is simulated" },
  { key: "duplicate", name: "Server-side duplicate detection", status: "not_connected", note: "Demo uses a local vendor+amount match" },
  { key: "assistant", name: "AI CFO assistant (LLM)", status: "not_connected", note: "Demo answers only fixed questions from sample data" },
  { key: "paypal", name: "PayPal Payouts (sandbox)", status: "not_connected", note: "Statuses are demo-only; no payment is made" },
  { key: "messaging", name: "WhatsApp / Google Chat / SMS intake", status: "not_connected", note: "Planned receipt channels" },
  { key: "auth", name: "Authentication & roles", status: "not_connected", note: "Demo role switcher in top bar" },
] as const;

export class NotConnectedError extends Error {
  constructor(feature: string) { super(`${feature} is not connected yet`); }
}

export async function extractReceipt(_file: File): Promise<Partial<Expense>> { throw new NotConnectedError("Receipt AI"); }
export async function fetchVendorQuotes(_prompt: string): Promise<VendorQuote[]> { throw new NotConnectedError("Vendor quotes"); }
export async function executePayout(_r: Reimbursement): Promise<{ reference: string }> { throw new NotConnectedError("PayPal Payouts"); }
export async function askAssistant(_q: string): Promise<string> { throw new NotConnectedError("AI assistant"); }
