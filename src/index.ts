#!/usr/bin/env node
import { Option, program } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { loadConfig, type LlmProvider, type RuntimeConfig } from './config/loader.js';
import { getErrorMessage, isGitBlameAiError } from './errors.js';
import { blameLine } from './git/blame.js';
import { getCommitDetail, getCommitHistory } from './git/log.js';
import {
  assertLineNumberExists,
  getRemoteOriginUrl,
  resolveRepoRoot,
  resolveTargetFile,
} from './git/repo.js';
import { explainWhyLineExists } from './llm/client.js';
import type { ExplainWhyLineInput } from './llm/client.js';
import { printExplanation } from './output/formatter.js';
import { buildPrompt } from './prompt/builder.js';
import { fetchGitHubPullRequestForCommit, parseGitHubRemote } from './providers/github.js';
import type { PullRequestInfo } from './providers/base.js';

interface CliOptions {
  json?: boolean;
  noPr?: boolean;
  history?: number;
  provider?: LlmProvider;
  model?: string;
  repo?: string;
  debug?: boolean;
}

function logDebug(enabled: boolean | undefined, message: string): void {
  if (enabled) {
    console.error(chalk.dim(`[debug] ${message}`));
  }
}

function buildCliConfig(options: CliOptions): Partial<RuntimeConfig> {
  const overrides: Partial<RuntimeConfig> = {};

  if (typeof options.history === 'number') {
    overrides.maxHistory = options.history;
  }

  if (options.provider) {
    overrides.provider = options.provider;
  }

  if (options.model) {
    overrides.model = options.model;
  }

  if (options.noPr === true) {
    overrides.includePR = false;
  }

  if (options.json) {
    overrides.outputFormat = 'json';
  }

  return overrides;
}

async function maybeFetchPullRequestContext(
  includePR: boolean,
  commitHash: string,
  repoRoot: string,
  debug: boolean | undefined,
): Promise<PullRequestInfo | null> {
  if (!includePR) {
    logDebug(debug, 'PR fetch disabled by config/flags');
    return null;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logDebug(debug, 'GITHUB_TOKEN not set; skipping PR fetch');
    return null;
  }

  const remoteUrl = await getRemoteOriginUrl(repoRoot);
  if (!remoteUrl) {
    logDebug(debug, 'No origin remote detected; skipping PR fetch');
    return null;
  }

  if (!parseGitHubRemote(remoteUrl)) {
    logDebug(debug, `Remote is not GitHub (${remoteUrl}); skipping PR fetch`);
    return null;
  }

  try {
    return await fetchGitHubPullRequestForCommit({
      commitHash,
      remoteUrl,
      token,
    });
  } catch (error) {
    logDebug(debug, `PR fetch failed: ${getErrorMessage(error)}`);
    return null;
  }
}

async function run(fileArgument: string, lineArgument: string, options: CliOptions): Promise<void> {
  const lineNumber = Number.parseInt(lineArgument, 10);
  if (!Number.isInteger(lineNumber) || lineNumber <= 0) {
    throw new Error('Line must be a positive integer');
  }

  const repoStartPath = options.repo ? path.resolve(options.repo) : process.cwd();
  const repoRoot = await resolveRepoRoot(repoStartPath);

  const config = await loadConfig({
    repoRoot,
    cli: buildCliConfig(options),
  });

  logDebug(options.debug, `Repository root: ${repoRoot}`);
  logDebug(options.debug, `Provider/model: ${config.provider}/${config.model}`);

  const target = await resolveTargetFile(fileArgument, repoRoot);
  await assertLineNumberExists(target.absolutePath, lineNumber);

  console.error(chalk.dim(`Analyzing ${target.repoRelativePath}:${lineNumber}...`));

  const blame = await blameLine(target.gitPath, lineNumber, repoRoot);
  console.error(chalk.dim(`Blame commit: ${blame.commitHash.slice(0, 8)} by ${blame.author}`));

  const historyHashes = await getCommitHistory(target.gitPath, lineNumber, repoRoot, config.maxHistory);
  const uniqueHashes = [...new Set(historyHashes.length > 0 ? historyHashes : [blame.commitHash])];

  const commits = await Promise.all(
    uniqueHashes.map(async (hash) => getCommitDetail(hash, target.gitPath, repoRoot)),
  );

  const pullRequest = await maybeFetchPullRequestContext(
    config.includePR,
    blame.commitHash,
    repoRoot,
    options.debug,
  );

  const prompt = buildPrompt({
    filePath: target.repoRelativePath,
    lineNumber,
    lineContent: blame.lineContent,
    blame,
    commits,
    pr: pullRequest,
  });

  console.error(chalk.dim('Asking AI...'));

  const llmInput: ExplainWhyLineInput = {
    provider: config.provider,
    model: config.model,
    prompt,
  };

  if (process.env.ANTHROPIC_API_KEY) {
    llmInput.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  }

  if (process.env.OPENAI_API_KEY) {
    llmInput.openAiApiKey = process.env.OPENAI_API_KEY;
  }

  if (process.env.GROQ_API_KEY) {
    llmInput.groqApiKey = process.env.GROQ_API_KEY;
  }

  if (config.openAiBaseUrl) {
    llmInput.openAiBaseUrl = config.openAiBaseUrl;
  }

  const explanation = await explainWhyLineExists(llmInput);

  printExplanation(
    {
      filePath: target.repoRelativePath,
      lineNumber,
      explanation,
      blame,
      provider: config.provider,
      model: config.model,
      pullRequest,
    },
    config.outputFormat,
    config.noColor,
  );
}

async function main(): Promise<void> {
  program
    .name('gitblame.ai')
    .description('Explain why any line of code exists using git history and AI')
    .argument('<file>', 'File path (absolute or relative to repository)')
    .argument('<line>', 'Line number to explain')
    .option('--json', 'Output explanation as JSON')
    .option('--no-pr', 'Skip PR lookup even if token is set')
    .option('--debug', 'Print debug diagnostics to stderr')
    .option('--repo <path>', 'Path inside target git repository')
    .option(
      '--history <n>',
      'Number of historical commits to include (1-25)',
      (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) {
          throw new Error('--history must be an integer between 1 and 25');
        }
        return parsed;
      },
    )
    .addOption(
      new Option('--provider <provider>', 'LLM provider').choices(['anthropic', 'openai', 'groq']),
    )
    .option('--model <model>', 'Override model name')
    .showHelpAfterError('(run with --help for usage)')
    .action(run);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  const message = getErrorMessage(error);

  if (isGitBlameAiError(error)) {
    console.error(chalk.red(`Error [${error.code}]: ${message}`));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }

  process.exit(1);
});
