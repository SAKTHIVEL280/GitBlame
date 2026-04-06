import type { PullRequestInfo } from './base.js';

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

interface GitHubPullResponse {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
}

interface FetchGitHubPullRequestInput {
  commitHash: string;
  remoteUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

function normalizeRepoName(repo: string): string {
  return repo.endsWith('.git') ? repo.slice(0, -4) : repo;
}

export function parseGitHubRemote(remoteUrl: string): GitHubRepoRef | null {
  const normalized = remoteUrl.trim();

  const patterns = [
    /^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
    /^https?:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
    /^ssh:\/\/git@github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    const owner = match?.groups?.owner;
    const repo = match?.groups?.repo;
    if (owner && repo) {
      return {
        owner,
        repo: normalizeRepoName(repo),
      };
    }
  }

  return null;
}

function isGitHubPullArray(value: unknown): value is GitHubPullResponse[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Record<string, unknown>;
    return (
      typeof candidate.number === 'number' &&
      typeof candidate.title === 'string' &&
      (typeof candidate.body === 'string' || candidate.body === null) &&
      typeof candidate.html_url === 'string'
    );
  });
}

export async function fetchGitHubPullRequestForCommit(
  input: FetchGitHubPullRequestInput,
): Promise<PullRequestInfo | null> {
  const repoRef = parseGitHubRemote(input.remoteUrl);
  if (!repoRef) {
    return null;
  }

  const endpoint = `https://api.github.com/repos/${repoRef.owner}/${repoRef.repo}/commits/${input.commitHash}/pulls`;
  const fetcher = input.fetchImpl ?? fetch;

  const response = await fetcher(endpoint, {
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gitblame-ai',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  if (!isGitHubPullArray(payload) || payload.length === 0) {
    return null;
  }

  const pr = payload[0];
  if (!pr) {
    return null;
  }

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    url: pr.html_url,
    source: 'github',
  };
}
