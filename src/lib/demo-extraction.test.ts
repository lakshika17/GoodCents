import { describe, expect, it } from 'vitest';
import { demoReadingInput, readingAudience } from './demo-extraction';

describe('public demo reading boundary', () => {
  it('routes fictional demo reading separately from verified employee reading', () => {
    expect(readingAudience('demo')).toBe('public-demo');
    expect(readingAudience('internal')).toBe('verified-employee');
  });
  it('accepts PDF, JPEG and PNG uploads only', () => {
    for (const mimeType of ['application/pdf', 'image/jpeg', 'image/png']) {
      expect(demoReadingInput.safeParse({ fileName: 'sample', mimeType, base64: 'YWJj' }).success).toBe(true);
    }
    expect(demoReadingInput.safeParse({ fileName: 'sample', mimeType: 'text/html', base64: 'YWJj' }).success).toBe(false);
  });
  it('rejects empty, malformed and oversized uploads', () => {
    const upload = { fileName: 'sample.png', mimeType: 'image/png' };
    for (const base64 of ['', 'not base64', 'A'.repeat(13_981_016)]) {
      expect(demoReadingInput.safeParse({ ...upload, base64 }).success).toBe(false);
    }
  });
});