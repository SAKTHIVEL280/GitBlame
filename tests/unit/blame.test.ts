import { describe, expect, it, vi } from 'vitest';
import { execa } from 'execa';
import { blameLine, parseBlamePorcelain } from '../../src/git/blame.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

const mockedExeca = vi.mocked(execa);

describe('parseBlamePorcelain', () => {
  it('parses porcelain output into a structured object', () => {
    const output = [
      'abc123def456 89 89 1',
      'author Jane Smith',
      'author-mail <jane@example.com>',
      'author-time 1647302400',
      'summary Hotfix auth bypass',
      'filename src/auth.ts',
      "\tif (user.role !== 'admin') return 403;",
    ].join('\n');

    const parsed = parseBlamePorcelain(output, 'src/auth.ts');

    expect(parsed.commitHash).toBe('abc123def456');
    expect(parsed.author).toBe('Jane Smith');
    expect(parsed.authorEmail).toBe('jane@example.com');
    expect(parsed.authorTime).toBe(1_647_302_400);
    expect(parsed.summary).toBe('Hotfix auth bypass');
    expect(parsed.filename).toBe('src/auth.ts');
    expect(parsed.lineContent).toBe("if (user.role !== 'admin') return 403;");
  });
});

describe('blameLine', () => {
  it('throws when git blame fails', async () => {
    mockedExeca.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: 'fatal: no such path',
    } as never);

    await expect(blameLine('src/auth.ts', 10, '/repo')).rejects.toThrow('git blame failed');
  });

  it('returns parsed output when git blame succeeds', async () => {
    mockedExeca.mockResolvedValueOnce({
      exitCode: 0,
      stdout: ['abc123 1 1 1', 'author John', 'author-mail <john@example.com>', '\treturn true;'].join('\n'),
      stderr: '',
    } as never);

    const result = await blameLine('src/auth.ts', 1, '/repo');
    expect(result.commitHash).toBe('abc123');
    expect(result.author).toBe('John');
    expect(result.lineContent).toBe('return true;');
  });
});
