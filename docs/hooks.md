# Hooks System

MCP Toolkit includes a composable hook system that allows different parts of your application to contribute contextual guidance to the Host LLM at the right time. Hooks provide directive prompts that guide the LLM's next action—whether that's making a sampling request, executing a tool, or following a workflow.

## MCP Spec Alignment

The hooks system helps you implement several parts of the [MCP Specification](https://modelcontextprotocol.io/specification):

| MCP Feature | How Hooks Help | Spec Version | Spec Link |
|-------------|----------------|--------------|-----------|
| **Prompts** | Hooks compose into `role=assistant` prompts that guide the LLM | 2025-06-18 | [Prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts) |
| **Tools** | Hooks are registered and triggered via dedicated tools | 2025-06-18 | [Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) |
| **Sampling** | Action hooks can direct the LLM to make sampling requests | 2025-06-18 | [Sampling](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling) |
| **Progress** | `lifecycle: "progress"` hooks fire during long-running operations | 2025-06-18 | [Progress](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress) |
| **Cancellation** | `lifecycle: "cancel"` hooks provide cleanup guidance when requests are cancelled | 2025-06-18 | [Cancellation](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation) |
| **Completion** | Composed hooks can suggest probable next actions as completion hints | 2025-06-18 | [Completion](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/completion) |
| **Logging** | Hook failures and transparency notices sent via MCP logging | 2025-06-18 | [Logging](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging) |

---

## Mental Model

Hooks are **directive `role=assistant` prompts** that get composed and sent to the Host LLM based on what's happening:

```
┌──────────────────────────────────────────────────────────────────-────┐
│                         Hook System                                   │
├─────────────────────────────────────────────────────────────────-─────┤
│                                                                       │
│   Type: What the hook is about                                        │
│     • session - Session lifecycle                                     │
│     • action - Tool/operation execution                               │
│     • storage - Storage backend specific                              │
│     • config - Configuration guidance                                 │
│                                                                       │
│   Lifecycle: When in the process it fires                             │
│     • start - Beginning of process                                    │
│     • running - During execution (tied to requestId)                  │
│     • progress - Progress updates (MCP progress)                      │
│     • cancel - Cancellation requested (MCP cancellation)              │
│     • end - Process complete                                          │
│                                                                       │
│   Each hook:                                                          │
│     • Has a computed ID from app:type:lifecycle:tag                   │
│     • Has a requirementLevel (MUST, SHOULD, MAY)                      │
│     • Has a priority (ordering within requirement level)              │
│     • May have conditions (storage, features, config)                 │
│     • Resolves to markdown content (from adjacent .md file)           │
│                                                                       │
└────────────────────────────────────────────────────────────-──────────┘
```

## Core Components

The hooks system lives in `@mcp-toolkit/core` and consists of four components:

| Component | Purpose | File |
|-----------|---------|------|
| **Types** | Zod schemas for hook definitions | `hooks/types.ts` |
| **Registry** | Stores and queries hook definitions | `hooks/registry.ts` |
| **Loader** | Resolves markdown content from files | `hooks/loader.ts` |
| **Composer** | Combines hooks by requirement level | `hooks/composer.ts` |

---

## Hook Definition Schema

```typescript
interface HookDefinition {
  // Identity (computed: `${app}:${type}:${lifecycle}:${tag}`)
  app?: string;              // App prefix, e.g., "mcp-toolkit" (can be centralized)
  tag: string;               // Required. Machine-friendly ID, filesystem-safe (e.g., "welcome")
  type: HookType;            // "session" | "action" | "storage" | "config"
  lifecycle: HookLifecycle;  // "start" | "running" | "progress" | "cancel" | "end"

  // Metadata
  name: string;              // Human-readable name
  description?: string;      // What this hook provides

  // Requirement Level (RFC 2119)
  requirementLevel: RequirementLevel;  // "MUST" | "MUST NOT" | "SHOULD" | "SHOULD NOT" | "MAY"

  // Ordering
  priority?: number;         // Order within requirement level (default: 50, higher = more important)

  // Content
  contentFile?: string;      // Optional explicit path. Default: adjacent .md with same name as tag

  // Conditions (all arrays to support multiple)
  conditions?: {
    requiresStorage?: string[];     // Only if one of these storage backends is active
    requiresFeatures?: McpFeature[]; // Only if these MCP features are available
    requiresConfig?: Record<string, unknown>; // Only if config matches
  };

  // Request context (for running/progress/cancel lifecycle)
  requestId?: string;        // MCP request ID this hook is tied to
}

// Computed property
get id(): string {
  return `${this.app}:${this.type}:${this.lifecycle}:${this.tag}`;
}
```

### Types

| Type | Purpose | Example |
|------|---------|---------|
| `session` | Session lifecycle events | Welcome message, session summary |
| `action` | Tool/operation execution | Tool-specific guidance, workflow steps |
| `storage` | Storage backend context | Memory provider tips, file provider setup |
| `config` | Configuration guidance | Setup flows, settings changes |

### Lifecycle Phases

| Phase | When | MCP Alignment |
|-------|------|---------------|
| `start` | Process begins | - |
| `running` | During execution | Tied to `requestId` |
| `progress` | Progress update | [MCP Progress](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress) |
| `cancel` | Cancellation requested | [MCP Cancellation](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation) |
| `end` | Process complete | - |

### Requirement Levels (RFC 2119)

Based on [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119):

| Level | Meaning |
|-------|---------|
| `MUST` | Absolute requirement. The LLM must follow this. |
| `MUST NOT` | Absolute prohibition. The LLM must not do this. |
| `SHOULD` | Recommended. May be ignored with good reason. |
| `SHOULD NOT` | Not recommended. May be done with good reason. |
| `MAY` | Optional. Entirely up to the LLM. |

### MCP Features

```typescript
type McpFeature =
  | "tools"
  | "resources"
  | "prompts"
  | "sampling"
  | "elicitation";
```

---

## Content Resolution

Hooks resolve their content from adjacent markdown files. If no `contentFile` is specified, the loader looks for a `.md` file matching the hook's `tag`:

```
hooks/
├── welcome.ts           # Hook definition with tag: "welcome"
├── welcome.md           # Content (auto-resolved)
└── index.ts
```

### welcome.ts
```typescript
export const welcomeHook: HookDefinitionInput = {
  tag: "welcome",
  type: "session",
  lifecycle: "start",
  name: "Welcome Message",
  requirementLevel: "SHOULD",
  // contentFile omitted → resolves to welcome.md
};
```

### welcome.md
```markdown
Welcome to the session. You have access to:

- **Tools**: Execute server operations
- **Resources**: Access server data
- **Prompts**: Get contextual assistance

Start by reviewing the available tools with `server_info`.
```

### Failure Handling

If content cannot be loaded (file missing, read error), the loader:
1. Logs an error via [MCP Logging](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging) at `error` level
2. Continues without the hook (graceful degradation)
3. Includes the failure in composer transparency (see below)

---

## Full Workflow Example

```typescript
import {
  createHookRegistry,
  createContentLoader,
  createComposer,
} from "@mcp-toolkit/core/hooks";

// 1. Create registry with app prefix
const registry = createHookRegistry({ app: "my-server" });

// 2. Register hooks
registry.register({
  tag: "welcome",
  type: "session",
  lifecycle: "start",
  name: "Welcome",
  requirementLevel: "SHOULD",
  priority: 50,
});

registry.register({
  tag: "init-required",
  type: "session",
  lifecycle: "start",
  name: "Initialization Required",
  requirementLevel: "MUST",
  priority: 100,
});

registry.register({
  tag: "tips",
  type: "session",
  lifecycle: "start",
  name: "Optional Tips",
  requirementLevel: "MAY",
  priority: 30,
});

// 3. Query hooks for session start
const hooks = registry.query({
  type: "session",
  lifecycle: "start",
});

// 4. Load content for each hook
const loader = createContentLoader();
const resolved = await loader.loadAll(hooks);

// 5. Compose into output grouped by requirement level
const composer = createComposer();
const result = composer.compose(resolved);

console.log(result.content);
```

### Composed Output

```markdown
> The following sections use requirement levels defined in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## MUST

These are absolute requirements. You must follow these instructions.

### Initialization Required

You must call `session_init` before using any other tools. This is mandatory.

---

## SHOULD

These are recommended actions. Follow unless you have good reason not to.

### Welcome

Welcome to the session. You have access to tools, resources, and prompts.
Start by reviewing the available tools with `server_info`.

---

## MAY

These are optional. Use your judgment.

### Optional Tips

Consider enabling debug mode for verbose logging during development.
```

---

## Composer Behavior

### Grouping by Requirement Level

The composer groups hooks by `requirementLevel` in this order:
1. `MUST` / `MUST NOT`
2. `SHOULD` / `SHOULD NOT`
3. `MAY`

Within each group, hooks are ordered by `priority` (higher = first).

### Transparency (Notices)

If hooks are filtered, limited, or fail to load, the composer sends a `notice` via MCP Logging:

```typescript
interface ComposedHooksResult {
  content: string;              // The composed markdown
  includedHooks: HookSummary[]; // Hooks that were included
  skippedHooks: HookSummary[];  // Hooks that were skipped (conditions not met)
  failedHooks: HookSummary[];   // Hooks that failed to load
  notices: string[];            // Notices sent to LLM about what was omitted
}
```

Example notice:
> "3 hooks were skipped (conditions not met): memory-tips (requires storage: memory), sampling-guide (requires features: sampling). Call with different context to include them."

---

## Session State & Blocking

Hooks provide guidance, but **enforcement** comes from a session state machine (see ACME's `session-state.ts` pattern).

### State Machine

```typescript
type SessionState =
  | "uninitialized"  // No init tool called
  | "initialized"    // Init called, ready for reporting
  | "ready"          // Reporting checked, ready for work
  | "working";       // Normal operation
```

### Enforcement Flow

1. **Before tool executes**: `checkToolAllowed(toolName, requestId)`
   - Returns `null` → proceed
   - Returns error message → block with directive guidance

2. **After tool executes**: `recordToolCall(toolName, input, requestId)`
   - Updates state
   - Returns guidance for next action

### Example Blocking Response

```typescript
// If LLM tries to call a tool before session_init:
{
  isError: true,
  content: [{
    type: "text",
    text: 'Tool "my_tool" requires session initialization. You MUST call session_init first before using any other tools. This is a MANDATORY first action.'
  }]
}
```

The LLM receives a clear directive on what to do, calls `session_init`, and proceeds.

---

## Request Context

For `running`, `progress`, and `cancel` lifecycle phases, hooks are tied to specific MCP requests via `requestId` and `sessionId`:

```typescript
// Query hooks for a specific request
const hooks = registry.query({
  type: "action",
  lifecycle: "running",
  requestId: "abc-123",
});
```

This enables:
- Progress hooks that update as an operation proceeds
- Cancellation hooks that provide cleanup guidance
- Request-specific context injection

See:
- [MCP Cancellation](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation)
- [MCP Progress](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress)

---

## Registry API

```typescript
const registry = createHookRegistry({ app: "my-server" });

// Register
registry.register(hookDefinition);
registry.registerAll([hook1, hook2]);

// Query
registry.query({ type, lifecycle, storage, features, config });

// Manage
registry.get(id);        // Get by computed ID
registry.has(id);        // Check existence
registry.unregister(id); // Remove
registry.all();          // Get all
registry.size();         // Count
registry.clear();        // Remove all
```

---

## Loader API

```typescript
const loader = createContentLoader();

// Load single hook (finds adjacent .md by tag)
const resolved = await loader.load(hook);

// Load multiple
const allResolved = await loader.loadAll(hooks);

// Inline content (testing)
const resolved = loader.loadInline(hook, "# Test\n\nContent here.");

// Cache management
loader.clearCache();
loader.cacheSize();
```

---

## Composer API

```typescript
const composer = createComposer({
  // Add section preambles explaining requirement levels
  includePreambles: true,

  // Separator between hooks within a section
  separator: "\n\n---\n\n",
});

const result = composer.compose(resolvedHooks);

// Result
result.content;       // Composed markdown
result.includedHooks; // What was included
result.skippedHooks;  // What was skipped (with reasons)
result.failedHooks;   // What failed to load
result.notices;       // Transparency notices
```

---

## Conditions (Deferred)

The `conditions` field allows hooks to be conditionally included:

```typescript
conditions: {
  requiresStorage: ["memory", "file"],  // Include if using memory OR file storage
  requiresFeatures: ["sampling"],       // Include if sampling is available
  requiresConfig: { debug: true },      // Include if debug mode is on
}
```

Detailed usage patterns will be documented when `packages/toolkit` is implemented.

---

## Type Definitions

```typescript
// Types
type HookType = "session" | "action" | "storage" | "config";

type HookLifecycle = "start" | "running" | "progress" | "cancel" | "end";

type RequirementLevel = "MUST" | "MUST NOT" | "SHOULD" | "SHOULD NOT" | "MAY";

type McpFeature = "tools" | "resources" | "prompts" | "sampling" | "elicitation";

// Full definition
interface HookDefinition {
  app?: string;
  tag: string;
  type: HookType;
  lifecycle: HookLifecycle;
  name: string;
  description?: string;
  requirementLevel: RequirementLevel;
  priority?: number;
  contentFile?: string;
  conditions?: {
    requiresStorage?: string[];
    requiresFeatures?: McpFeature[];
    requiresConfig?: Record<string, unknown>;
  };
  requestId?: string;
}

// Computed
interface HookDefinitionWithId extends HookDefinition {
  readonly id: string; // `${app}:${type}:${lifecycle}:${tag}`
}
```

---

## Related Documentation

- [Tool Delegation](./tool-delegation.md) - How action hooks connect to delegation
- [MCP Reference](./mcp-reference.md) - Full MCP implementation reference
- [MCP Cancellation Spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation)
- [MCP Progress Spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) - Requirement level definitions
