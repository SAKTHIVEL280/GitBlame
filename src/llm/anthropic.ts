import Anthropic from '@anthropic-ai/sdk';
import { GitBlameAiError } from '../errors.js';

export interface AnthropicExplainInput {
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens?: number;
}

export async function explainWithAnthropic(input: AnthropicExplainInput): Promise<string> {
  const client = new Anthropic({ apiKey: input.apiKey });

  const response = await client.messages.create({
    model: input.model,
    max_tokens: input.maxTokens ?? 320,
    messages: [{ role: 'user', content: input.prompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new GitBlameAiError('Anthropic returned an empty response', 'EMPTY_LLM_RESPONSE');
  }

  return text;
}
