# Tool Delegation

MCP Toolkit supports a delegation pattern where tools can optionally ask the host LLM to perform tasks via MCP sampling. Your local implementation serves as a fallback when delegation isn't available or fails.

## The Mental Model

When you write a tool, think of it as having three possible execution paths:

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Tool                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. "The host LLM can do this better"                       │
│      → Delegate via sampling                                │
│                                                             │
│  2. "I can handle this myself"                              │
│      → Execute locally (your implementation)                │
│                                                             │
│  3. "Neither worked"                                        │
│      → Error / escalate                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Local-first by default**: Tools execute locally unless explicitly configured to delegate. Delegation is opt-in, not opt-out.

## When to Use Delegation

Delegation makes sense when the host LLM genuinely knows something you don't:

| Good Delegation Cases | Why |
|-----------------------|-----|
| "What model are you?" | Only the LLM knows its own identity |
| "Summarize this text" | LLMs excel at natural language |
| "Is this code correct?" | LLMs can reason about code quality |
| "What should I do next?" | Context-aware decision making |

| Poor Delegation Cases | Why |
|-----------------------|-----|
| "Read this file" | You can do this locally |
| "Calculate 2+2" | Deterministic, no LLM needed |
| "Query the database" | You have direct access |

## Quick Start

### Using an Existing Delegating Tool

The `session_init` tool demonstrates delegation for client discovery:

```typescript
// Client metadata will be discovered via sampling if available
await callTool("session_init", {
  projectName: "my-project",
});

// Or provide it directly (no delegation)
await callTool("session_init", {
  projectName: "my-project",
  clientMetadata: {
    clientName: "my-app",
    model: "gpt-4",
  },
});

// Or disable discovery entirely
await callTool("session_init", {
  projectName: "my-project",
  discoverClient: false,
});
```

### Configuring Delegation Behavior

Control delegation at the server level:

```typescript
import { createServer } from "@mcp-toolkit/mcp";

const server = createServer({
  defaultToolDelegations: {
    // Use local-only (never delegate)
    "session_init:client_discovery": {
      mode: "local-only",
    },

    // Or require delegation (error if unavailable)
    "my_tool:summarize": {
      mode: "delegate-only",
    },

    // Or try delegation with fallback (default for client discovery)
    "my_tool:analyze": {
      mode: "delegate-first",
      delegationTimeout: 60000, // 60 seconds
      fallbackEnabled: true,
    },
  },
});
```

## Writing a Delegating Tool

### Step 1: Define Your Tool Name

Use a namespaced format for sub-tasks that can delegate:

```typescript
const TOOL_NAME = "my_tool";
const DELEGATION_TASK = `${TOOL_NAME}:summarize`;
```

### Step 2: Import the Delegation Utilities

```typescript
import {
  executeWithDelegation,
  resolveToolDelegation
} from "@mcp-toolkit/mcp/strategy";
```

### Step 3: Implement Both Paths

```typescript
import type { ServerContext } from "@mcp-toolkit/mcp";

async function handleMyTool(args: unknown, context: ServerContext) {
  const { text } = args as { text: string };

  // Resolve delegation from configuration
  const delegation = resolveToolDelegation(
    DELEGATION_TASK,
    context.defaultToolDelegations
  );

  const result = await executeWithDelegation(
    context.server,
    { text },

    // Delegation function - ask the LLM
    async (server, delegateArgs) => {
      const response = await server.createMessage({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please summarize this text:\n\n${delegateArgs.text}`,
          },
        }],
        maxTokens: 500,
      });
      return extractTextFromSamplingResponse(response);
    },

    // Local function - your fallback implementation
    async (localArgs) => {
      // Simple local summarization (first 100 chars + "...")
      return localArgs.text.length > 100
        ? localArgs.text.slice(0, 100) + "..."
        : localArgs.text;
    },

    {
      mode: delegation.mode,
      toolName: DELEGATION_TASK,
      delegationTimeout: delegation.delegationTimeout,
      fallbackEnabled: delegation.fallbackEnabled,
    }
  );

  return {
    content: [{
      type: "text",
      text: result.result as string,
    }],
  };
}
```

### Step 4: Handle the Result

The `executeWithDelegation` function returns detailed outcome information:

```typescript
interface DelegationResult {
  outcome: "delegated" | "local" | "fallback-local" | "error";
  result: unknown;
  delegationAttempted: boolean;
  delegationError?: string;
  executionTimeMs: number;
}
```

Use this for logging, metrics, or user feedback:

```typescript
const result = await executeWithDelegation(/* ... */);

