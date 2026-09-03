---
"@mcp-toolkit/mcp": major
"@mcp-toolkit/toolkit": minor
"@mcp-toolkit/testing": minor
---

Migrate to SDK v2 and Streamable HTTP (protocol `2026-07-28`)

`@modelcontextprotocol/sdk@1.x` tops out at protocol `2025-11-25`. Support for
`2026-07-28` ships as restructured packages, so this is a dependency replacement
rather than a version bump:

```diff
-"@modelcontextprotocol/sdk": "^1.29.0"
+"@modelcontextprotocol/server": "^2.0.0"
+"@modelcontextprotocol/node": "^2.0.0"   // mcp package only
```

Both eras are served from one server definition via the SDK's
`legacy: "stateless"` fallback, so 2025-era clients keep working.

**Transports**

- HTTP moves from the 2024-11-05 HTTP+SSE wiring (`/sse` + `/message/:sessionId`)
  to Streamable HTTP via `createMcpHandler` + `toNodeHandler`. There is no
  long-lived stream and no per-connection session.
- stdio moves to `serveStdio`.
- Both take a **server factory** now, not a server instance — the stateless
  protocol lets the SDK build a server per request:

```diff
-await createHttpTransport(server, { context });
+await createHttpTransport(() => createServer({ ... }));
```

**Security fixes** (not spec-driven, but real)

- CORS no longer sends `Access-Control-Allow-Origin: *`. It echoes only allowed
  origins, which default to localhost. A wildcard alongside bearer auth let any
  page a user visited drive an authenticated server.
- Host and Origin are now validated using the SDK's own validators, closing a
  DNS-rebinding hole on local servers. Configure with `--allow-origin`.

**New flags**

- `--storage memory|file` and `--storage-dir` — makes the shared providers added
  in the previous release reachable from the server binary. Memory is still the
  default and now warns when used over HTTP.
- `--modern-only` — refuse 2025-era clients.
- `--allow-origin` — comma-separated origin allowlist.

**API changes**

- `setRequestHandler(ListToolsRequestSchema, h)` → `setRequestHandler("tools/list", h)`.
- The wire type for resource templates is now `ResourceTemplateType`;
  `ResourceTemplate` is a runtime class in v2. Generated scaffolding was updated
  to match.
- All `@modelcontextprotocol/sdk/types.js` imports move to
  `@modelcontextprotocol/server`.

**Known limitation**

The session handle is minted once per process, so a single instance keeps a
session across requests but **two instances do not yet share one**, even over
shared storage. Making the handle travel in the request needs the `session_id`
tool argument, which is the next piece of work. Note `LATEST_PROTOCOL_VERSION`
in the SDK means the latest *legacy* version (`2025-11-25`) and excludes
`2026-07-28` — do not read it as "newest supported".
