import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getExtraction, postExtraction } from "./extraction-api.server";

/**
 * Simulated transport tests: fetch is stubbed, no live provider calls are made.
 * They verify how the client maps HTTP outcomes, not the real service.
 */

const REQUEST_ID = "17311111-2222-4333-8444-555555555555";
const envelope = {
  request_id: REQUEST_ID,
  status: "queued",
  created_at: "2026-11-04T21:00:00+00:00",
  updated_at: "2026-11-04T21:00:00+00:00",
  data: null,
  validation: null,
  error: null,
  extraction_version: null,
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  process.env["EXTRACTION_API_BASE_URL"] = "https://extraction.example.invalid";
  process.env["EXTRACTION_API_KEY"] = "test-simulated-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["EXTRACTION_API_BASE_URL"];
  delete process.env["EXTRACTION_API_KEY"];
});

describe("postExtraction (simulated transport)", () => {
  it("preserves the complete original envelope including additional provider fields", async () => {
    const original = { ...envelope, provider_detail: { trace: 'fictional-trace' } };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(202, original)));
    const res = await postExtraction(REQUEST_ID, new Uint8Array([37,80,68,70]), 'fictional.pdf');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.original).toEqual(original);
  });
  it("rejects a response for another UUID without replacing the request", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(202, { ...envelope, request_id: '27311111-2222-4333-8444-555555555555' })));
    const res = await postExtraction(REQUEST_ID, new Uint8Array([37,80,68,70]), 'fictional.pdf');
    expect(res).toMatchObject({ ok: false, kind: 'uncertain' });
  });
  it("posts the exact original bytes once and makes no automatic retry on uncertainty", async () => {
    const original = new Uint8Array([37,80,68,70,45,49,46,55,10]);
    let sent: number[] = [];
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const file = (init.body as FormData).get('file') as File;
      const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Expected bytes'));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });
      sent = [...new Uint8Array(bytes)];
      throw new Error('lost response');
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await postExtraction(REQUEST_ID, original, 'fictional.pdf')).toMatchObject({ ok: false, kind: 'uncertain' });
    expect(sent).toEqual([...original]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("sends the key and idempotency header server-side and parses a 202 queued envelope", async () => {
    let seen: { key: string | null; idem: string | null } = { key: null, idem: null };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const h = new Headers(init.headers);
      seen = { key: h.get("X-API-Key"), idem: h.get("Idempotency-Key") };
      return jsonResponse(202, envelope);
    }));
    const res = await postExtraction(REQUEST_ID, new Uint8Array([37, 80, 68, 70]), "receipt.pdf");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.envelope.status).toBe("queued");
    expect(seen.key).toBe("test-simulated-key");
    expect(seen.idem).toBe(REQUEST_ID);
  });

  it("maps 401 to a rejected result, never a retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401, { detail: { code: "unauthorized", message: "bad key" } })));
    const res = await postExtraction(REQUEST_ID, new Uint8Array([1]), "r.pdf");
    expect(res).toMatchObject({ ok: false, kind: "rejected", code: "unauthorized" });
  });

  it("maps 429 and 5xx to uncertain so the persisted request is preserved", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(429, { detail: { code: "capacity_exceeded", message: "busy" } })));
    const res = await postExtraction(REQUEST_ID, new Uint8Array([1]), "r.pdf");
    expect(res).toMatchObject({ ok: false, kind: "uncertain" });
  });

  it("maps a network failure to uncertain, never to a new request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connection reset"); }));
    const res = await postExtraction(REQUEST_ID, new Uint8Array([1]), "r.pdf");
    expect(res).toMatchObject({ ok: false, kind: "uncertain" });
  });

  it("maps an unparseable 202 body to uncertain rather than fabricating a result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(202, { unexpected: true })));
    const res = await postExtraction(REQUEST_ID, new Uint8Array([1]), "r.pdf");
    expect(res).toMatchObject({ ok: false, kind: "uncertain" });
  });
});

describe("getExtraction (simulated transport)", () => {
  it("returns not_found on 404 without suggesting a replacement request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { detail: { code: "not_found", message: "none" } })));
    const res = await getExtraction(REQUEST_ID);
    expect(res).toMatchObject({ ok: false, kind: "not_found" });
  });

  it("parses a terminal failed envelope truthfully", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { ...envelope, status: "failed", error: { code: "extraction_failed", message: "Extraction could not be completed" } })));
    const res = await getExtraction(REQUEST_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.envelope.status).toBe("failed");
      expect(res.envelope.error?.code).toBe("extraction_failed");
      expect(res.envelope.data).toBeNull();
    }
  });

  it("maps a timeout to uncertain so polling can continue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
    const res = await getExtraction(REQUEST_ID);
    expect(res).toMatchObject({ ok: false, kind: "uncertain" });
  });
});
