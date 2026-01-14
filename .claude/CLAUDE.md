# Claude - MCP Toolkit

## Communication Preferences

When working with complex technical topics (architecture, schema design, multi-step planning):
- Take a guided, conversational approach
- Present context and explain the problem first
- Ask clarifying questions ONE AT A TIME
- Wait for my response before moving to the next question
- Don't dump large analysis documents all at once
- Frame it as a discussion, not a report

## Feedback Sessions

When I say "let me give you feedback" or similar phrases indicating I want to provide iterative input:
- Wait for ALL my feedback before making any code changes
- I will explicitly say "done", "finished", "that's all", or similar when I'm ready for you to act
- Acknowledge each point briefly but don't implement anything mid-session
- At the end, summarize what you understood before proceeding

## Planning

- ALWAYS put your plans in .claude/plans
- ALWAYS put your session handovers in .claude/sessions

## CODE HYGIENE

**CRITICAL: Local checks MUST pass before pushing to remote.**

Do this workflow at the end of any significant development work:

1. **Use ACME** if it is available for tracking work
2. **Clean** the software, including dependencies
3. **Install dependencies**, check for any new or large warnings in the logs
4. **Build** the project - zero error tolerance, strive for zero warning tolerance
5. **Format** the code, add any changes as needed
6. **Lint** the code - zero error tolerance, strive for zero warning tolerance
7. **TypeScript**: Always check for type errors regularly - fixing a massive batch is wasteful
8. **Run unit tests** with coverage, look for failures and address low coverage if needed
9. **Run integration tests** if present, ensure zero errors

**Only push to remote when ALL local checks pass.**

## RESPONSIBLE CI/CD USAGE

**Environmental responsibility**: Every CI run consumes energy and compute resources. Be mindful.

### Before Pushing to Remote

1. **Run the full check locally first**:
   ```bash
   pnpm build && pnpm check && pnpm typecheck && pnpm test
   ```
2. **Only push when ALL checks pass** - never push "to see if CI catches something"
3. **Batch related changes** into meaningful commits rather than many small pushes

### Path Filtering

CI workflows are configured to only run when relevant files change:

**Triggers CI** (code/build changes):
- `packages/**` - Source code
- `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json` - Dependencies
- `biome.json`, `turbo.json` - Build/lint config
- `.github/workflows/**` - Workflow changes

**Does NOT trigger CI** (documentation only):
- `**/*.md` - All markdown files
- `docs/**` - Documentation folder
- `.claude/**` - Claude config
- `.changeset/**` - Release metadata
- `.devcontainer/**` - Dev environment
- `.acme/**` - ACME tracking
- `LICENSE`, `.gitignore`, `.mcp.json`, `mcp.config.json`
- `Makefile`, `bin/dev/**`, `scripts/**`

### Avoiding Duplicate Runs

- CI and Release both trigger on code changes to main
- This is intentional: CI validates, Release handles versioning
- Both use caching to minimize redundant work
- Documentation-only changes trigger neither workflow

### Commit Discipline

- **Never commit with failing tests** just to "try it in CI"
- **Never push multiple times** to iterate on CI failures
- **Fix locally first**, then push once when ready

## Project Structure

```
packages/
├── core/       # Hook system and storage interfaces
├── mcp/        # MCP server implementation
├── model/      # Zod schemas
├── toolkit/    # Demo workflows (optional)
├── cli/        # CLI commands
├── testing/    # Test utilities
└── shared/     # Shared TypeScript/Vitest configs
```

## Quick Commands

```bash
# Full local validation (run before push)
pnpm build && pnpm check && pnpm typecheck && pnpm test

# Individual checks
pnpm build          # Build all packages
pnpm check          # Lint check
pnpm check:fix      # Auto-fix lint issues
pnpm format         # Format code
pnpm typecheck      # Type check
pnpm test           # Run tests
pnpm test:coverage  # Tests with coverage

# Make targets
make rebuild        # Clean rebuild with all checks
make mcp            # Run with MCP Inspector
```
