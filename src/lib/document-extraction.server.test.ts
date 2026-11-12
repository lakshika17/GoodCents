import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ stream: vi.fn(), fallback: vi.fn(), chat: vi.fn() }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: () => ({ chat: mocks.chat }) }));
vi.mock('ai', async importOriginal => ({ ...(await importOriginal<typeof import('ai')>()), streamText: mocks.stream }));
vi.mock('./ai/responses.server', () => ({ createResponsesExtraction: mocks.fallback }));
import { extractDocument } from './document-extraction.server';

const input = { fileName: 'sample.png', mimeType: 'image/png', base64: 'YWJj' };
const data = { documentType: 'Paid Receipt', counterparty: 'Sample Shop', amount: 19.87, currency: 'USD', date: '2026-11-12', documentNumber: 'TEST-101', notes: null };
const success = () => ({ output: Promise.resolve(data), finishReason: Promise.resolve('stop') });

describe('receipt provider routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter');
    vi.stubEnv('LOVABLE_API_KEY', 'test-lovable');
    vi.stubEnv('GEMINI_API_KEY', 'unused-test-key');
    mocks.chat.mockReturnValue('deepseek-primary');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('uses the existing DeepSeek model first and never calls fallback on success', async () => {
    mocks.stream.mockReturnValue(success());
    expect(await extractDocument(input)).toEqual({ ok: true, data });
    expect(mocks.chat).toHaveBeenCalledExactlyOnceWith('deepseek/deepseek-v4.1-flash-1017');
    expect(mocks.fallback).not.toHaveBeenCalled();
  });
  it('uses Lovable once after a transient primary failure', async () => {
    mocks.stream.mockImplementation(() => { throw { statusCode: 503 }; });
    mocks.fallback.mockReturnValue(success());
    expect(await extractDocument(input)).toEqual({ ok: true, data });
    expect(mocks.fallback).toHaveBeenCalledTimes(1);
  });
  it('stops on provider denial rather than switching providers', async () => {
    mocks.stream.mockImplementation(() => { throw { statusCode: 403, responseBody: '{"error":{"message":"Access denied"}}' }; });
    expect(await extractDocument(input)).toEqual({ ok: false, error: 'Access denied' });
    expect(mocks.fallback).not.toHaveBeenCalled();
  });
  it('does not start either provider after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    expect((await extractDocument(input, controller.signal)).ok).toBe(false);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.fallback).not.toHaveBeenCalled();
  });
  it('uses Lovable when only the fallback key is configured', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    mocks.fallback.mockReturnValue(success());
    expect(await extractDocument(input)).toEqual({ ok: true, data });
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it('does not use Gemini even when its key is configured', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('LOVABLE_API_KEY', '');
    expect((await extractDocument(input)).ok).toBe(false);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.fallback).not.toHaveBeenCalled();
  });
});