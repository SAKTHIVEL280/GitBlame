import type { LlmProvider } from '../config/loader.js';
import { GitBlameAiError } from '../errors.js';
import { explainWithAnthropic } from './anthropic.js';
import { explainWithOpenAi } from './openai.js';

const GROQ_OPENAI_COMPAT_BASE_URL = 'https://api.groq.com/openai/v1';

export interface ExplainWhyLineInput {
  provider: LlmProvider;
  model: string;
  prompt: string;
  anthropicApiKey?: string;
  openAiApiKey?: string;
  groqApiKey?: string;
  openAiBaseUrl?: string;
  maxTokens?: number;
}

export async function explainWhyLineExists(input: ExplainWhyLineInput): Promise<string> {
  switch (input.provider) {
    case 'anthropic': {
      if (!input.anthropicApiKey) {
        throw new GitBlameAiError('ANTHROPIC_API_KEY not set', 'MISSING_API_KEY');
      }

      const anthropicInput: {
        apiKey: string;
        model: string;
        prompt: string;
        maxTokens?: number;
      } = {
        apiKey: input.anthropicApiKey,
        model: input.model,
        prompt: input.prompt,
      };

      if (input.maxTokens !== undefined) {
        anthropicInput.maxTokens = input.maxTokens;
      }

      return explainWithAnthropic(anthropicInput);
    }

    case 'openai': {
      if (!input.openAiApiKey) {
        throw new GitBlameAiError('OPENAI_API_KEY not set', 'MISSING_API_KEY');
      }

      const openAiInput: {
        apiKey: string;
        model: string;
        prompt: string;
        maxTokens?: number;
        baseURL?: string;
      } = {
        apiKey: input.openAiApiKey,
        model: input.model,
        prompt: input.prompt,
      };

      if (input.maxTokens !== undefined) {
        openAiInput.maxTokens = input.maxTokens;
      }

      if (input.openAiBaseUrl) {
        openAiInput.baseURL = input.openAiBaseUrl;
      }

      return explainWithOpenAi(openAiInput);
    }

    case 'groq': {
      const groqApiKey = input.groqApiKey ?? input.openAiApiKey;
      if (!groqApiKey) {
        throw new GitBlameAiError('GROQ_API_KEY not set', 'MISSING_API_KEY');
      }

      const groqInput: {
        apiKey: string;
        model: string;
        prompt: string;
        maxTokens?: number;
        baseURL?: string;
      } = {
        apiKey: groqApiKey,
        model: input.model,
        prompt: input.prompt,
        baseURL: input.openAiBaseUrl ?? GROQ_OPENAI_COMPAT_BASE_URL,
      };

      if (input.maxTokens !== undefined) {
        groqInput.maxTokens = input.maxTokens;
      }

      return explainWithOpenAi(groqInput);
    }

    default:
      throw new GitBlameAiError(`Unsupported provider: ${input.provider satisfies never}`, 'UNSUPPORTED_PROVIDER');
  }
}
