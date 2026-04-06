export class GitBlameAiError extends Error {
  public readonly code: string;

  public readonly causeValue: unknown;

  public constructor(message: string, code = 'GITBLAME_AI_ERROR', causeValue?: unknown) {
    super(message);
    this.name = 'GitBlameAiError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

export function isGitBlameAiError(error: unknown): error is GitBlameAiError {
  return error instanceof GitBlameAiError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}
