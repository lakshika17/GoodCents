import { z } from "zod";

/** Browser-safe schema for the Render extraction envelope (all eight top-level fields, decimal strings preserved). */
export const receiptItemSchema = z.object({
  description: z.string().nullable(),
  quantity: z.string().nullable(),
  unit_price: z.string().nullable(),
  amount: z.string().nullable(),
});
export const receiptDataSchema = z.object({
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  receipt_number: z.string().nullable(),
  currency: z.string().nullable(),
  total: z.string().nullable(),
  subtotal: z.string().nullable(),
  tax: z.string().nullable(),
  tip: z.string().nullable(),
  discount: z.string().nullable(),
  items: z.array(receiptItemSchema),
});
export const validationIssueSchema = z.object({
  code: z.string(),
  field: z.string().nullable(),
  message: z.string(),
});
export const extractionEnvelopeSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(["queued", "processing", "completed", "needs_review", "failed", "unknown"]),
  created_at: z.string(),
  updated_at: z.string(),
  data: receiptDataSchema.nullable(),
  validation: z.object({ passed: z.boolean(), issues: z.array(validationIssueSchema) }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  extraction_version: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable(),
});
export type ExtractionEnvelope = z.infer<typeof extractionEnvelopeSchema>;
export const TERMINAL_EXTRACTION_STATES = ["completed", "needs_review", "failed", "unknown"] as const;
