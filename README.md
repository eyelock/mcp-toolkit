# MCP Toolkit

A TypeScript monorepo template for building production-ready [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) servers with full specification coverage.

> **Note**: This is a personal hobby project developed in spare time. It's functional and tested, but expect rough edges. Contributions welcome!

## What is MCP Toolkit?

MCP Toolkit provides:

| Component | Purpose |
|-----------|---------|
| **Template** | Clone and customize to build your own MCP server |
| **Reference Implementation** | Working examples of MCP spec features (tools, resources, prompts, sampling, elicitation) |
| **Hook System** | Contextual LLM guidance through lifecycle hooks |
| **Testing Harness** | Utilities for testing MCP tools and workflows |

## Quick Start

```bash
# Clone the template
git clone https://github.com/eyelock/mcp-toolkit.git my-mcp-server
cd my-mcp-server

# Remove git history and customize
rm -rf .git
./bin/setup.sh

# Build and run
pnpm install
pnpm build
pnpm test
```

## Features

- **Dual Interface**: MCP server + CLI share the same business logic
- **Multiple Transports**: stdio (Claude Desktop) and HTTP/SSE (web)
- **Type-Safe**: Zod schemas as single source of truth
- **Full MCP Spec Coverage**: Tools, resources, prompts, sampling, elicitation, logging, pagination
- **Hook System**: Contextual guidance for LLM workflows
- **Monorepo**: pnpm workspaces + Turborepo for fast builds
- **Tested**: Comprehensive test coverage with Vitest

## Project Structure

```
mcp-toolkit/
├── packages/
│   ├── mcp/        # MCP server implementation
│   ├── core/       # Hook system and registry
│   ├── toolkit/    # Demo workflows (optional, deletable)
│   ├── model/      # Zod schemas
│   ├── cli/        # CLI commands (OCLIF)
│   └── testing/    # Test utilities
├── docs/           # Full documentation
└── bin/            # Setup and dev scripts
```

## Documentation

- [Getting Started](docs/getting-started.md) - Installation and first steps
- [MCP Reference](docs/mcp-reference.md) - MCP spec implementation details
- [Hooks System](docs/hooks.md) - Contextual LLM guidance
- [Tool Delegation](docs/tool-delegation.md) - Host LLM collaboration patterns

## Claude Code Integration

MCP Toolkit includes `.mcp.json` for immediate Claude Code integration:

```bash
pnpm build
claude
# Approve 'mcp-toolkit-stdio' when prompted
```

## Development

```bash
make help          # Show all targets
make rebuild       # Clean rebuild with lint & test
make mcp           # Run with MCP Inspector
```

## Requirements

- Node.js 20+
- pnpm (via `corepack enable`)

## Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - The specification
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) - Official TypeScript SDK
- [Claude Code](https://claude.ai/claude-code) - Development assistant

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Issues and PRs welcome!

## License

MIT
