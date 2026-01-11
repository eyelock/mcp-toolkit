# MCP Toolkit Reference

A concise reference mapping the [Model Context Protocol Specification](https://modelcontextprotocol.io/specification) to MCP Toolkit's implementation.

**Philosophy**: MCP Toolkit is a self-documenting reference implementation. Each feature includes working examples you can read, run, and extend.

---

## Quick Links

| Feature | Spec | Implementation | Example |
|---------|------|----------------|---------|
| [Server](#server--capabilities) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle) | `server.ts` | `createServer()` |
| [Tools](#tools) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) | `tools/` | `session-init.ts` |
| [Resources](#resources) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/server/resources) | `resources/` | `session.ts`, `templates.ts` |
| [Prompts](#prompts) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts) | `prompts/` | `welcome.ts` |
| [Sampling](#sampling) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling) | `sampling/`, `strategy/` | `client-discovery.ts` |
| [Elicitation](#elicitation) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation) | `elicitation/` | `helpers.ts` |
| [Transport](#transport) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) | `transport/` | `stdio.ts`, `http.ts` |
| [Pagination](#pagination) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination) | `pagination.ts` | cursor utilities |
| [Logging](#logging) | [spec](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging) | `logging.ts` | RFC 5424 levels |

---

## Server & Capabilities

**Spec**: [Lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
**Implementation**: `packages/mcp/src/server.ts`

The server declares capabilities during initialization. MCP Toolkit enables tools, resources, and prompts by default.

```typescript
import { createServer } from "@mcp-toolkit/mcp";

const server = createServer({
  name: "my-server",
  version: "1.0.0",
  identity: {
    canonicalName: "my-server",
    tags: { environment: "production" },
  },
});
```

**Key patterns:**
- `ServerContext` passed to all handlers (provider, identity, server instance)
- `defaultToolStrategies` configures delegation behavior per-tool
- Capabilities negotiated at connection time

**Read the code**: `server.ts:33-92`

---

## Tools

**Spec**: [Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
**Implementation**: `packages/mcp/src/tools/`

Tools are callable functions exposed to the LLM. MCP Toolkit uses Zod schemas as the single source of truth.

### Registration Pattern

```typescript
// tools/index.ts - Central registry
const tools: Tool[] = [sessionInitTool, serverInfoTool];
const handlers: Record<string, Handler> = {
  session_init: handleSessionInit,
  server_info: handleServerInfo,
};

export function registerTools(): Tool[] {
  return tools;
}

export async function handleToolCall(name, args, context): Promise<CallToolResult> {
  const handler = handlers[name];
  return handler ? handler(args, context) : errorResult(`Unknown tool: ${name}`);
}
```

### Tool Definition Pattern

```typescript
// tools/session-init.ts
import { zodToJsonSchema } from "zod-to-json-schema";

export const sessionInitTool: Tool = {
  name: "session_init",
  description: "Initialize a new session with project configuration",
  inputSchema: zodToJsonSchema(SessionInitInputSchema) as Tool["inputSchema"],
};

export async function handleSessionInit(
  args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  // 1. Validate input with Zod
  const parseResult = SessionInitInputSchema.safeParse(args);
  if (!parseResult.success) {
    return { content: [{ type: "text", text: `Invalid input: ${parseResult.error.message}` }], isError: true };
  }

  // 2. Execute logic
  const result = await context.provider.initSession(parseResult.data);

  // 3. Return result
  return {
    content: [{ type: "text", text: `Session initialized: ${result.data?.projectName}` }],
  };
}
```

**Examples to read**:
- `tools/session-init.ts` - Full tool with Zod validation, delegation pattern
- `tools/server-info.ts` - Simple tool returning server metadata

---

## Resources

**Spec**: [Resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
**Implementation**: `packages/mcp/src/resources/`

Resources expose data to the LLM. MCP Toolkit supports both static resources and URI templates (RFC 6570).

### Static Resources

```typescript
// resources/session.ts
export const SESSION_RESOURCE_URI = "session://current";

export const sessionResource: Resource = {
  uri: SESSION_RESOURCE_URI,
  name: "Current Session",
  description: "Current session configuration",
  mimeType: "application/json",
};

export async function readSessionResource(context: ServerContext): Promise<ReadResourceResult> {
  const session = await context.provider.getSession();
  return {
    contents: [{
      uri: SESSION_RESOURCE_URI,
      mimeType: "application/json",
      text: JSON.stringify(session.data, null, 2),
    }],
  };
}
```

### Resource Templates (RFC 6570)

```typescript
// resources/templates.ts
export const LOG_ENTRIES_TEMPLATE: ResourceTemplate = {
  uriTemplate: "log:///{date}",
  name: "Log Entries",
  description: "Server activity logs for a specific date (YYYY-MM-DD format)",
  mimeType: "application/json",
};

// Extract parameters from URI
const params = extractTemplateParams("log:///{date}", "log:///2024-01-15");
// { date: "2024-01-15" }
```

**Examples to read**:
- `resources/session.ts` - Static resource
- `resources/templates.ts` - URI templates with parameter extraction

---

## Prompts

**Spec**: [Prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)
**Implementation**: `packages/mcp/src/prompts/`

Prompts are reusable message templates. They can include arguments for customization.

```typescript
// prompts/welcome.ts
export const welcomePrompt: Prompt = {
  name: "welcome",
  description: "Get a welcome message with session context",
  arguments: [
    {
      name: "include_examples",
      description: "Include example commands",
      required: false,
    },
  ],
};

export async function getWelcomePrompt(
  args: Record<string, string> | undefined,
  context: ServerContext
): Promise<GetPromptResult> {
  const includeExamples = args?.include_examples === "true";
  const session = await context.provider.getSession();

  return {
    messages: [{
      role: "user",
      content: { type: "text", text: buildWelcomeMessage(session, includeExamples) },
    }],
  };
}
```

**Examples to read**:
- `prompts/welcome.ts` - Context-aware prompt with arguments

---

## Sampling

**Spec**: [Sampling](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling)
**Implementation**: `packages/mcp/src/sampling/`, `packages/mcp/src/strategy/`

Sampling lets the server request LLM completions from the client. MCP Toolkit provides request builders and a delegation pattern.

### Request Builders

```typescript
// sampling/index.ts
export function createSessionSummaryRequest(
  entries: SessionEntry[],
  format: "standup" | "handoff" | "weekly"
): CreateMessageRequest["params"] {
  return {
    messages: [
      {
        role: "assistant",  // Provide context
        content: { type: "text", text: `Session activity:\n${formatEntries(entries)}` },
      },
      {
        role: "user",  // Ask for action
        content: { type: "text", text: getFormatInstructions(format) },
      },
    ],
    maxTokens: 500,
  };
}
```

### Tool Delegation Pattern

For tools that should optionally delegate to the host LLM, use `executeWithDelegation`:

```typescript
// strategy/index.ts
import { executeWithDelegation, resolveToolDelegation } from "@mcp-toolkit/mcp/strategy";

const delegation = resolveToolDelegation("my_tool:subtask", context.defaultToolDelegations);

const result = await executeWithDelegation(
  context.server,
  args,
  // Delegation function - let the LLM handle it
  async (server, args) => {
    const response = await server.createMessage({ messages: [...], maxTokens: 500 });
    return extractTextFromSamplingResponse(response);
  },
  // Local function - handle it ourselves
  async (args) => {
    return localImplementation(args);
  },
  {
    mode: delegation.mode,  // "local-only" | "delegate-first" | "delegate-only"
    toolName: "my_tool:subtask",
    fallbackEnabled: delegation.fallbackEnabled,
  }
);
```

**Examples to read**:
- `sampling/index.ts` - Request builders with role patterns
- `strategy/client-discovery.ts` - Real delegation example
- `tools/session-init.ts:105-140` - Delegation in action

**Related docs**: [tool-delegation.md](./tool-delegation.md), [privacy.md](./privacy.md)

---

## Elicitation

**Spec**: [Elicitation](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation)
**Implementation**: `packages/mcp/src/elicitation/`

Elicitation requests structured input from users through the client.

### Helper Functions

```typescript
import {
  elicitText,
  elicitConfirmation,
  elicitChoice,
  elicitInput,
} from "@mcp-toolkit/mcp/elicitation";

// Simple text input
const name = await elicitText(server, "What is your name?");

// Confirmation dialog
const { confirmed } = await elicitConfirmation(server, "Delete this item?");

// Choice from options
const priority = await elicitChoice(server, "Select priority:", [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]);

// Custom form with JSON Schema
const result = await elicitInput<TaskInput>(server, "Create task:", {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1 },
    priority: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["title"],
});
```

### Capability Check

```typescript
import { clientSupportsElicitation } from "@mcp-toolkit/mcp/elicitation";

if (clientSupportsElicitation(server)) {
  // Safe to use elicitation
}
```

**Examples to read**:
- `elicitation/helpers.ts` - All helper functions
- `elicitation/index.ts` - Example schemas

---

## Transport

**Spec**: [Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
**Implementation**: `packages/mcp/src/transport/`

MCP Toolkit supports stdio (local) and HTTP/SSE (remote) transports.

### Stdio Transport

```typescript
import { createStdioTransport } from "@mcp-toolkit/mcp/transport";

const transport = createStdioTransport();
await server.connect(transport);
```

### HTTP Transport

```typescript
import { createHttpTransport } from "@mcp-toolkit/mcp/transport";

const transport = createHttpTransport({
  port: 3000,
  host: "localhost",
  authToken: process.env.AUTH_TOKEN,
});
await server.connect(transport);
```

### CLI Argument Parsing

```typescript
import { parseTransportArgs } from "@mcp-toolkit/mcp/transport";

const options = parseTransportArgs(process.argv);
// { mode: "stdio" } or { mode: "http", httpConfig: { port: 3000 } }
```

**Examples to read**:
- `transport/stdio.ts` - Stdio implementation
- `transport/http.ts` - HTTP/SSE implementation

---

## Pagination

**Spec**: [Pagination](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination)
**Implementation**: `packages/mcp/src/pagination.ts`

Cursor-based pagination for large result sets.

```typescript
import {
  paginateResults,
  createPaginatedResponse,
  DEFAULT_PAGE_SIZE,
} from "@mcp-toolkit/mcp/pagination";

// First page
const page1 = paginateResults(allItems);
// { items: [...], nextCursor: "eyJvZmZzZXQiOjEwMH0=" }

// Next page using cursor
const page2 = paginateResults(allItems, page1.nextCursor);

// Custom page size
const smallPage = paginateResults(allItems, undefined, { pageSize: 10 });

// In resource responses
return {
  contents: [{ uri, mimeType: "application/json", text: JSON.stringify(page.items) }],
  ...createPaginatedResponse(page.nextCursor),
};
```

**Key points**:
- Cursors are opaque base64-encoded tokens
- Clients MUST NOT parse cursor internals
- Missing `nextCursor` signals end of results

---

## Logging

**Spec**: [Logging](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging)
**Implementation**: `packages/mcp/src/logging.ts`

RFC 5424 compliant structured logging with multiple transports.

### Log Levels

```typescript
type LogLevel =
  | "debug"     // Detailed debugging
  | "info"      // General information
  | "notice"    // Normal but significant
  | "warning"   // Warning conditions
  | "error"     // Error conditions
  | "critical"  // Critical conditions
  | "alert"     // Action must be taken
  | "emergency" // System unusable
```

### Usage

```typescript
import { logDebug, logInfo, logWarning, logError } from "@mcp-toolkit/mcp/logging";

logDebug("Processing request", { metadata: { requestId: "abc-123" } });
logInfo("Session initialized", { metadata: { projectName: "my-project" } });
logWarning("Delegation failed, using fallback", { metadata: { error: "timeout" } });
logError("Failed to read resource", { error: { message: "Not found", name: "NotFoundError" } });
```

### Transports

- **StderrTransport**: Always available, writes JSON to stderr
- **McpTransport**: Sends to client via MCP protocol (when connected)

```typescript
import { initializeLogging, addTransport, StderrTransport } from "@mcp-toolkit/mcp/logging";

initializeLogging({ minLevel: "info" });
addTransport(new StderrTransport({ minLevel: "debug" }));
```

---

## Model Package

**Implementation**: `packages/model/src/`

Zod schemas serve as the single source of truth for all types.

### Core Schemas

| Schema | Purpose | File |
|--------|---------|------|
| `SessionConfigSchema` | Session state | `schema.ts` |
| `SessionFeaturesSchema` | Feature flags | `schema.ts` |
| `ServerIdentitySchema` | Server metadata | `schema.ts` |
| `DelegationModeSchema` | Delegation config | `strategy.ts` |
| `ClientMetadataSchema` | Client info | `strategy.ts` |

### Pattern: Schema → Type → JSON Schema

```typescript
// 1. Define Zod schema (single source of truth)
export const SessionInitInputSchema = z.object({
  projectName: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  features: SessionFeaturesSchema.partial().optional(),
});

// 2. Export TypeScript type
export type SessionInitInput = z.infer<typeof SessionInitInputSchema>;

// 3. Convert to JSON Schema for MCP tools
import { zodToJsonSchema } from "zod-to-json-schema";
const jsonSchema = zodToJsonSchema(SessionInitInputSchema);
```

---

## Provider Package

**Implementation**: `packages/storage/src/`

Session persistence abstraction.

```typescript
import { createMemoryProvider } from "@mcp-toolkit/storage";

const provider = createMemoryProvider();

// Session lifecycle
await provider.initSession({ projectName: "my-project", features: { tools: true } });
await provider.hasSession();  // true
await provider.getSession();  // { data: SessionConfig, ... }
await provider.updateSession({ projectName: "renamed" });
await provider.clearSession();
```

**Implement custom providers** for persistent storage (file, database, etc.).

---

## CLI Package

**Implementation**: `packages/cli/src/`

Command-line interface mirroring MCP tools.

```bash
# Initialize session
mcp-toolkit init my-project --tools --resources

# With all features
mcp-toolkit init my-project --all-features
```

**Examples to read**:
- `cli/src/commands/init.ts` - CLI/MCP parity pattern

---

## File Structure

```
packages/
├── model/src/           # Zod schemas (single source of truth)
│   ├── schema.ts        # Core session/identity schemas
│   ├── strategy.ts      # Delegation mode schemas
│   └── index.ts         # Exports
├── provider/src/        # Session persistence
│   └── memory.ts        # In-memory provider
├── mcp/src/             # MCP server implementation
│   ├── server.ts        # Server setup & context
│   ├── tools/           # Tool definitions & handlers
│   ├── resources/       # Resource definitions & readers
│   ├── prompts/         # Prompt definitions & generators
│   ├── sampling/        # Sampling request builders
│   ├── strategy/        # Delegation pattern
│   ├── elicitation/     # User input helpers
│   ├── transport/       # Stdio & HTTP transports
│   ├── pagination.ts    # Cursor-based pagination
│   └── logging.ts       # Structured logging
└── cli/src/             # Command-line interface
    └── commands/        # CLI commands
```

---

## Further Reading

- [Tool Delegation](./tool-delegation.md) - Delegation pattern deep dive
- [Privacy](./privacy.md) - Data collection and privacy controls
- [MCP Specification](https://modelcontextprotocol.io/specification) - Official protocol spec
