---
"@mcp-toolkit/mcp": major
"@mcp-toolkit/model": minor
---

Address sessions by handle, making server instances interchangeable

The final piece of the `2026-07-28` migration. Storage became handle-keyed and
the transport became stateless in the previous releases, but the handle was
still minted per process — so two instances could not serve the same session.
It now travels in the request.

**Tools take a `session_id`**

`session_status`, `session_update` and `session_clear` accept the handle that
`session_init` returns (and now prints first in its output). Any instance can
serve any session:

```
A: session_init            -> session_id: 9740effb-…
B: session_status  { session_id: "9740effb-…" }   -> the session A created
B: session_update  { session_id: "9740effb-…", projectName: "renamed" }
A: session_status  { session_id: "9740effb-…" }   -> "renamed"
```

**stdio is unchanged for callers.** One process serves one conversation, so it
keeps a default handle and no `session_id` need be threaded. HTTP sets no
default: with several instances there is no sensible "current" session, so a
tool that needs one says so rather than guessing.

**Resources are addressed the same way.** New `session://{sessionId}` template
alongside `session://current`, which now resolves only against the default
handle. `resources/templates/list` is now served (it previously was not).

**Enforcement moved, and got stronger.** `SessionStateTracker` holds no state:
it asks "does this handle resolve to an initialized session?" against shared
storage instead of "do I remember this caller?" against one process's heap. It
survives restarts and works across instances, neither of which the in-memory
version did.

**Concurrency fix.** The server assigned `sessionId` and `currentRequestId` onto
a single shared context object. That was safe when a connection owned a server;
under stateless HTTP, concurrent requests could overwrite each other's session.
Each request now builds its own context.

**Breaking**

- `ServerConfig.sessionId` → `ServerConfig.defaultSessionId`, and it is no longer
  auto-generated — a server does not own a session.
- `ServerContext.sessionId` is now `string | null`.
- `SessionStateTracker.checkToolAllowed(tool, sessionId, consumer)` is async and
  takes a storage consumer; `setSessionId`, `recordToolCall`, `getTimingInfo`,
  `isInitialized` and the `SessionState` transitions are gone.
