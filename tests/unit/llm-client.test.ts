import { describe, expect, it, vi } from 'vitest';
import { explainWhyLineExists } from '../../src/llm/client.js';

vi.mock('../../src/llm/anthropic.js', () => ({
  explainWithAnthropic: vi.fn().mockResolvedValue('anthropic explanation'),
}));

vi.mock('../../src/llm/openai.js', () => ({
  explainWithOpenAi: vi.fn().mockResolvedValue('openai explanation'),
}));

import { explainWithOpenAi } from '../../src/llm/openai.js';

const mockedExplainWithOpenAi = vi.mocked(explainWithOpenAi);

describe('explainWhyLineExists', () => {
  it('throws when Groq key is missing', async () => {
    await expect(
      explainWhyLineExists({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        prompt: 'test prompt',
      }),
    ).rejects.toThrow('GROQ_API_KEY not set');
  });

  it('routes Groq provider through OpenAI-compatible client with default Groq base URL', async () => {
    await explainWhyLineExists({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      prompt: 'test prompt',
      groqApiKey: 'gsk-test-key',
    });

    expect(mockedExplainWithOpenAi).toHaveBeenCalledWith({
      apiKey: 'gsk-test-key',
      model: 'llama-3.3-70b-versatile',
      prompt: 'test prompt',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  });
});
