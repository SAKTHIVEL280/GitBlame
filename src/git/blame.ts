import { execa } from 'execa';
import { GitBlameAiError } from '../errors.js';

export interface BlameResult {
  commitHash: string;
  author: string;
  authorEmail: string;
  authorTime: number;
  summary: string;
  filename: string;
  lineContent: string;
}

export function parseBlamePorcelain(output: string, fallbackFilePath: string): BlameResult {
  const lines = output.split(/\r?\n/);
  const header = lines[0] ?? '';
  const headerFields = header.split(' ');
  const commitHash = headerFields[0] ?? '';

  if (!commitHash) {
    throw new GitBlameAiError('Unable to parse git blame output: missing commit hash', 'PARSE_BLAME_ERROR');
  }

  const fields: Record<string, string> = {};
  let lineContent = '';

  for (const line of lines.slice(1)) {
    if (line.startsWith('\t')) {
      lineContent = line.slice(1);
      continue;
    }

    const spaceIndex = line.indexOf(' ');
    if (spaceIndex <= 0) {
      continue;
    }

    const key = line.slice(0, spaceIndex);
    const value = line.slice(spaceIndex + 1);
    fields[key] = value;
  }

  const authorEmail = (fields['author-mail'] ?? '').replace(/^<|>$/g, '');
  const authorTime = Number.parseInt(fields['author-time'] ?? '0', 10);

  return {
    commitHash,
    author: fields.author ?? 'Unknown',
    authorEmail,
    authorTime: Number.isFinite(authorTime) ? authorTime : 0,
    summary: fields.summary ?? '',
    filename: fields.filename ?? fallbackFilePath,
    lineContent,
  };
}

export async function blameLine(
  filePath: string,
  lineNumber: number,
  repoRoot: string,
): Promise<BlameResult> {
  const result = await execa(
    'git',
    ['blame', '-L', `${lineNumber},${lineNumber}`, '--porcelain', '--', filePath],
    {
      cwd: repoRoot,
      reject: false,
    },
  );

  if (result.exitCode !== 0) {
    throw new GitBlameAiError(
      `git blame failed: ${result.stderr || result.stdout || 'unknown git error'}`,
      'GIT_BLAME_FAILED',
    );
  }

  return parseBlamePorcelain(result.stdout, filePath);
}
