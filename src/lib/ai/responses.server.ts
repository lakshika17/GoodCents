import { createOpenAI } from '@ai-sdk/openai';
import { Output, streamText, type ModelMessage } from 'ai';
import type { z } from 'zod';
import { createLovableAiGatewayRunIdFetch } from './run-id.server.ts';

/** Final-only extraction consumes the upstream stream without an artificial deadline. */
export function createResponsesExtraction<T extends z.ZodTypeAny>(
  apiKey: string,
  messages: ModelMessage[],
  schema: T,
  signal?: AbortSignal,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    apiKey,
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: runIdFetch.fetch,
  });
  return streamText({
    model: provider.responses('openai/gpt-6-astra'),
    messages,
    output: Output.object({ schema }),
    ...(signal ? { abortSignal: signal } : {}),
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: 'low',
        reasoningSummary: 'auto',
        store: false,
        include: ['reasoning.encrypted_content'],
      },
    },
  });
}