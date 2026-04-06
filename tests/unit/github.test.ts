import { describe, expect, it, vi } from 'vitest';
import { fetchGitHubPullRequestForCommit, parseGitHubRemote } from '../../src/providers/github.js';

describe('parseGitHubRemote', () => {
  it('parses ssh remote', () => {
    expect(parseGitHubRemote('git@github.com:acme/api.git')).toEqual({
      owner: 'acme',
      repo: 'api',
    });
  });

  it('parses https remote', () => {
    expect(parseGitHubRemote('https://github.com/acme/api.git')).toEqual({
      owner: 'acme',
      repo: 'api',
    });
  });

  it('returns null for non-github remotes', () => {
    expect(parseGitHubRemote('https://gitlab.com/acme/api.git')).toBeNull();
  });
});

describe('fetchGitHubPullRequestForCommit', () => {
  it('returns null on non-ok responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });

    const result = await fetchGitHubPullRequestForCommit({
      commitHash: 'abc123',
      remoteUrl: 'git@github.com:acme/api.git',
      token: 'token',
      fetchImpl: fetchMock as typeof fetch,
    });

    expect(result).toBeNull();
  });

  it('maps first PR payload to normalized output', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        {
          number: 45,
          title: 'Fix race in auth middleware',
          body: 'Root cause was stale cache state.',
          html_url: 'https://github.com/acme/api/pull/45',
        },
      ]),
    });

    const result = await fetchGitHubPullRequestForCommit({
      commitHash: 'abc123',
      remoteUrl: 'git@github.com:acme/api.git',
      token: 'token',
      fetchImpl: fetchMock as typeof fetch,
    });

    expect(result).toEqual({
      number: 45,
      title: 'Fix race in auth middleware',
      body: 'Root cause was stale cache state.',
      url: 'https://github.com/acme/api/pull/45',
      source: 'github',
    });
  });
});
