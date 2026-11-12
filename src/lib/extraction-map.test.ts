import { describe, expect, it } from "vitest";
import { extractionEnvelopeSchema } from "./extraction-types";
import { extractionIssues, mapExtractionToFields } from "./extraction-map";

const base = {
  request_id: "17311111-2222-4333-8444-555555555555",
  created_at: "2026-11-04T21:00:00+00:00",
  updated_at: "2026-11-04T21:00:05+00:00",
  extraction_version: { pipeline_version: "receipt-extraction-v1" },
  error: null,
};

describe("mapExtractionToFields", () => {
  it("maps the five form fields and preserves the decimal string exactly", () => {
    const envelope = extractionEnvelopeSchema.parse({
      ...base,
      status: "completed",
      data: {
        merchant: "Fictional Stationery", date: "2026-10-01", receipt_number: "F-123", currency: "CAD",
        total: "12.30", subtotal: "12.30", tax: null, tip: null, discount: "0.00",
        items: [{ description: "Fictional pen", quantity: "1.000", unit_price: "2.30", amount: "2.30" }],
      },
      validation: { passed: true, issues: [] },
    });
    const fields = mapExtractionToFields(envelope);
    expect(fields).toEqual({ vendor: "Fictional Stationery", date: "2026-10-01", documentNumber: "F-123", currency: "CAD", amount: "12.30" });
    expect(fields.amount).toBe("12.30"); // string, not 12.3
  });

  it("keeps unknown values blank and never defaults a currency", () => {
    const envelope = extractionEnvelopeSchema.parse({
      ...base,
      status: "needs_review",
      data: { merchant: "Fictional Stationery", date: null, receipt_number: null, currency: null, total: null, subtotal: null, tax: null, tip: null, discount: null, items: [] },
      validation: { passed: false, issues: [{ code: "missing_currency", field: "currency", message: "Required field currency is missing" }] },
    });
    const fields = mapExtractionToFields(envelope);
    expect(fields).toEqual({ vendor: "Fictional Stationery", date: "", documentNumber: "", currency: "", amount: "" });
    expect(extractionIssues(envelope)).toEqual(["Required field currency is missing"]);
  });

  it("rejects an invalid calendar date instead of passing it through", () => {
    const envelope = extractionEnvelopeSchema.parse({
      ...base,
      status: "completed",
      data: { merchant: "X", date: "2026-13-40", receipt_number: null, currency: "USD", total: "1.00", subtotal: null, tax: null, tip: null, discount: null, items: [] },
      validation: { passed: true, issues: [] },
    });
    expect(mapExtractionToFields(envelope).date).toBe("");
  });

  it("maps null data (failed/unknown) to all-blank fields", () => {
    const envelope = extractionEnvelopeSchema.parse({ ...base, status: "failed", data: null, validation: null, error: { code: "extraction_failed", message: "Extraction could not be completed" } });
    expect(mapExtractionToFields(envelope)).toEqual({ vendor: "", date: "", documentNumber: "", currency: "", amount: "" });
  });
});
