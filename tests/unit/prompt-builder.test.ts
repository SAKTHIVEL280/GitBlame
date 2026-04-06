import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../../src/prompt/builder.js';

describe('buildPrompt', () => {
  it('embeds target line, history, and PR context in output prompt', () => {
    const prompt = buildPrompt({
      filePath: 'src/auth.ts',
      lineNumber: 42,
      lineContent: "if (user.role !== 'admin') return 403;",
      blame: {
        commitHash: 'abc123',
        author: 'Jane',
        authorEmail: 'jane@example.com',
        authorTime: 1_700_000_000,
        summary: 'Restrict admin endpoints',
        filename: 'src/auth.ts',
        lineContent: "if (user.role !== 'admin') return 403;",
      },
      commits: [
        {
          hash: 'abc123',
          shortHash: 'abc123',
          subject: 'Restrict admin endpoints',
          body: 'Follow-up after incident review',
          author: 'Jane',
          date: '2024-03-01',
          diff: '@@ -1 +1 @@',
        },
      ],
      pr: {
        number: 99,
        title: 'Add stricter admin checks',
        body: 'Documented incident timeline and remediation.',
        url: 'https://github.com/acme/repo/pull/99',
        source: 'github',
      },
    });

    expect(prompt).toContain('src/auth.ts');
    expect(prompt).toContain('lineNumber');
    expect(prompt).toContain('Restrict admin endpoints');
    expect(prompt).toContain('Add stricter admin checks');
  });
});
