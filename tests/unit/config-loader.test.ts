import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';

const tempDirs: string[] = [];

async function createTempRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gitblame-ai-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('loadConfig', () => {
  it('merges defaults, file config, env, and CLI overrides with expected precedence', async () => {
    const repoRoot = await createTempRepo();

    await writeFile(
      path.join(repoRoot, '.gitblamerc'),
      JSON.stringify(
        {
          provider: 'anthropic',
          model: 'claude-file-model',
          maxHistory: 8,
          includePR: true,
          outputFormat: 'text',
        },
        null,
        2,
      ),
      'utf8',
    );

    const config = await loadConfig({
      repoRoot,
      env: {
        GITBLAME_MODEL: 'claude-env-model',
        GITBLAME_MAX_HISTORY: '4',
      },
      cli: {
        outputFormat: 'json',
        maxHistory: 6,
      },
    });

    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-env-model');
    expect(config.maxHistory).toBe(6);
    expect(config.includePR).toBe(true);
    expect(config.outputFormat).toBe('json');
  });

  it('throws on invalid JSON config', async () => {
    const repoRoot = await createTempRepo();
    await writeFile(path.join(repoRoot, '.gitblamerc'), '{ invalid json', 'utf8');

    await expect(loadConfig({ repoRoot })).rejects.toThrow('Invalid JSON in .gitblamerc');
  });

  it('selects provider-specific default model when model is not set', async () => {
    const repoRoot = await createTempRepo();

    const config = await loadConfig({
      repoRoot,
      env: {
        GITBLAME_PROVIDER: 'groq',
      },
    });

    expect(config.provider).toBe('groq');
    expect(config.model).toBe('llama-3.3-70b-versatile');
  });
});
