import OpenAI from 'openai';
import { GitBlameAiError } from '../errors.js';

export interface OpenAiExplainInput {
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens?: number;
  baseURL?: string;
}

export async function explainWithOpenAi(input: OpenAiExplainInput): Promise<string> {
  const client = new OpenAI({
    apiKey: input.apiKey,
    baseURL: input.baseURL,
  });

  const response = await client.chat.completions.create({
    model: input.model,
    temperature: 0.1,
    max_tokens: input.maxTokens ?? 320,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior software engineer. Explain why a line exists based on repository history in 2-4 concise sentences.',
      },
      {
        role: 'user',
        content: input.prompt,
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new GitBlameAiError('OpenAI returned an empty response', 'EMPTY_LLM_RESPONSE');
  }

  return text;
}
