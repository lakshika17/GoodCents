import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { DOCUMENT_TYPES } from "./documents";

export const extractionSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES).nullable(),
  counterparty: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  documentNumber: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Extraction = z.infer<typeof extractionSchema>;

const PROMPT = `Read this financial document for Quantera Analytical and report only what is printed on it.
- documentType: one of ${DOCUMENT_TYPES.join(", ")}. A "Quote"/"Quotation" is a Vendor Quote. Use null if unclear.
- counterparty: the vendor (or customer, for customer documents) company name exactly as printed.
- amount: the document's grand total as a number (no currency symbols). Keep the precision shown.
- currency: ISO code only when printed explicitly and unambiguously, else null. A bare dollar sign does not establish USD.
- date: the document's issue date as YYYY-MM-DD.
- documentNumber: quote/invoice/PO number if shown.
- notes: one short sentence about anything uncertain.
Never guess or invent values; use null for anything not clearly printed.`;

export async function extractDocument(input: { fileName: string; mimeType: string; base64: string }, signal?: AbortSignal): Promise<{ ok: true; data: Extraction } | { ok: false; error: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "Automatic reading is not configured." };
  let gatewayRunId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (url, init) => {
      const headers = new Headers(init?.headers);
      if (gatewayRunId) headers.set("X-Lovable-AIG-Run-ID", gatewayRunId);
      const res = await fetch(url, { ...init, headers });
      gatewayRunId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      return res;
    },
  });
  const file = input.mimeType === "application/pdf"
    ? { type: "file" as const, filename: input.fileName, data: input.base64, mediaType: "application/pdf" }
    : { type: "image" as const, image: new URL(`data:${input.mimeType};base64,${input.base64}`) };
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      output: Output.object({ schema: extractionSchema }),
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, file] }],
      abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000),
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
    });
    const data = await result.output;
    return { ok: true, data };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) return { ok: false, error: "The document could not be read reliably. Please enter the details manually." };
    const status = (error as { statusCode?: number }).statusCode;
    console.error("document extraction failed", status, error instanceof Error ? error.message : error);
    if (status === 402) return { ok: false, error: "AI credits are exhausted. Enter the details manually." };
    if (status === 429) return { ok: false, error: "Automatic reading is busy. Try again in a minute or enter details manually." };
    return { ok: false, error: "Automatic reading is unavailable right now. Enter the details manually." };
  }
}