if (result.outcome === "delegated") {
  console.log("LLM handled this request");
} else if (result.outcome === "fallback-local") {
  console.log("Delegation failed, used local fallback");
  console.log("Delegation error:", result.delegationError);
} else if (result.outcome === "local") {
  console.log("Executed locally (delegation not attempted)");
}
```

## Delegation Mode Reference

### Modes

| Mode | Behavior | Use When |
|------|----------|----------|
| `local-only` | Never delegate, always use local implementation | You don't need LLM help, or privacy is critical |
| `delegate-first` | Try delegation, fall back to local on failure | LLM is better but you have a reasonable fallback |
| `delegate-only` | Must delegate, error if sampling unavailable | Only the LLM can do this, no local fallback makes sense |

### Configuration Options

```typescript
interface ToolDelegationEntry {
  // Which mode to use
  mode: "local-only" | "delegate-first" | "delegate-only";

  // Timeout for delegation attempts (default: 30000ms)
  delegationTimeout?: number;

  // Whether to fall back to local on delegation failure (default: true)
  fallbackEnabled?: boolean;
}
```

### Checking Sampling Availability

Before attempting delegation, you can check if the client supports sampling:

```typescript
import { clientSupportsSampling } from "@mcp-toolkit/mcp/strategy";

if (clientSupportsSampling(context.server)) {
  console.log("Sampling is available");
} else {
  console.log("Client does not support sampling");
}
```

## Complete Example: Code Review Tool

Here's a complete example of a tool that delegates code review to the LLM:

```typescript
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "@mcp-toolkit/mcp";
import {
  executeWithDelegation,
  resolveToolDelegation,
  extractTextFromSamplingResponse,
} from "@mcp-toolkit/mcp/strategy";

const TOOL_NAME = "code_review";
const REVIEW_TASK = `${TOOL_NAME}:analyze`;

export const codeReviewTool: Tool = {
  name: TOOL_NAME,
  description: "Review code for issues and improvements",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "Code to review" },
      language: { type: "string", description: "Programming language" },
    },
    required: ["code"],
  },
};

export async function handleCodeReview(
  args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  const { code, language = "unknown" } = args as {
    code: string;
    language?: string;
  };

  const delegation = resolveToolDelegation(REVIEW_TASK, context.defaultToolDelegations);

  const result = await executeWithDelegation(
    context.server,
    { code, language },

    // Delegation: Ask the LLM to review
    async (server, { code, language }) => {
      const response = await server.createMessage({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Review this ${language} code for bugs, improvements, and best practices:\n\n\`\`\`${language}\n${code}\n\`\`\``,
          },
        }],
        maxTokens: 1000,
      });
      return extractTextFromSamplingResponse(response);
    },

    // Local fallback: Basic static analysis
    async ({ code, language }) => {
      const issues: string[] = [];

      // Simple checks
      if (code.includes("console.log")) {
        issues.push("- Contains console.log statements");
      }
      if (code.includes("TODO")) {
        issues.push("- Contains TODO comments");
      }
      if (code.length > 500 && !code.includes("function")) {
        issues.push("- Long code without function decomposition");
      }

      return issues.length > 0
        ? `Local analysis found:\n${issues.join("\n")}`
        : "No obvious issues found (limited local analysis)";
    },

    {
      mode: delegation.mode,
      toolName: REVIEW_TASK,
      delegationTimeout: delegation.delegationTimeout ?? 60000,
      fallbackEnabled: delegation.fallbackEnabled,
    }
  );

  const outcomeNote = result.outcome === "delegated"
    ? "(reviewed by LLM)"
    : "(local analysis)";

  return {
    content: [{
      type: "text",
      text: `Code Review ${outcomeNote}:\n\n${result.result}`,
    }],
  };
}
```

## Error Handling

### DelegationUnavailableError

Thrown when `delegate-only` mode is used but sampling isn't available:

```typescript
import { DelegationUnavailableError } from "@mcp-toolkit/mcp/strategy";

try {
  await executeWithDelegation(/* ... */);
} catch (error) {
  if (error instanceof DelegationUnavailableError) {
    // Client doesn't support sampling and delegation was required
  }
}
```

### ExecutionStrategyError

Thrown when both delegation and local execution fail:

```typescript
import { ExecutionStrategyError } from "@mcp-toolkit/mcp/strategy";

try {
  await executeWithDelegation(/* ... */);
} catch (error) {
  if (error instanceof ExecutionStrategyError) {
    console.log("Delegation error:", error.delegationError);
    console.log("Local error:", error.localError);
  }
}
```

## Best Practices

1. **Design your local implementation first** - It should work standalone
2. **Delegation is enhancement, not requirement** - Unless using `delegate-only`
3. **Use meaningful tool names** - `my_tool:subtask` pattern for clarity
4. **Set appropriate timeouts** - LLM calls can be slow
5. **Log outcomes** - Track delegation vs local execution for debugging
6. **Handle both paths in tests** - Test with and without sampling available

## Related Documentation

- [Privacy Configuration](./privacy.md) - Privacy implications of client discovery
- [MCP Sampling Specification](https://modelcontextprotocol.io/docs/concepts/sampling)
