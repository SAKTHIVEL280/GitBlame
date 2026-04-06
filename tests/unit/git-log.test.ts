import { describe, expect, it } from 'vitest';
import { parseCommitHashesFromLineLogOutput } from '../../src/git/log.js';

describe('parseCommitHashesFromLineLogOutput', () => {
  it('extracts only commit hashes from line history output', () => {
    const output = [
      '4ebc3718c9c13f73d0f8f85e87d58ea2f88448d7',
      'diff --git a/src/auth.ts b/src/auth.ts',
      '@@ -2,1 +2,1 @@',
      "-  if (role !== 'admin') return false;",
      "+  if (role !== 'admin' && ip !== '10.0.0.1') return false;",
      '',
      'e8a0b024f4a17ab1ef4fe543d5a1e2f4de7ea7c2',
      'diff --git a/src/auth.ts b/src/auth.ts',
    ].join('\n');

    expect(parseCommitHashesFromLineLogOutput(output)).toEqual([
      '4ebc3718c9c13f73d0f8f85e87d58ea2f88448d7',
      'e8a0b024f4a17ab1ef4fe543d5a1e2f4de7ea7c2',
    ]);
  });

  it('deduplicates repeated hashes', () => {
    const output = ['abc1234', 'abc1234', 'abc1234'].join('\n');
    expect(parseCommitHashesFromLineLogOutput(output)).toEqual(['abc1234']);
  });
});
