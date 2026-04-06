import path from 'node:path';
import { execa } from 'execa';
import { GitBlameAiError } from '../errors.js';

export interface CommitDetail {
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
  author: string;
  date: string;
  diff: string;
}

const META_SEPARATOR = '\u001f';
const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/i;

function toGitPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export async function getCommitDetail(
  hash: string,
  filePath: string,
  repoRoot: string,
): Promise<CommitDetail> {
  const format = ['%H', '%h', '%s', '%b', '%an', '%ad'].join(META_SEPARATOR);

  const metaResult = await execa('git', ['log', '-1', `--format=${format}`, '--date=short', hash], {
    cwd: repoRoot,
    reject: false,
  });

  if (metaResult.exitCode !== 0) {
    throw new GitBlameAiError(
      `git log failed for ${hash}: ${metaResult.stderr || metaResult.stdout || 'unknown git error'}`,
      'GIT_LOG_FAILED',
    );
  }

  const [fullHash, shortHash, subject, body, author, date] = metaResult.stdout.split(META_SEPARATOR);

  if (!fullHash || !shortHash || !subject || !author || !date) {
    throw new GitBlameAiError(`Unable to parse git log output for ${hash}`, 'PARSE_LOG_ERROR');
  }

  const diffResult = await execa(
    'git',
    ['show', '--unified=3', '--format=', '--no-color', hash, '--', filePath],
    {
      cwd: repoRoot,
      reject: false,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (diffResult.exitCode !== 0) {
    throw new GitBlameAiError(
      `git show failed for ${hash}: ${diffResult.stderr || diffResult.stdout || 'unknown git error'}`,
      'GIT_SHOW_FAILED',
    );
  }

  return {
    hash: fullHash,
    shortHash,
    subject,
    body: (body ?? '').trim(),
    author,
    date,
    diff: diffResult.stdout,
  };
}

export async function getCommitHistory(
  filePath: string,
  lineNumber: number,
  repoRoot: string,
  maxCommits = 5,
): Promise<string[]> {
  const gitPath = toGitPath(filePath);
  const result = await execa(
    'git',
    [
      'log',
      `--max-count=${maxCommits}`,
      '--pretty=%H',
      '--no-patch',
      `-L${lineNumber},${lineNumber}:${gitPath}`,
    ],
    {
      cwd: repoRoot,
      reject: false,
    },
  );

  if (result.exitCode !== 0) {
    throw new GitBlameAiError(
      `git history extraction failed: ${result.stderr || result.stdout || 'unknown git error'}`,
      'GIT_HISTORY_FAILED',
    );
  }

  return parseCommitHashesFromLineLogOutput(result.stdout);
}

export function parseCommitHashesFromLineLogOutput(output: string): string[] {
  const hashes = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => COMMIT_HASH_PATTERN.test(line));

  return [...new Set(hashes)];
}
