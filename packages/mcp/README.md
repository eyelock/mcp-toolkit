# @mcp-toolkit/mcp

MCP server implementation with full specification coverage including tools, resources, prompts, sampling, elicitation, and multiple transports.

## Features

- **Tools**: Session management, server info
- **Resources**: Session state, URI templates
- **Prompts**: Welcome prompts with arguments
- **Sampling**: Server-initiated LLM requests
- **Elicitation**: Interactive user input gathering
- **Transports**: stdio (Claude Desktop) and HTTP/SSE (web)
- **Logging**: RFC 5424 compliant logging with MCP protocol transport
- **Progress**: Long-running operation progress reporting
- **Cancellation**: Interruptible operations
- **Pagination**: Cursor-based pagination utilities

## Installation

```bash
pnpm add @mcp-toolkit/mcp
```

## Usage

### Running the Server

```bash
# stdio mode (for Claude Desktop)
node dist/index.js

# HTTP mode (for web integrations)
node dist/index.js --http --port 3000

# With development tags
node dist/index.js --dev
```

### Creating a Server Programmatically

```typescript
import { createServer, startStdioTransport } from "@mcp-toolkit/mcp";
import { MemoryProvider } from "@mcp-toolkit/core";

const server = createServer({
  name: "my-server",
  version: "1.0.0",
  provider: new MemoryProvider(),
  identity: {
    canonicalName: "my-server",
    tags: { environment: "production" },
  },
});

// Start with stdio transport
await startStdioTransport(server);
```

### Adding Custom Tools

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const inputSchema = z.object({
  query: z.string().describe("Search query"),
});

export const myTool: Tool = {
  name: "my_tool",
  description: "Performs a search",
  inputSchema: zodToJsonSchema(inputSchema) as Tool["inputSchema"],
};

export async function handleMyTool(args: unknown): Promise<CallToolResult> {
  const { query } = inputSchema.parse(args);
  return {
    content: [{ type: "text", text: `Results for: ${query}` }],
  };
}
```

### Adding Custom Resources

```typescript
import type { Resource } from "@modelcontextprotocol/sdk/types.js";

export const myResource: Resource = {
  uri: "my-server://data/config",
  name: "Configuration",
  mimeType: "application/json",
};

export async function readMyResource(): Promise<string> {
  return JSON.stringify({ setting: "value" });
}
```

## MCP Specification Coverage

| Feature | Spec | Status | Implementation |
|---------|------|--------|----------------|
| Tools | [spec][tools] | Full | `src/tools/` |
| Resources | [spec][resources] | Full | `src/resources/` |
| Prompts | [spec][prompts] | Full | `src/prompts/` |
| Sampling | [spec][sampling] | Full | `src/sampling/` |
| Elicitation | [spec][elicitation] | Full | `src/elicitation/` |
| Logging | [spec][logging] | Full | `src/spec/logging.ts` |
| Progress | [spec][progress] | Full | `src/spec/progress.ts` |
| Cancellation | [spec][cancellation] | Full | `src/spec/cancellation.ts` |
| Pagination | [spec][pagination] | Full | `src/spec/pagination.ts` |

[tools]: https://modelcontextprotocol.io/specification/2025-03-26/server/tools
[resources]: https://modelcontextprotocol.io/specification/2025-03-26/server/resources
[prompts]: https://modelcontextprotocol.io/specification/2025-03-26/server/prompts
[sampling]: https://modelcontextprotocol.io/specification/2025-03-26/client/sampling
[elicitation]: https://modelcontextprotocol.io/docs/learn/client-concepts#elicitation
[logging]: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging
[progress]: https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress
[cancellation]: https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/cancellation
[pagination]: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination

## Built-in Tools

| Tool | Description |
|------|-------------|
| `session_init` | Initialize session with project configuration |
| `session_update` | Update session settings |
| `session_status` | Get current session state |
| `session_clear` | Clear session data |
| `server_info` | Get server identity and metadata |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TAGS` | (none) | Comma-separated tags (e.g., `env=dev,team=platform`) |
| `MCP_TOOLKIT_PORT` | `3000` | Port for HTTP mode |

## Build Commands

```bash
pnpm build          # Build package
pnpm dev            # Watch mode
pnpm test           # Run tests
pnpm test:coverage  # With coverage
pnpm typecheck      # Type check
pnpm start          # Run server
pnpm start:stdio    # Run in stdio mode
pnpm start:http     # Run in HTTP mode
```

## Exports

```typescript
// Main entry - server factory and transports
import { createServer, startStdioTransport, startHttpTransport } from "@mcp-toolkit/mcp";

// Server subpath
import { createServer, type ServerContext } from "@mcp-toolkit/mcp/server";

// Hooks subpath
import { mcpHooks } from "@mcp-toolkit/mcp/hooks";
```
