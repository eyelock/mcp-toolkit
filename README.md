# MCP Toolkit

A production-ready template for building Model Context Protocol (MCP) servers with CLI parity.

## Features

- **Dual Interface**: MCP server tools and CLI commands share the same business logic
- **Multiple Transports**: stdio (default) and HTTP/SSE for web integrations
- **Type-Safe**: Zod schemas as single source of truth
- **Server Identity**: Canonical names and tags for distinguishing installations
- **Monorepo**: pnpm workspaces with Turborepo for fast builds
- **Code Quality**: [Biome](https://biomejs.dev/) for fast linting and formatting
- **Extensible**: Provider pattern for pluggable storage backends
- **Docker Ready**: Production Dockerfiles for both MCP server and CLI

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm: `corepack enable` (uses version from package.json)

### Installation

**From GitHub (private or public repo):**

```bash
# Clone the repository
git clone https://github.com/eyelock/mcp-toolkit.git my-mcp-server
cd my-mcp-server

# Remove git history and reinitialize
rm -rf .git

# Run setup to customize project names
./bin/setup.sh
```

**Using degit (public repos only, no git history):**

```bash
npx degit eyelock/mcp-toolkit my-mcp-server
cd my-mcp-server
./bin/setup.sh
```

### Setup Wizard

The setup script will prompt you for:

| Prompt | Example | Used For |
|--------|---------|----------|
| Project name | `my-api-server` | Package names, binary names |
| Package scope | `@myorg` | NPM scope for packages |
| Description | `My awesome MCP server` | package.json description |
| Author | `Your Name` | package.json author |

After setup, your packages will be renamed (e.g., `@myorg/mcp`, `@myorg/cli`).

### Build & Run

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint & format (Biome)
pnpm check        # Check for issues
pnpm check:fix    # Auto-fix issues
pnpm format       # Format code

# Run MCP server with inspector
make mcp
```

## Development

### Make Targets

```bash
make help          # Show all targets
make rebuild       # Clean rebuild with lint & test
make mcp           # Run with MCP Inspector
make mcp.stdio     # Run in stdio mode
make mcp.http      # Run HTTP server
make cli           # Show CLI help
```

### Worktree Development

```bash
# Create feature branch first
git checkout -b my-feature

# Create worktree (switches main back to main, creates ../mcp-toolkit-my-feature)
make worktree

# In the worktree, update with latest main
make worktree.update

# When done, safely delete worktree
make worktree.delete
```

### Test Coverage

```bash
pnpm test:coverage
```

## Project Structure

```
my-mcp-server/
├── packages/
│   ├── model/           # Zod schemas (single source of truth)
│   ├── provider/        # Storage provider interface + implementations
│   ├── mcp/             # MCP server with tools, resources, prompts
│   ├── cli/             # CLI commands (OCLIF)
│   └── shared/          # Shared configs (typescript, vitest)
├── bin/
│   ├── setup.sh         # Project customization script
│   └── dev/             # Development helper scripts
├── Makefile             # Development commands
└── .github/workflows/   # CI/CD workflows
```

## Server Identity & Tags

MCP Toolkit includes a flexible tagging system (similar to AWS/Kubernetes tags) that helps distinguish between different server installations.

### Canonical Name

Each server has a canonical name that identifies it across all installations. Set this once when customizing your server:

```typescript
// packages/mcp/src/index.ts
const CANONICAL_NAME = "my-api-server";  // Change this
const VERSION = "1.0.0";
```

### Tags

Tags are key-value pairs for server metadata. They can be set via:

**1. Environment Variable** (lower precedence):
```bash
MCP_TAGS="env=development,team=platform,region=us-west-2"
```

**2. CLI Arguments** (higher precedence):
```bash
node ./packages/mcp/dist/index.js --tag env=staging --tag team=platform
```

**3. `--dev` Convenience Flag** (adds `env=development`):
```bash
node ./packages/mcp/dist/index.js --dev
```

### Use Cases

- **Dev vs Production**: Distinguish local development from global installations
- **Team Organization**: Tag servers by team ownership
- **Environment**: Mark staging, production, feature branches
- **Discovery**: Filter and find servers by metadata

### Example Output

When you call `server_info` or `session_init`, tags are displayed:

```
Server Information
─────────────────
Canonical Name: my-api-server
Server Name: my-api-server
Version: 1.0.0
Tags:
  env=development
  team=platform
```

### Makefile Integration

```makefile
dev:
    MCP_TAGS="team=platform,owner=david" node ./packages/mcp/dist/index.js --dev

staging:
    node ./packages/mcp/dist/index.js --tag env=staging --tag region=us-west-2
```

## Customizing Your Server

### 1. Define Your Model

Edit `packages/model/src/schema.ts`:

```typescript
import { z } from "zod";

export const MyDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  // ... your fields
});

