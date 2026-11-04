// Pure rules for uploaded financial documents. Only spending evidence may enter the expense approval queue.
export const DOCUMENT_TYPES = [
  "Paid Receipt",
  "Supplier Invoice",
  "Vendor Quote",
  "Purchase Order",
  "Customer Invoice",
  "Customer Purchase Order",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const EXPENSE_ELIGIBLE: readonly DocumentType[] = ["Paid Receipt", "Supplier Invoice"];

/** Whether a document of this type can become an expense awaiting approval. */
export const isExpenseEligible = (t: DocumentType | "" | undefined) => !!t && EXPENSE_ELIGIBLE.includes(t);
export const isDocumentType = (v: unknown): v is DocumentType => DOCUMENT_TYPES.includes(v as DocumentType);

export type DocumentStatus = "draft" | "saved" | "void";

/** Whether the document may be submitted for expense approval right now. */
/** Budgets are in USD, so only USD documents can enter approval until currency conversion exists. */
export function canSubmitForApproval(d: { documentType: DocumentType | ""; vendor: string; amount: number | null; date: string; verified: boolean; currency?: string | undefined; paymentResponsibility?: string | undefined; paymentEvidenceConfirmed?: boolean | undefined }) {
  const date = new Date(`${d.date}T00:00:00Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === d.date;
  return d.currency === "USD" && d.paymentResponsibility === 'employee_paid' && d.paymentEvidenceConfirmed === true && isExpenseEligible(d.documentType) && d.verified && !!d.vendor.trim() && d.amount !== null && Number.isFinite(d.amount) && d.amount > 0 && Math.abs(d.amount * 100 - Math.round(d.amount * 100)) < 0.00001 && validDate;
}
