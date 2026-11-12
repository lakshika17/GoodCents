import { extractionEnvelopeSchema, type ExtractionEnvelope } from "./extraction-types";
import type { Json } from '@/integrations/supabase/types';

/** Server-only client for the Render extraction service. The API key never leaves this module. */
export type RenderResult =
  | { ok: true; http: number; envelope: ExtractionEnvelope; original: Json }
  | { ok: false; kind: "rejected"; http: number; code: string; message: string }
  | { ok: false; kind: "uncertain"; message: string }
  | { ok: false; kind: "not_found" };

function config() {
  const baseUrl = process.env["EXTRACTION_API_BASE_URL"];
  const apiKey = process.env["EXTRACTION_API_KEY"];
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function parseEnvelope(res: Response, requestId: string): Promise<RenderResult> {
  const body = await res.json().catch(() => null);
  const parsed = extractionEnvelopeSchema.safeParse(body);
  if (!parsed.success || parsed.data.request_id !== requestId) return { ok: false, kind: "uncertain", message: "Unexpected response from the reading service; the request is preserved." };
  return { ok: true, http: res.status, envelope: parsed.data, original: body as Json };
}

async function parseError(res: Response): Promise<RenderResult> {
  const body = (await res.json().catch(() => null)) as { detail?: { code?: string; message?: string } } | null;
  const code = typeof body?.detail?.code === "string" ? body.detail.code : `http_${res.status}`;
  const message = typeof body?.detail?.message === "string" ? body.detail.message : "The reading service rejected the request.";
  return { ok: false, kind: "rejected", http: res.status, code, message };
}

/** POSTs the original stored PDF bytes exactly once per persisted request id. Uncertain outcomes never auto-retry. */
export async function postExtraction(requestId: string, pdf: Uint8Array, fileName: string): Promise<RenderResult> {
  const cfg = config();
  if (!cfg) return { ok: false, kind: "uncertain", message: "Automatic reading is not configured." };
  const form = new FormData();
  form.append("file", new File([pdf as unknown as BlobPart], fileName, { type: "application/pdf" }));
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/extractions`, {
      method: "POST",
      headers: { "X-API-Key": cfg.apiKey, "Idempotency-Key": requestId },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 200 || res.status === 202) return parseEnvelope(res, requestId);
    if (res.status === 429 || res.status >= 500) return { ok: false, kind: "uncertain", message: "The reading service is temporarily unavailable; the request is preserved and will be checked, not repeated." };
    return parseError(res);
  } catch {
    return { ok: false, kind: "uncertain", message: "The reading request outcome is uncertain; it will be checked, not repeated." };
  }
}

/** GETs the persisted request's status. A 404 never proves a prior uncertain POST failed; callers must not create a replacement. */
export async function getExtraction(requestId: string): Promise<RenderResult> {
  const cfg = config();
  if (!cfg) return { ok: false, kind: "uncertain", message: "Automatic reading is not configured." };
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/extractions/${requestId}`, {
      headers: { "X-API-Key": cfg.apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 200) return parseEnvelope(res, requestId);
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 429 || res.status >= 500) return { ok: false, kind: "uncertain", message: "The reading service is temporarily unavailable; the request is preserved." };
    return parseError(res);
  } catch {
    return { ok: false, kind: "uncertain", message: "The reading status could not be checked right now; the request is preserved." };
  }
}