export type MyData = z.infer<typeof MyDataSchema>;
```

### 2. Implement Your Provider

Create `packages/provider/src/my-provider.ts`:

```typescript
import type { SessionProvider } from "./interface.js";

export function createMyProvider(): SessionProvider {
  return {
    name: "my-provider",
    async initSession(input) { /* ... */ },
    async getSession() { /* ... */ },
    async updateSession(input) { /* ... */ },
    async clearSession() { /* ... */ },
    async hasSession() { /* ... */ },
  };
}
```

### 3. Add MCP Tools

Create `packages/mcp/src/tools/my-tool.ts`:

```typescript
import { z } from "zod";

export const myToolSchema = z.object({
  param: z.string().describe("Parameter description"),
});

export async function handleMyTool(args: z.infer<typeof myToolSchema>) {
  // Implementation
  return { content: [{ type: "text", text: "Result" }] };
}
```

### 4. Add CLI Commands

Create `packages/cli/src/commands/my-command.ts`:

```typescript
import { Command } from "@oclif/core";

export default class MyCommand extends Command {
  static override description = "My command description";

  async run() {
    // Implementation (share logic with MCP tool)
  }
}
```

## Claude Code Development

This project includes a `.mcp.json` configuration for developing and testing with Claude Code. The config provides two server options:

- **mcp-toolkit-stdio**: Local stdio transport (auto-managed by Claude)
- **mcp-toolkit-http**: HTTP transport (requires running server separately)

### Stdio Mode (Recommended)

```bash
pnpm build
claude
# Use /mcp to approve 'mcp-toolkit-stdio'
```

Claude auto-detects `.mcp.json` and manages the server lifecycle.

### HTTP Mode

```bash
# Terminal 1: Start HTTP server
make mcp.http

# Terminal 2: Launch Claude
claude
# Use /mcp to approve 'mcp-toolkit-http'
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TOOLKIT_PATH` | `./packages/mcp/dist` | Path to MCP dist folder |
| `MCP_TOOLKIT_PORT` | `3000` | Port for HTTP mode |
| `MCP_TAGS` | (none) | Comma-separated tags (e.g., `env=dev,team=platform`) |

## Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/my-mcp-server/packages/mcp/dist/index.js"]
    }
  }
}
```

## Docker

```bash
# Build images
./bin/dev/docker-build.sh

# Run MCP server
docker run -p 3000:3000 my-mcp-server-mcp:latest

# Run CLI
docker run my-mcp-server-cli:latest --help
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Consumers                             │
├─────────────────────────────────────────────────────────────┤
│   Claude Desktop    │    HTTP Client    │    CLI Terminal   │
└─────────┬───────────┴─────────┬─────────┴─────────┬─────────┘
          │ stdio               │ HTTP/SSE          │ direct
┌─────────▼───────────┬─────────▼─────────┬─────────▼─────────┐
│     MCP Server      │    HTTP Server    │       CLI         │
└─────────┬───────────┴─────────┬─────────┴─────────┬─────────┘
          └─────────────────────┼───────────────────┘
                    ┌───────────▼───────────┐
                    │       Provider        │
                    │   (storage layer)     │
                    └───────────┬───────────┘
                    ┌───────────▼───────────┐
                    │        Model          │
                    │   (Zod schemas)       │
                    └───────────────────────┘
```

## License

MIT
