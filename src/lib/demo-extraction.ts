import { z } from 'zod';

export const demoReadingInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  base64: z.string().min(1).max(13_981_016).refine(value => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'Invalid base64 upload.'),
}).superRefine((data, ctx) => {
  const size = data.base64.length * 3 / 4 - (data.base64.endsWith('==') ? 2 : data.base64.endsWith('=') ? 1 : 0);
  if (size > 10 * 1024 * 1024) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Documents must be 10 MB or smaller.' });
});

export function readingAudience(mode: 'demo' | 'internal') {
  return mode === 'demo' ? 'public-demo' : 'verified-employee';
}