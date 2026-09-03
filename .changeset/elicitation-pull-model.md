---
"@mcp-toolkit/mcp": major
---

Rewrite elicitation for the pull model

`2026-07-28` removed server-to-client requests, so the old push style throws on
a modern connection:

```typescript
const answer = await server.elicitInput({ ... }); // Error on 2026-07-28
```

Handlers now *return* a description of what they need and are called again with
the answers attached, so any instance can serve the retry.

```typescript
export async function handleDelete(args, context) {
  const confirm = elicitConfirmation(context, "confirm", "Delete this item?");
  if (confirm.status === "pending") {
    return confirm.result; // client answers, then calls us again
  }
  return confirm.value ? doDelete(args) : cancelled();
}
```

**Answers do not accumulate.** `inputResponses` carries only the answers to the
requests issued in the round immediately before. Two supported shapes:

- `elicitAll` with `textRequest` / `confirmationRequest` / `choiceRequest` — ask
  everything in one round. Nothing to remember; use this by default.
- `carryForward` — merges carried answers with new ones and signs them into
  `requestState`. Only needed when a later question depends on an earlier
  answer. Requires the new `ServerConfig.requestStateKey` (minimum 32 bytes),
  which is signed so a client cannot forge an answer it never gave.

**Where elicitation works**

| Transport | Era | Elicitation |
|---|---|---|
| stdio | modern | yes |
| stdio | legacy | yes — the SDK shim turns the return into a 2025 push |
| HTTP | modern | yes |
| HTTP | legacy | **no** — stateless per-request serving has no channel to push on |

The last row is a property of stateless HTTP, not of this code.

**Breaking**

- All helpers take the handler's `context` instead of a `server`, and return an
  `ElicitOutcome<T>` (`{ status: "ready", value }` or `{ status: "pending", result }`)
  rather than awaiting a response. They are now synchronous.
- `elicitText`, `elicitConfirmation`, `elicitChoice` and `elicitInput` take a
  `key` naming the request, so several can be in flight at once.
- Removed: `clientSupportsElicitation` (use `canElicit`),
  `DEFAULT_ELICITATION_TIMEOUT_MS`, `getElicitationTimeout`,
  `MCP_ELICITATION_TIMEOUT_MS`, `ElicitationValidationError`,
  `TypedElicitResult`. Round limits are now server options
  (`inputRequired: { maxRounds, roundTimeoutMs }`).
- `ServerContext` gains `inputResponses`, `carriedState`, `clientCapabilities`
  and `mintRequestState`.
