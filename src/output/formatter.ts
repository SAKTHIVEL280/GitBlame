import { Chalk } from 'chalk';
import type { OutputFormat } from '../config/loader.js';
import type { BlameResult } from '../git/blame.js';
import type { PullRequestInfo } from '../providers/base.js';

export interface FormattedOutputInput {
  filePath: string;
  lineNumber: number;
  explanation: string;
  blame: BlameResult;
  model: string;
  provider: string;
  pullRequest: PullRequestInfo | null;
}

function toDateLabel(authorTimeUnixSeconds: number): string {
  if (!Number.isFinite(authorTimeUnixSeconds) || authorTimeUnixSeconds <= 0) {
    return 'unknown date';
  }

  return new Date(authorTimeUnixSeconds * 1000).toLocaleDateString();
}

export function printExplanation(
  input: FormattedOutputInput,
  outputFormat: OutputFormat,
  noColor: boolean,
): void {
  if (outputFormat === 'json') {
    console.log(
      JSON.stringify(
        {
          file: input.filePath,
          line: input.lineNumber,
          lineContent: input.blame.lineContent,
          commit: input.blame.commitHash,
          author: input.blame.author,
          provider: input.provider,
          model: input.model,
          pullRequest: input.pullRequest,
          explanation: input.explanation,
        },
        null,
        2,
      ),
    );
    return;
  }

  const color = new Chalk({ level: noColor ? 0 : 1 });

  console.log('');
  console.log(color.bold.blue(`${input.filePath}:${input.lineNumber}`));
  console.log(color.gray(`  ${input.blame.lineContent.trim()}`));
  console.log('');
  console.log(color.white(input.explanation.trim()));
  console.log('');

  const metaLine = `Commit: ${input.blame.commitHash.slice(0, 8)} · ${input.blame.author} · ${toDateLabel(input.blame.authorTime)} · ${input.provider}/${input.model}`;
  console.log(color.dim(`  ${metaLine}`));

  if (input.pullRequest) {
    console.log(color.dim(`  PR: #${input.pullRequest.number} ${input.pullRequest.title}`));
  }
}
