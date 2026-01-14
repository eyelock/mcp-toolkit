# @mcp-toolkit/core

Core functionality for MCP Toolkit including the hook system for contextual LLM guidance and storage interfaces.

## Features

- **Hook System**: Registry, loader, and composer for managing lifecycle hooks
- **Storage Interface**: Abstraction for session and configuration persistence
- **Memory Provider**: Default in-memory storage implementation

## Installation

```bash
pnpm add @mcp-toolkit/core
```

## Usage

### Hook System

The hook system provides contextual guidance to LLMs at different lifecycle points.

```typescript
import {
  createHookRegistry,
  createContentLoader,
  composeHooks,
} from "@mcp-toolkit/core";

// Create a registry
const registry = createHookRegistry();

// Register hooks
registry.register({
  tag: "my-hook",
  name: "My Hook",
  type: "session",
  lifecycle: "start",
  requirementLevel: "SHOULD",
});

// Query hooks for a specific context
const hooks = registry.query({ type: "session", lifecycle: "start" });

// Load hook content from markdown files
const loader = createContentLoader({ basePath: "./hooks" });
const { resolved } = await loader.loadAll(hooks);

// Compose hooks into a single output
const result = composeHooks(resolved);
console.log(result.content);
```

### Storage Interface

```typescript
import { MemoryProvider, type SessionProvider } from "@mcp-toolkit/core";

// Use the built-in memory provider
const provider = new MemoryProvider();

// Initialize a session
await provider.initSession({
  projectName: "my-project",
  features: { tools: true, resources: true },
});

// Get session state
const session = await provider.getSession();

// Update session
await provider.updateSession({ projectName: "renamed-project" });

// Clear session
await provider.clearSession();
```

### Custom Storage Provider

```typescript
import type { SessionProvider } from "@mcp-toolkit/core";

export class MyCustomProvider implements SessionProvider {
  async initSession(input) { /* ... */ }
  async getSession() { /* ... */ }
  async updateSession(input) { /* ... */ }
  async clearSession() { /* ... */ }
  async hasSession() { /* ... */ }
}
```

## API Reference

### Hook Types

| Type | Lifecycle | Purpose |
|------|-----------|---------|
| `config` | `start` | Configuration gathering (can be blocking) |
| `session` | `start`, `end` | Session lifecycle guidance |
| `action` | `running` | Action-specific guidance during session |

### Hook Definition

```typescript
interface HookDefinition {
  tag: string;                // Unique identifier tag
  name: string;               // Display name
  type: HookType;             // config | session | action
  lifecycle: HookLifecycle;   // start | running | end
  requirementLevel: RequirementLevel;  // MUST | SHOULD | MAY
  blocking?: boolean;         // Block until complete (default: false)
  mcpFeatures?: McpFeature[]; // Related MCP features
  dependencies?: string[];    // Hook tags that must complete first
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
// Main entry - everything re-exported
import {
  createHookRegistry,
  createContentLoader,
  composeHooks,
  createMemoryProvider,
} from "@mcp-toolkit/core";

// Hooks subpath
import {
  HookRegistry,
  createHookRegistry,
  HookContentLoader,
  createContentLoader,
  HookComposer,
  createComposer,
  composeHooks,
  type HookDefinition,
  type ResolvedHook,
} from "@mcp-toolkit/core/hooks";

// Storage subpath
import {
  MemoryProvider,
  createMemoryProvider,
  type SessionProvider,
} from "@mcp-toolkit/core/storage";
```
