# @mcp-toolkit/toolkit

Guided onboarding workflow demonstrating MCP Specification features and teaching developers how to customize their MCP Toolkit instance.

> **Self-Contained**: This package can be deleted without breaking MCP Toolkit. It exists purely as a showcase and learning tool.

## Architecture

```text
┌───────────────────────────────────────────────────────────────────────-──┐
│                          TOOLKIT WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────-────┤
│                                                                          │
│  1. CONFIG (blocking)          2. MODEL                3. PLANNING       │
│  ┌─────────────────┐           ┌─────────────────┐    ┌─────────────────┐│
│  │ toolkit:config  │──BLOCKS──▶│ toolkit:model   │───▶│ toolkit:plan    ││
│  │                 │           │                 │    │                 ││
│  │ • Project name  │           │ • Core entities │    │ • Impl steps    ││
│  │ • Purpose       │           │ • Relationships │    │ • Approval      ││
│  │ • Domain        │           │ • Schemas       │    │ • Dependencies  ││
│  │ (via elicit)    │           │                 │    │                 ││
│  └─────────────────┘           └─────────────────┘    └─────────────────┘│
│         │                              │                      │          │
│         ▼                              ▼                      ▼          │
│  Shows: blocking,              Shows: resources,      Shows: plan hooks, │
│  elicitation,                  JSON schemas,          approval workflow, │
│  config storage                templates               dependencies      │
└─────────────────────────────────────────────────────────────────────-────┘
```

## Hook Lifecycle Flow

```text
   Session Start                    During Session                   Session End
        │                                 │                               │
        ▼                                 ▼                               ▼
┌───────────────┐              ┌───────────────────┐            ┌───────────────┐
│ config hooks  │              │   action hooks    │            │   end hooks   │
│ (BLOCKING)    │              │                   │            │               │
├───────────────┤              ├───────────────────┤            ├───────────────┤
│ • Gather      │              │ • Model guidance  │            │ • Summary     │
│   project     │    ──────►   │ • Plan triggers   │   ──────►  │ • Checkpoint  │
│   config      │              │ • Build guidance  │            │ • Next steps  │
│ • Store       │              │ • Approval flow   │            │               │
└───────────────┘              └───────────────────┘            └───────────────┘
        │
        │ BLOCKS until complete
        ▼
   All other tools blocked
   until config gathered
```

## Build Commands

```bash
pnpm build          # Build package
pnpm dev            # Watch mode
pnpm test           # Unit tests
pnpm test:coverage  # With coverage
pnpm typecheck      # Type check
pnpm lint           # Lint
pnpm format         # Format
```

## Exports

```typescript
// Hook definitions (for registration)
import { allToolkitHooks } from "@mcp-toolkit/toolkit";
import {
  configHooks,
  modelHooks,
  planHooks,
  buildHooks,
} from "@mcp-toolkit/toolkit";

// Resolved hooks with content (for composition)
import { resolveToolkitHooks } from "@mcp-toolkit/toolkit";

// Registry utilities
import { registerToolkitHooks, createToolkitRegistry } from "@mcp-toolkit/toolkit";
```

## Workflow Phases

| Phase | Hook Type | Lifecycle | Purpose |
|-------|-----------|-----------|---------|
| 1. **Config** | `config` | `start` | Gather project configuration (blocking) |
| 2. **Model** | `session` | `start` | Guide domain model design |
| 3. **Plan** | `action` | `running` | Implementation planning with approval |
| 4. **Build** | `action` | `running` | Tools, resources, prompts guidance |
| 5. **Review** | `session` | `end` | Summary, checkpoint, next steps |

## Workflow Enforcement

The toolkit uses blocking hooks to enforce a guided workflow:

- `toolkit:config` is `blocking: true` with `requirementLevel: "MUST"`
- All other toolkit hooks have `dependencies: ["toolkit:config"]`
- Until config completes, other tools return a blocking response

This teaches developers:

1. How blocking works in the hooks system
2. How elicitation gathers user input interactively
3. How config hooks persist configuration
4. How subsequent hooks can depend on prior completion

## MCP Specification Features Demonstrated

| Feature | Demo | Purpose |
|---------|------|---------|
| **Tools** | Calculator, formatter, analyzer | Schemas, validation, result types |
| **Resources** | Config, templates, dynamic data | URI templates, subscriptions |
| **Prompts** | Code review, debug assistant | Arguments, completion |
| **Sampling** | "Ask Claude" tool | Server-initiated LLM calls |
| **Progress** | Long-running tasks | Progress notifications |
| **Cancellation** | Batch operations | Interruptible processing |
| **Logging** | Structured logs | Log levels |
| **Completion** | Argument auto-complete | Prompts and resources |

## Usage

### Register with MCP Server

```typescript
import { HookRegistry } from "@mcp-toolkit/core";
import { allToolkitHooks } from "@mcp-toolkit/toolkit";

const registry = new HookRegistry();
registry.registerAll(allToolkitHooks);
```

### Resolve with Content

```typescript
import { resolveToolkitHooks } from "@mcp-toolkit/toolkit";

const hooks = await resolveToolkitHooks();
// Returns ResolvedHook[] with markdown content loaded
```

### Create Standalone Registry

```typescript
import { createToolkitRegistry } from "@mcp-toolkit/toolkit";

const registry = createToolkitRegistry();
// Pre-populated with all toolkit hooks
```

## Adding New Hooks

```text
1. Create definition     2. Create content      3. Register
   (my-hook.ts)            (my-hook.md)           (index.ts)
        │                       │                      │
        ▼                       ▼                      ▼
   ┌─────────┐            ┌─────────┐           ┌─────────────┐
   │ export  │            │ # Guide │           │ export      │
   │ myHook: │     +      │         │    ──►    │ hooks = [   │
   │ {...}   │            │ Content │           │   myHook,   │
   └─────────┘            └─────────┘           │   ...       │
                                                └─────────────┘
```

## Removing This Package

This package is entirely optional. To remove:

```bash
rm -rf packages/toolkit
# Remove from pnpm-workspace.yaml if listed
# Remove any imports from packages/mcp/src/server.ts
```

MCP Toolkit will continue to function normally.

## Related Packages

- `@mcp-toolkit/core` - Hook system, registry, loader, composer, storage
- `@mcp-toolkit/mcp` - MCP server implementation
- `@mcp-toolkit/model` - Zod schemas
