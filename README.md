# gitblame.ai

`gitblame.ai` explains why a specific line of code exists by combining `git blame`, commit history, and optional PR context, then synthesizing that evidence with an LLM.

Supported providers:
- Anthropic
- OpenAI
- Groq (OpenAI-compatible API)

## Why this exists

`git blame` identifies who last changed a line, but not the historical intent behind it.

This CLI gathers:
- the blamed commit metadata for the exact line,
- a short history of prior commits touching that line,
- an optional PR description (GitHub),
- and asks an LLM for a concise engineering rationale.

## Installation

```bash
npm install
npm run build
```

Global install after publishing:

```bash
npm install -g gitblame-ai
```

## Usage

```bash
gitblame.ai <file> <line>
```

Examples:

```bash
gitblame.ai src/auth.ts 42
gitblame.ai src/auth.ts 42 --history 5
gitblame.ai src/auth.ts 42 --json
gitblame.ai src/auth.ts 42 --no-pr
gitblame.ai src/auth.ts 42 --provider openai --model gpt-4.1-mini
gitblame.ai src/auth.ts 42 --provider groq --model llama-3.3-70b-versatile
```

## Configuration priority

Configuration sources are merged in this order (last wins):
1. built-in defaults,
2. `.gitblamerc`,
3. environment variables,
4. CLI flags.

Copy `.gitblamerc.example` to `.gitblamerc` and customize it.

## Environment variables

Required for Anthropic provider:
- `ANTHROPIC_API_KEY`

Required for OpenAI provider:
- `OPENAI_API_KEY`

Required for Groq provider:
- `GROQ_API_KEY`

Optional:
- `GITHUB_TOKEN` (enables GitHub PR context)
- `GITBLAME_PROVIDER` (`anthropic`, `openai`, or `groq`)
- `GITBLAME_MODEL`
- `GITBLAME_MAX_HISTORY`
- `GITBLAME_INCLUDE_PR` (`true`/`false`, `1`/`0`)
- `GITBLAME_OUTPUT_FORMAT` (`text` or `json`)
- `GITBLAME_NO_COLOR` (`true`/`false`, `1`/`0`)
- `OPENAI_BASE_URL` (for compatible endpoints)
- `GROQ_MODEL`
- `GROQ_BASE_URL`

### Quick Groq setup

PowerShell:

```powershell
$env:GROQ_API_KEY="<your-groq-key>"
$env:GITBLAME_PROVIDER="groq"
gitblame.ai src/auth.ts 42 --model llama-3.3-70b-versatile
```

Security note:
- Do not commit API keys to source control.
- Prefer ephemeral environment variables over writing keys into files.

## Project structure

```text
gitblame.ai/
  src/
    index.ts
    config/
      loader.ts
    git/
      blame.ts
      log.ts
      repo.ts
    llm/
      anthropic.ts
      openai.ts
      client.ts
    output/
      formatter.ts
    prompt/
      builder.ts
    providers/
      base.ts
      github.ts
      gitlab.ts
  tests/
    unit/
```

## Development commands

```bash
npm run test
npm run typecheck
npm run build
npm run release:check
```

## CI

GitHub Actions workflow at .github/workflows/ci.yml runs:
- typecheck
- unit tests
- build

## Release

Automated release workflow at .github/workflows/release.yml handles:
- release quality gate (`npm run release:check`)
- GitHub release note generation for version tags
- npm publish with provenance (if `NPM_TOKEN` is configured)

Release steps:
1. Ensure `package.json` version is correct.
2. Commit and push changes to `main`.
3. Create and push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

4. Configure repository secret `NPM_TOKEN` to enable npm publishing.

## Notes

- The tool runs locally and stores no persistent state.
- If PR lookup fails, the CLI continues using git data only.
- The output is evidence-based but probabilistic; validate critical decisions against full commit/PR history.
