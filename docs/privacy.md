# Privacy Configuration

MCP Toolkit includes features that can collect information about the connected client environment. This document explains what data may be collected, how it's used, and how to control it.

## Client Discovery

When a session is initialized, MCP Toolkit can optionally discover metadata about the connected LLM client. This uses the MCP sampling capability to ask the LLM about itself.

### What Data May Be Collected

| Field | Example | Purpose |
|-------|---------|---------|
| `clientName` | `claude-desktop`, `cursor` | Identify the host application |
| `clientVersion` | `1.2.3` | Version tracking for compatibility |
| `model` | `claude-opus-4-5-20251101` | Model identifier |
| `modelProvider` | `anthropic`, `openai` | Provider identification |
| `capabilities` | `{ supportsStreaming: true }` | Feature detection |

### How It Works

1. During `session_init`, if client discovery is enabled, the server uses MCP sampling
2. A prompt asks the LLM to identify itself
3. The response is parsed and stored in the session's `clientMetadata` field
4. This data persists for the session duration only (in-memory by default)

### Data Flow

```
┌─────────────┐     sampling      ┌─────────────┐
│ MCP Server  │ ───────────────▶  │  Host LLM   │
│             │                   │             │
│ "What model │                   │ "I am       │
│  are you?"  │  ◀─────────────── │  claude..." │
└─────────────┘     response      └─────────────┘
        │
        ▼
  Session Storage
  (in-memory only)
```

## Privacy Controls

### Delegation Configuration

Client discovery behavior is controlled via the tool delegation configuration system. The default is `delegate-first` (attempt discovery, fall back gracefully).

#### Option 1: Disable at Server Level

```typescript
import { createServer } from "@mcp-toolkit/mcp";

const server = createServer({
  defaultToolDelegations: {
    // Disable client discovery entirely
    "session_init:client_discovery": {
      mode: "local-only",
    },
  },
});
```

#### Option 2: Disable per Session

```typescript
// Call session_init with discoverClient: false
await callTool("session_init", {
  projectName: "my-project",
  discoverClient: false,
});
```

#### Option 3: Provide Metadata Directly

```typescript
// Provide metadata explicitly instead of discovery
await callTool("session_init", {
  projectName: "my-project",
  clientMetadata: {
    clientName: "my-client",
    model: "my-model",
  },
});
```

### Delegation Mode Options

| Mode | Behavior | Privacy Impact |
|------|----------|----------------|
| `local-only` | Never attempt discovery | No data collected |
| `delegate-first` | Try discovery, fall back silently | Data collected if sampling available |
| `delegate-only` | Require discovery, error if unavailable | Data collection required |

### Default Configuration

Out of the box, MCP Toolkit uses `delegate-first` for client discovery:

```typescript
// packages/mcp/src/server.ts
const DEFAULT_TOOL_DELEGATIONS = {
  "session_init:client_discovery": {
    mode: "delegate-first",
    fallbackEnabled: true,
  },
};
```

This means:
- If the MCP client supports sampling, client metadata will be discovered
- If sampling is unavailable, the session continues without client metadata
- No errors are thrown either way

## Data Storage

### Default: In-Memory Only

By default, session data (including client metadata) is stored in memory and is lost when the server process ends. No data is persisted to disk or transmitted externally.

### Custom Providers

If you implement a custom `SessionProvider` that persists data, client metadata will be included. Consider:

- Encrypting sensitive fields before storage
- Implementing data retention policies
- Providing user access to their stored data
- Documenting what data is persisted

## Recommendations

### For Server Operators

1. **Evaluate necessity**: Only enable client discovery if you need the information
2. **Document usage**: Tell users what data you collect and why
3. **Minimize retention**: Don't persist client metadata longer than needed
4. **Secure storage**: If persisting, encrypt sensitive fields

### For Privacy-Conscious Deployments

```typescript
// Maximum privacy configuration
const server = createServer({
  defaultToolDelegations: {
    "session_init:client_discovery": {
      mode: "local-only",
    },
  },
});
```

### For Development/Debugging

```typescript
// Full discovery for debugging
const server = createServer({
  defaultToolDelegations: {
    "session_init:client_discovery": {
      mode: "delegate-first",
    },
  },
});
```

## Related Documentation

- [Tool Delegation](./tool-delegation.md) - Full delegation system documentation
- [MCP Reference](./mcp-reference.md) - Session and storage patterns

## Questions?

If you have privacy concerns or questions about data handling, please [open an issue](https://github.com/eyelock/mcp-toolkit/issues).
