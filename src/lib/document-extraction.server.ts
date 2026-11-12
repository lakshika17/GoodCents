import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import { z } from "zod";
import { DOCUMENT_TYPES } from "./documents";
import { createResponsesExtraction } from './ai/responses.server';

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

type Provider = { name: 'openrouter' | 'lovable'; baseURL: string; key: string; model: string };

function configuredProviders(): Provider[] {
  const list: Provider[] = [];
  const openrouter = process.env["OPENROUTER_API_KEY"];
  if (openrouter) list.push({ name: "openrouter", baseURL: "https://openrouter.ai/api/v1", key: openrouter, model: "deepseek/deepseek-v4.1-flash-1017" });
  const lovable = process.env['LOVABLE_API_KEY'];
  if (lovable) list.push({ name: 'lovable', baseURL: 'https://ai.gateway.lovable.dev/v1', key: lovable, model: 'openai/gpt-6-astra' });
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
  let lastError: string | undefined;
  const messages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: PROMPT }, file] }];
  for (const p of providers) {
    if (signal?.aborted) return { ok: false, error: 'Automatic reading was stopped.' };
    try {
      const result = p.name === 'lovable'
        ? createResponsesExtraction(p.key, messages, extractionSchema, signal)
        : streamText({
        model: createOpenAI({ baseURL: p.baseURL, apiKey: p.key, name: p.name }).chat(p.model),
        output: Output.object({ schema: extractionSchema }),
        messages,
        maxRetries: 0,
        abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000),
      });
      const data = await result.output;
      const finishReason = await result.finishReason;
      if (finishReason === 'content-filter') return { ok: false, error: 'The AI provider declined to read this document.' };
      return { ok: true, data };
    } catch (error) {
      if (signal?.aborted) return { ok: false, error: 'Automatic reading was stopped.' };
      const failure = error as { statusCode?: number; responseBody?: string; cause?: unknown; finishReason?: string };
      if (failure.finishReason === 'content-filter') return { ok: false, error: 'The AI provider declined to read this document.' };
      const cause = failure.cause as { statusCode?: number; responseBody?: string } | undefined;
      lastStatus = failure.statusCode ?? cause?.statusCode;
      const body = failure.responseBody ?? cause?.responseBody;
      lastError = undefined;
      if (body) {
        try {
          const parsed = JSON.parse(body) as { message?: unknown; error?: { message?: unknown } };
          const message = parsed.error?.message ?? parsed.message;
          if (typeof message === 'string') lastError = message;
        } catch { /* Never expose raw upstream bodies or credentials. */ }
      }
      // Denials/refusals are terminal, never replayed through another provider.
      if (lastStatus === 403) return { ok: false, error: lastError ?? 'The AI provider denied document reading.' };
      if (NoObjectGeneratedError.isInstance(error)) unreadable = true;
      console.error(`document extraction failed (${p.name})`, lastStatus);
    }
  }
  if (lastError) return { ok: false, error: lastError };
  if (unreadable) return { ok: false, error: "The document could not be read reliably. Please enter the details manually." };
  if (lastStatus === 402) return { ok: false, error: "AI credits are exhausted. Enter the details manually." };
  if (lastStatus === 429) return { ok: false, error: "Automatic reading is busy. Try again in a minute or enter details manually." };
  return { ok: false, error: "Automatic reading is unavailable right now. Enter the details manually." };
}
