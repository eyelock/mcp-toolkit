# Getting Started

This guide walks you through setting up MCP Toolkit and building your first MCP server.

## Prerequisites

- **Node.js 20+**: [Download](https://nodejs.org/)
- **pnpm**: Enable via `corepack enable` (uses version from package.json)

## Installation Options

### Option 1: Clone and Customize (Recommended)

```bash
# Clone the repository
git clone https://github.com/eyelock/mcp-toolkit.git my-mcp-server
cd my-mcp-server

# Remove git history
rm -rf .git

# Run interactive setup wizard
./bin/setup.sh
```

The setup wizard prompts for:

| Prompt | Example | Used For |
|--------|---------|----------|
| Project name | `my-api-server` | Package names, binary names |
| Package scope | `@myorg` | NPM scope for packages |
| Description | `My awesome MCP server` | package.json description |
| Author | `Your Name` | package.json author |

### Option 2: Using degit (No Git History)

```bash
npx degit eyelock/mcp-toolkit my-mcp-server
cd my-mcp-server
./bin/setup.sh
```

## Build and Verify

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint and format
pnpm check
```

## Running the MCP Server

### With MCP Inspector (Development)

```bash
make mcp
# Opens browser with MCP Inspector UI
```

### stdio Mode (Claude Desktop)

```bash
make mcp.stdio
# Or: node ./packages/mcp/dist/index.js
```

### HTTP/SSE Mode (Web Integration)

```bash
make mcp.http
# Server runs on http://localhost:3000
```

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

## Claude Code Integration

MCP Toolkit includes a `.mcp.json` configuration. Just build and launch:

```bash
pnpm build
claude
# Use /mcp to approve 'mcp-toolkit-stdio'
```

## Next Steps

- [MCP Reference](mcp-reference.md) - Understand the MCP spec implementation
- [Hooks System](hooks.md) - Add contextual LLM guidance
- [Tool Delegation](tool-delegation.md) - Advanced host LLM patterns

## Customization Guide

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

### 2. Add MCP Tools

Create `packages/mcp/src/tools/my-tool.ts`:

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const inputSchema = z.object({
  param: z.string().describe("Parameter description"),
});

export const myTool: Tool = {
  name: "my_tool",
  description: "What this tool does",
  inputSchema: zodToJsonSchema(inputSchema) as Tool["inputSchema"],
};

export async function handleMyTool(args: unknown): Promise<CallToolResult> {
  const { param } = inputSchema.parse(args);
  return {
    content: [{ type: "text", text: `Result: ${param}` }]
  };
}
```

Then register in `packages/mcp/src/tools/index.ts`.

### 3. Add Resources

Create `packages/mcp/src/resources/my-resource.ts`:

```typescript
import type { Resource } from "@modelcontextprotocol/sdk/types.js";

export const myResource: Resource = {
  uri: "my-server://data/item",
  name: "My Data Item",
  description: "Description of this resource",
  mimeType: "application/json",
};

export async function readMyResource(): Promise<string> {
  return JSON.stringify({ data: "your data here" });
}
```

### 4. Add Prompts

Create `packages/mcp/src/prompts/my-prompt.ts`:

```typescript
import type { Prompt, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export const myPrompt: Prompt = {
  name: "my_prompt",
  description: "A helpful prompt template",
  arguments: [
    { name: "context", description: "Context for the prompt", required: true }
  ],
};

export async function getMyPrompt(args: Record<string, string>): Promise<GetPromptResult> {
  return {
    messages: [
      {
        role: "user",
        content: { type: "text", text: `Help me with: ${args.context}` }
      }
    ]
  };
}
```

## Troubleshooting

### Build Errors

```bash
# Clean rebuild
pnpm clean && pnpm install && pnpm build
```

### Type Errors

```bash
# Check types across all packages
pnpm typecheck
```

### Test Failures

```bash
# Run tests with verbose output
pnpm test -- --reporter=verbose
```
