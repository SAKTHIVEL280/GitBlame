import type { BlameResult } from '../git/blame.js';
import type { CommitDetail } from '../git/log.js';
import type { PullRequestInfo } from '../providers/base.js';

export interface PromptContext {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  blame: BlameResult;
  commits: CommitDetail[];
  pr: PullRequestInfo | null;
}

const MAX_DIFF_LINES = 40;
const MAX_BODY_CHARS = 1200;
const MAX_PR_CHARS = 1200;

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n...[truncated]`;
}

function extractDiffExcerpt(diff: string): string {
  return diff
    .split(/\r?\n/)
    .slice(0, MAX_DIFF_LINES)
    .join('\n');
}

export function buildPrompt(context: PromptContext): string {
  const commitSummaries = context.commits.map((commit) => ({
    hash: commit.hash,
    shortHash: commit.shortHash,
    date: commit.date,
    author: commit.author,
    subject: commit.subject,
    body: truncate(commit.body, MAX_BODY_CHARS),
    diffExcerpt: extractDiffExcerpt(commit.diff),
  }));

  const promptPayload = {
    target: {
      filePath: context.filePath,
      lineNumber: context.lineNumber,
      lineContent: context.lineContent,
      blamedCommit: {
        hash: context.blame.commitHash,
        author: context.blame.author,
        authorEmail: context.blame.authorEmail,
        authorTime: context.blame.authorTime,
        summary: context.blame.summary,
      },
    },
    history: commitSummaries,
    pullRequest: context.pr
      ? {
          number: context.pr.number,
          title: context.pr.title,
          body: truncate(context.pr.body, MAX_PR_CHARS),
          url: context.pr.url,
          source: context.pr.source,
        }
      : null,
  };

  return [
    'You are a senior engineer writing a line-level historical explanation for another engineer.',
    'Task: explain WHY this exact line exists based on commit and PR history.',
    'Requirements:',
    '- Output 2-4 sentences.',
    '- Prioritize historical intent, incidents, migrations, or compatibility reasons.',
    '- Mention uncertainty when evidence is weak.',
    '- Do not include markdown headers or bullet points.',
    '- End with a practical safety note if the line appears removable.',
    '',
    'Context JSON:',
    JSON.stringify(promptPayload, null, 2),
  ].join('\n');
}
