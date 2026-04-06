import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { GitBlameAiError } from '../errors.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveRepoRoot(startDir = process.cwd()): Promise<string> {
  const result = await execa('git', ['rev-parse', '--show-toplevel'], {
    cwd: startDir,
    reject: false,
  });

  if (result.exitCode !== 0) {
    throw new GitBlameAiError(
      'Current directory is not inside a Git repository',
      'NOT_A_GIT_REPOSITORY',
    );
  }

  return result.stdout.trim();
}

export async function resolveTargetFile(
  fileArgument: string,
  repoRoot: string,
): Promise<{ absolutePath: string; repoRelativePath: string; gitPath: string }> {
  const candidates = new Set<string>();

  if (path.isAbsolute(fileArgument)) {
    candidates.add(path.normalize(fileArgument));
  } else {
    candidates.add(path.resolve(process.cwd(), fileArgument));
    candidates.add(path.resolve(repoRoot, fileArgument));
  }

  let resolvedPath: string | null = null;
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      resolvedPath = candidate;
      break;
    }
  }

  if (!resolvedPath) {
    throw new GitBlameAiError(`File not found: ${fileArgument}`, 'FILE_NOT_FOUND');
  }

  const relativePath = path.relative(repoRoot, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new GitBlameAiError(
      `File must be inside repository root (${repoRoot}): ${resolvedPath}`,
      'FILE_OUTSIDE_REPOSITORY',
    );
  }

  const gitPath = relativePath.split(path.sep).join('/');
  const normalizedRelative = relativePath.split(path.sep).join('/');

  return {
    absolutePath: resolvedPath,
    repoRelativePath: normalizedRelative,
    gitPath,
  };
}

export async function assertLineNumberExists(filePath: string, lineNumber: number): Promise<void> {
  const fileContent = await readFile(filePath, 'utf8');
  const lines = fileContent.split(/\r?\n/);

  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new GitBlameAiError(
      `Line ${lineNumber} is out of range (file has ${lines.length} lines)`,
      'LINE_OUT_OF_RANGE',
    );
  }
}

export async function getRemoteOriginUrl(repoRoot: string): Promise<string | null> {
  const result = await execa('git', ['remote', 'get-url', 'origin'], {
    cwd: repoRoot,
    reject: false,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const trimmed = result.stdout.trim();
  return trimmed.length > 0 ? trimmed : null;
}
