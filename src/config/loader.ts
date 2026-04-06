import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { GitBlameAiError } from '../errors.js';

export type LlmProvider = 'anthropic' | 'openai' | 'groq';
export type OutputFormat = 'text' | 'json';

export interface RuntimeConfig {
  provider: LlmProvider;
  model: string;
  maxHistory: number;
  includePR: boolean;
  outputFormat: OutputFormat;
  noColor: boolean;
  openAiBaseUrl?: string | undefined;
}

export interface LoadConfigInput {
  repoRoot: string;
  env?: NodeJS.ProcessEnv;
  cli?: Partial<RuntimeConfig>;
}

type ConfigOverride = Partial<RuntimeConfig>;

const DEFAULT_PROVIDER: LlmProvider = 'anthropic';

const DEFAULT_CONFIG: Omit<RuntimeConfig, 'model'> = {
  provider: 'anthropic',
  maxHistory: 3,
  includePR: true,
  outputFormat: 'text',
  noColor: false,
};

const DEFAULT_MODEL_BY_PROVIDER: Record<LlmProvider, string> = {
  anthropic: 'claude-3-5-haiku-latest',
  openai: 'gpt-4.1-mini',
  groq: 'llama-3.3-70b-versatile',
};

const configOverrideSchema = z
  .object({
    provider: z.enum(['anthropic', 'openai', 'groq']).optional(),
    model: z.string().min(1).optional(),
    maxHistory: z.coerce.number().int().min(1).max(25).optional(),
    includePR: z.coerce.boolean().optional(),
    outputFormat: z.enum(['text', 'json']).optional(),
    noColor: z.coerce.boolean().optional(),
    openAiBaseUrl: z.string().url().optional(),
  })
  .strict();

const runtimeConfigSchema = z
  .object({
    provider: z.enum(['anthropic', 'openai', 'groq']),
    model: z.string().min(1),
    maxHistory: z.coerce.number().int().min(1).max(25),
    includePR: z.coerce.boolean(),
    outputFormat: z.enum(['text', 'json']),
    noColor: z.coerce.boolean(),
    openAiBaseUrl: z.string().url().optional(),
  })
  .strict();

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const output: Partial<T> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      output[key as keyof T] = entry as T[keyof T];
    }
  }

  return output;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

async function loadConfigFile(repoRoot: string): Promise<ConfigOverride> {
  const configPath = path.join(repoRoot, '.gitblamerc');

  try {
    const fileContent = await readFile(configPath, 'utf8');
    const jsonValue = JSON.parse(fileContent) as unknown;
    const parsed = configOverrideSchema.parse(jsonValue);
    return withoutUndefined(parsed) as ConfigOverride;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    if (error instanceof SyntaxError) {
      throw new GitBlameAiError(
        `Invalid JSON in .gitblamerc: ${error.message}`,
        'INVALID_CONFIG_JSON',
        error,
      );
    }

    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      throw new GitBlameAiError(
        `Invalid .gitblamerc schema: ${details}`,
        'INVALID_CONFIG_SCHEMA',
        error,
      );
    }

    throw error;
  }
}

function fromEnv(env: NodeJS.ProcessEnv): ConfigOverride {
  const envConfig: Partial<RuntimeConfig> = {};

  const provider = env.GITBLAME_PROVIDER?.trim().toLowerCase();
  if (provider === 'anthropic' || provider === 'openai' || provider === 'groq') {
    envConfig.provider = provider;
  }

  if (env.GITBLAME_MODEL?.trim()) {
    envConfig.model = env.GITBLAME_MODEL.trim();
  } else if (env.GROQ_MODEL?.trim()) {
    envConfig.model = env.GROQ_MODEL.trim();
  }

  const maxHistory = parseInteger(env.GITBLAME_MAX_HISTORY);
  if (maxHistory !== undefined) {
    envConfig.maxHistory = maxHistory;
  }

  const includePR = parseBoolean(env.GITBLAME_INCLUDE_PR);
  if (includePR !== undefined) {
    envConfig.includePR = includePR;
  }

  const outputFormat = env.GITBLAME_OUTPUT_FORMAT?.trim().toLowerCase();
  if (outputFormat === 'text' || outputFormat === 'json') {
    envConfig.outputFormat = outputFormat;
  }

  const noColor = parseBoolean(env.GITBLAME_NO_COLOR);
  if (noColor !== undefined) {
    envConfig.noColor = noColor;
  }

  if (env.OPENAI_BASE_URL?.trim()) {
    envConfig.openAiBaseUrl = env.OPENAI_BASE_URL.trim();
  } else if (env.GROQ_BASE_URL?.trim()) {
    envConfig.openAiBaseUrl = env.GROQ_BASE_URL.trim();
  }

  return withoutUndefined(envConfig) as ConfigOverride;
}

export async function loadConfig(input: LoadConfigInput): Promise<RuntimeConfig> {
  const env = input.env ?? process.env;
  const fileConfig = await loadConfigFile(input.repoRoot);
  const envConfig = fromEnv(env);

  const mergedWithPotentialModel = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
    ...input.cli,
  };

  const provider = mergedWithPotentialModel.provider ?? DEFAULT_PROVIDER;
  const model = mergedWithPotentialModel.model ?? DEFAULT_MODEL_BY_PROVIDER[provider];

  const merged = {
    ...mergedWithPotentialModel,
    provider,
    model,
  };

  const validated = runtimeConfigSchema.parse(merged);

  return validated;
}
