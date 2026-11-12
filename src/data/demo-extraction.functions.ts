import { createServerFn } from '@tanstack/react-start';
import { demoReadingInput } from '@/lib/demo-extraction';

/** Public sample uploads only: no employee lookups, storage, jobs or financial mutations. */
export const readDemoDocument = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => demoReadingInput.parse(data))
  .handler(async ({ data }) => {
    const { extractDocument } = await import('@/lib/document-extraction.server');
    return extractDocument(data);
  });