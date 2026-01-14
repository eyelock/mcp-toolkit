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
import { HookRegistry, HookLoader, HookComposer } from "@mcp-toolkit/core";

// Create a registry
const registry = new HookRegistry();

// Register hooks
registry.register({
  id: "my-hook",
  name: "My Hook",
  type: "session",
  lifecycle: "start",
  description: "Provides guidance at session start",
  contentPath: "./hooks/my-hook.md",
});

// Load hook content
const loader = new HookLoader();
const resolvedHooks = await loader.resolve(registry.getAll());

// Compose hooks for a specific context
const composer = new HookComposer();
const composed = composer.compose(resolvedHooks, {
  type: "session",
  lifecycle: "start",
});
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
  id: string;           // Unique identifier
  name: string;         // Display name
  type: HookType;       // config | session | action
  lifecycle: HookLifecycle;  // start | running | end
  description: string;  // What this hook does
  contentPath: string;  // Path to markdown content
  blocking?: boolean;   // Block until complete
  requirementLevel?: "MUST" | "SHOULD" | "MAY";
  dependencies?: string[];  // Hook IDs that must complete first
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
// Main entry
import { HookRegistry, HookLoader, HookComposer } from "@mcp-toolkit/core";

// Hooks subpath
import { HookRegistry } from "@mcp-toolkit/core/hooks";

// Storage subpath
import { MemoryProvider, type SessionProvider } from "@mcp-toolkit/core/storage";
```
