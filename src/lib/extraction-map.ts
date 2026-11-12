import type { ExtractionEnvelope } from "./extraction-types";
import { calendarDate } from "./expense-contract";

export interface ExtractedFields {
  vendor: string;
  date: string;
  documentNumber: string;
  currency: string;
  amount: string;
}

/**
 * Maps a terminal extraction envelope to initial form fields.
 * Unknown values stay blank — never invented zeros or default currencies.
 * Monetary values keep their exact decimal-string form; no floating-point conversion.
 */
export function mapExtractionToFields(envelope: ExtractionEnvelope): ExtractedFields {
  const d = envelope.data;
  return {
    vendor: d?.merchant ?? "",
    date: d?.date && calendarDate(d.date) ? d.date : "",
    documentNumber: d?.receipt_number ?? "",
    currency: d?.currency ?? "",
    amount: d?.total ?? "",
  };
}

/** Human-readable validation issues for needs_review display. */
export function extractionIssues(envelope: ExtractionEnvelope): string[] {
  return envelope.validation?.issues?.map((i) => i.message) ?? [];
}
