# Contributing to MCP Toolkit

Thanks for your interest in contributing! This is a hobby project, so the bar is low and help is appreciated.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Build: `pnpm build`
5. Run tests: `pnpm test`

## Development Workflow

```bash
# Full rebuild with checks
make rebuild

# Run MCP Inspector for interactive testing
make mcp

# Check code quality
pnpm check        # Lint check
pnpm check:fix    # Auto-fix issues
pnpm format       # Format code

# Run tests with coverage
pnpm test:coverage
```

## Code Quality

We use [Biome](https://biomejs.dev/) for linting and formatting. Before submitting:

```bash
pnpm check:fix
pnpm format
pnpm test
```

## Pull Requests

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Ensure tests pass: `pnpm test`
4. Ensure lint passes: `pnpm check`
5. Commit with a descriptive message
6. Push and open a PR

### Commit Messages

Use conventional commits when possible:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `test:` Test additions/changes
- `refactor:` Code refactoring

## Project Structure

```
packages/
├── mcp/        # MCP server - tools, resources, prompts
├── core/       # Hook system and registry
├── toolkit/    # Demo workflows (optional)
├── model/      # Zod schemas
├── cli/        # CLI commands
├── testing/    # Test utilities
└── shared/     # Shared TypeScript/Vitest configs
```

## Areas for Contribution

- Bug fixes and improvements
- Documentation improvements
- New MCP spec feature implementations
- Test coverage improvements
- Hook examples and patterns

## Questions?

Open an issue! This is a learning project as much as anything else.
