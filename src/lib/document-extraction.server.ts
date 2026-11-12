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

const PROMPT = `Read this financial document for GoodCents and report only what is printed on it.
- documentType: one of ${DOCUMENT_TYPES.join(", ")}. A "Quote"/"Quotation" is a Vendor Quote. Use null if unclear.
- counterparty: the vendor (or customer, for customer documents) company name exactly as printed.
- amount: the document's grand total as a number (no currency symbols). Keep the precision shown.
- currency: ISO code only when printed explicitly and unambiguously, else null. A bare dollar sign does not establish USD.
- date: the document's issue date as YYYY-MM-DD.
- documentNumber: quote/invoice/PO number if shown.
- notes: one short sentence about anything uncertain.
Never guess or invent values; use null for anything not clearly printed.`;

type Provider = { name: string; baseURL: string; key: string; model: string };

function configuredProviders(): Provider[] {
  const list: Provider[] = [];
  const gemini = process.env["GEMINI_API_KEY"];
  if (gemini) list.push({ name: "gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", key: gemini, model: "gemini-3.8-flash" });
  const openrouter = process.env["OPENROUTER_API_KEY"];
  if (openrouter) list.push({ name: "openrouter", baseURL: "https://openrouter.ai/api/v1", key: openrouter, model: "deepseek/deepseek-v4.1-flash-1017" });
  return list;
}

export async function extractDocument(input: { fileName: string; mimeType: string; base64: string }, signal?: AbortSignal): Promise<{ ok: true; data: Extraction } | { ok: false; error: string }> {
  const providers = configuredProviders();
  if (providers.length === 0) return { ok: false, error: "Automatic reading is not configured." };
  const file = input.mimeType === "application/pdf"
    ? { type: "file" as const, filename: input.fileName, data: input.base64, mediaType: "application/pdf" }
    : { type: "image" as const, image: new URL(`data:${input.mimeType};base64,${input.base64}`) };
  let lastStatus: number | undefined;
  let unreadable = false;
  for (const p of providers) {
    const provider = createOpenAI({ baseURL: p.baseURL, apiKey: p.key, name: p.name });
    try {
      const result = streamText({
        model: provider.chat(p.model),
        output: Output.object({ schema: extractionSchema }),
        messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, file] }],
        abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000),
      });
      const data = await result.output;
      return { ok: true, data };
    } catch (error) {
      if (signal?.aborted) break;
      if (NoObjectGeneratedError.isInstance(error)) { unreadable = true; continue; }
      lastStatus = (error as { statusCode?: number }).statusCode;
      console.error(`document extraction failed (${p.name})`, lastStatus, error instanceof Error ? error.message : error);
    }
  }
  if (unreadable) return { ok: false, error: "The document could not be read reliably. Please enter the details manually." };
  if (lastStatus === 402) return { ok: false, error: "AI credits are exhausted. Enter the details manually." };
  if (lastStatus === 429) return { ok: false, error: "Automatic reading is busy. Try again in a minute or enter details manually." };
  return { ok: false, error: "Automatic reading is unavailable right now. Enter the details manually." };
}
