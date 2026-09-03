---
"@mcp-toolkit/core": major
"@mcp-toolkit/model": minor
"@mcp-toolkit/testing": minor
"@mcp-toolkit/cli": minor
"@mcp-toolkit/mcp": patch
---

Address sessions by explicit handle, and ship shared storage providers

Preparation for MCP `2026-07-28`, which removes protocol-managed sessions. The
single-session assumption lived in the `SessionProvider` *interface* - every
method operated on an ambient "the session" - so no amount of swapping backends
could have fixed it.

**Breaking (`@mcp-toolkit/core`)**

`getSession`, `hasSession`, `updateSession` and `clearSession` now take a
`sessionId` as their first argument. `initSession` keeps its shape but accepts an
optional handle and returns the minted one on `SessionConfig`:

```diff
-await provider.getSession();
-await provider.updateSession({ projectName: "x" });
-await provider.clearSession();
+await provider.getSession(sessionId);
+await provider.updateSession(sessionId, { projectName: "x" });
+await provider.clearSession(sessionId);

 const { data } = await provider.initSession({ projectName: "x" });
+const sessionId = data.sessionId;
```

**New providers**

- `FileProvider` - JSON on disk, atomic writes, shared across processes on one
  host. Zero dependencies.
- `RedisProvider` - shared across hosts, with `fromNodeRedis` / `fromIoRedis`
  adapters. The client is injected, so core stays dependency-free.
- Both support `ttlMs`; `FileProvider.sweepExpired()` reclaims sessions nobody
  reads back.

**Conformance suite**

`runProviderConformanceTests` from `@mcp-toolkit/core/testing` holds every
provider to one contract. Custom providers should run it.

**Model**

- `SessionConfig` gains `sessionId`.
- New `SessionCreateInput`: the storage input type, which drops the tool-only
  `discoverClient` flag so storage no longer sees a sampling concern.
- `SessionUpdateInput.features` is now partial, matching the merge semantics
  providers already implemented - changing one flag no longer requires restating
  all four.

**CLI fix**

`mcp-toolkit-cli status` reported "No active session" unconditionally: it
constructed a fresh `MemoryProvider` per invocation, which could never see what
`init` wrote. Both commands now use a file-backed provider under a well-known
handle, so status reflects reality.
