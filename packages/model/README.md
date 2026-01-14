# @mcp-toolkit/model

Zod schemas serving as the single source of truth for MCP Toolkit data structures.

## Features

- **Session Schema**: Project configuration and feature flags
- **Client Metadata**: LLM client capabilities and identification
- **Tool Delegation**: Strategies for routing tool calls between server and host LLM

## Installation

```bash
pnpm add @mcp-toolkit/model
```

## Usage

### Session Configuration

```typescript
import { SessionConfigSchema, type SessionConfig } from "@mcp-toolkit/model";

// Validate session input
const config = SessionConfigSchema.parse({
  projectName: "my-project",
  features: {
    tools: true,
    resources: true,
    prompts: false,
    sampling: false,
  },
});

// Type-safe access
console.log(config.projectName);
console.log(config.features.tools);
```

### Client Metadata

```typescript
import { ClientMetadataSchema, type ClientMetadata } from "@mcp-toolkit/model";

const metadata = ClientMetadataSchema.parse({
  clientName: "claude-desktop",
  clientVersion: "1.0.0",
  model: "claude-opus-4-5-20251101",
  modelProvider: "anthropic",
  capabilities: {
    supportsImages: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    maxContextTokens: 200000,
  },
});
```

### Tool Delegation Configuration

```typescript
import {
  DelegationModeSchema,
  ToolDelegationEntrySchema,
  type DelegationMode,
  type ToolDelegationEntry,
} from "@mcp-toolkit/model";

// Self-reliant: never delegate (default)
const localOnly = DelegationModeSchema.parse("local-only");

// Try delegation, fallback to local
const delegateFirst = ToolDelegationEntrySchema.parse({
  mode: "delegate-first",
  fallbackEnabled: true,
  delegationTimeout: 30000,
});

// Must delegate, error if unavailable
const delegateOnly = DelegationModeSchema.parse("delegate-only");
```

## Schemas

### SessionConfigSchema

```typescript
{
  projectName: string;          // kebab-case project identifier
  features: {
    tools: boolean;             // Enable MCP tools
    resources: boolean;         // Enable MCP resources
    prompts: boolean;           // Enable MCP prompts
    sampling: boolean;          // Enable MCP sampling
  };
  clientMetadata?: ClientMetadata;
}
```

### ClientMetadataSchema

```typescript
{
  clientName: string;           // e.g., "claude-desktop", "cursor"
  clientVersion?: string;       // e.g., "1.0.0"
  model?: string;               // e.g., "claude-opus-4-5-20251101"
  modelProvider?: string;       // e.g., "anthropic", "openai"
  capabilities?: {
    supportsImages?: boolean;
    supportsStreaming?: boolean;
    supportsFunctionCalling?: boolean;
    maxContextTokens?: number;
  };
}
```

### DelegationModeSchema

```typescript
"local-only" | "delegate-first" | "delegate-only"
```

### ToolDelegationEntrySchema

```typescript
{
  mode: DelegationMode;           // Delegation mode
  delegationTimeout?: number;     // Timeout in ms (default: 30000)
  fallbackEnabled?: boolean;      // Fallback to local on failure (default: true)
}
```

## Build Commands

```bash
pnpm build          # Build package
pnpm dev            # Watch mode
pnpm test           # Run tests
pnpm test:coverage  # With coverage
pnpm typecheck      # Type check
```

## Exports

```typescript
// Main entry - all schemas and types
import {
  SessionConfigSchema,
  ClientMetadataSchema,
  ToolDelegationStrategySchema,
  type SessionConfig,
  type ClientMetadata,
  type ToolDelegationStrategy,
} from "@mcp-toolkit/model";

// Schema subpath
import { SessionConfigSchema } from "@mcp-toolkit/model/schema";
```
