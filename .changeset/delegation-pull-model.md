---
"@mcp-toolkit/mcp": major
"@mcp-toolkit/model": minor
---

Re-express tool delegation as a pull, so it works on modern connections

`2026-07-28` removed server-to-client requests, so `await server.createMessage(...)`
mid-handler throws on a modern connection — which would have left delegation,
this toolkit's signature pattern, working only for shrinking 2025-era traffic.

Sampling has a working pull equivalent (`inputRequired.createMessage`), so
delegation is now a round trip instead: the handler returns a request for the
host LLM, and is called again with the answer.

```typescript
const outcome = await executeWithDelegation(context, args, spec, localFn, options);

if (outcome.outcome === "pending") {
  return outcome.request as CallToolResult; // client asks the LLM, calls us again
}
if (outcome.outcome === "delegated") {
  use(outcome.result);
}
```

**Verified working**

| Transport | Era | Delegation |
|---|---|---|
| stdio | modern | delegated |
| stdio | legacy | delegated (SDK shim) |
| HTTP | modern | delegated |
| HTTP | legacy | local fallback — no channel to reach the client |
| any | client without `sampling` | local fallback |

**Bug fix: capabilities were read from the wrong place**

`clientCapabilities` came from `server.getClientCapabilities()`, which holds the
handshake capabilities and is **undefined on modern connections** — there they
travel in the per-request `_meta` envelope. Delegation therefore never fired on
modern connections, and `canElicit` was likewise always false there. Both now
read the envelope first and fall back to the connection.

**Breaking**

- `executeWithDelegation(server, args, delegateFn, localFn, options)` becomes
  `executeWithDelegation(context, args, spec, localFn, options)`. It takes the
  handler's `ServerContext`, not a `Server`.
- `DelegationFn` is replaced by `DelegationSpec`, which splits asking from
  reading: `{ build, parse, key? }`. `parse` returns `undefined` for an answer
  it cannot use, which is treated as a failed delegation.
- `ExecutionOutcome` gains `"pending"`, and `DelegationResult` gains `request`.
- `discoverClientMetadata(server, timeout)` is replaced by the
  `clientDiscoverySpec` delegation spec.
- `clientSupportsSampling` and `getClientCapabilities` take a context instead of
  a `Server`, and no longer reach into the private `_clientCapabilities` field.

**Note for anyone adding a delegating tool:** the handler re-runs from the top on
the resumed round, so put the delegation point before any writes. `session_init`
already does — discovery happens before the session is created.
