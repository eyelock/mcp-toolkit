# MCP 2026-07-28 Spec Migration Plan

**Status:** Draft — awaiting implementation
**Created:** 2026-09-02
**Target spec:** [`2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28)
**Current spec:** `2025-11-25` (ceiling of `@modelcontextprotocol/sdk@1.x`)

---

## Why this matters for *this* repo

MCP Toolkit's stated value is being a **self-documenting reference implementation** of the
specification. A stale protocol version is therefore not ordinary tech debt — it is a
correctness defect in the product. That justifies moving sooner than a typical server would.

## The one-paragraph summary of the release

The protocol went **stateless**. The `initialize`/`initialized` handshake and the
`Mcp-Session-Id` header are gone; capabilities move to a `server/discover` probe plus
per-request `_meta`. This is an *infrastructure* release: session-in-RAM plus a long-lived
SSE stream forced sticky routing, blocked horizontal scaling, and made serverless
deployment impossible. Nearly every other change falls out of that one — routing headers so
load balancers need not parse the body, cache hints because there is no stream to push
`listChanged` down, and `InputRequiredResult` because there is no stream to push an
elicitation down.

**Stateless ≠ stateless application.** The spec removes *protocol-managed* state but
explicitly permits application-level state via **explicit handles**: the server returns an
id, the client threads it back as a tool argument, and any instance resolves it from shared
storage. Same move the web made from in-process sessions to cookies/JWTs.

---

## Decisions already taken

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Dual-era support**, via SDK v2's `legacy: 'stateless'` shim | Keeps 2025-era clients working. Not two codebases — handlers are written the 2026 way and the shim translates *down*. |
| 2 | **Tool delegation is retained**, era-gated | Delegation is the project's signature pattern. It survives on 2025-era connections; modern connections take the existing local-fallback path. |
| 3 | **Ship a real shared storage provider** | "Here's the pattern, now go implement the hard part" is a weak demo of precisely the thing this spec revision is about. |

---

## The crux nobody expects: `SessionProvider` has no session id

This is the single most important finding in the whole review, and it is *not* a
consequence of the SDK upgrade.

`packages/core/src/storage/interface.ts` defines:

```typescript
getSession(): Promise<ProviderResult<SessionConfig | null>>;
hasSession(): Promise<boolean>;
updateSession(input: SessionUpdateInput): Promise<ProviderResult<SessionConfig>>;
clearSession(): Promise<ProviderResult<void>>;
```

Every method operates on an ambient, singular *"the session"*. `MemoryProvider` backs it with
`private session: SessionConfig | null`. **The single-session-per-process assumption lives in
the interface, not the implementation** — so swapping in Redis does not fix it. The interface
must become keyed by session id first, or a shared provider is just a slower way to have the
same bug.

Everything in Phase 1 follows from this.

---

## Phase 1 — Key storage by session id, ship shared providers ✅ DONE

*Independently valuable: fixes a real multi-instance bug that exists today, before any SDK
change. Land and release this on its own.*

> **Completed 2026-09-02.** All five sub-parts landed, plus two fixes the rekey exposed:
> `discoverClient` (a sampling concern) no longer reaches storage via a new
> `SessionCreateInput` type, and `SessionUpdateInput.features` is now partial to match the
> merge semantics providers already implemented. The CLI's `status` command - which
> constructed a fresh `MemoryProvider` per invocation and so *always* reported "No active
> session" - now works. Verified: full gate green (1172 tests), cross-process sharing proven
> with two separate node processes, CLI `init` → `status` round-trip confirmed.

### 1.1 Rekey the interface (`packages/core/src/storage/interface.ts`)

```typescript
export interface SessionConsumer {
  readonly name: string;
  getSession(sessionId: string): Promise<ProviderResult<SessionConfig | null>>;
  hasSession(sessionId: string): Promise<boolean>;
}

export interface SessionPublisher {
  readonly name: string;
  initSession(input: SessionInitInput): Promise<ProviderResult<SessionConfig>>; // mints + returns id
  updateSession(sessionId: string, input: SessionUpdateInput): Promise<ProviderResult<SessionConfig>>;
  clearSession(sessionId: string): Promise<ProviderResult<void>>;
}
```

- Add `sessionId: string` to `SessionConfigSchema` in `packages/model/src/schema.ts`;
  `initSession` mints it (`randomUUID`) and returns it in `SessionConfig`.
- Add optional `ttlMs` / expiry semantics to the interface contract — shared stores need
  eviction, and it is the natural place to document it.
- **Breaking change** to `@mcp-toolkit/core`'s public API. Changeset: `major` for `core`,
  `minor` for dependants. Since packages are `private: true` today, confirm whether this
  repo publishes before agonising over semver.

### 1.2 Update `MemoryProvider`

`private session` → `private sessions = new Map<string, SessionConfig>()`. Keep it as the
zero-dependency default and the reference for implementors. Document plainly that it is
**correct for stdio, single-instance only for HTTP**.

### 1.3 New: `FileProvider` (`packages/core/src/storage/file.ts`)

Zero external dependencies, works across processes on one host. Good default for the HTTP
path and for anyone kicking the tyres.

- One JSON file per session under a configurable root (default `.mcp-toolkit/sessions/`).
- Atomic writes (write temp + `rename`) so concurrent instances cannot tear a file.
- TTL sweep on read; no background timer (keeps it serverless-friendly).

### 1.4 New: `RedisProvider` (`packages/core/src/storage/redis.ts`)

The documented production example. Genuinely multi-instance.

- Keep the client dependency **optional** — accept an injected client
  (`createRedisProvider({ client })`) rather than adding `redis` to `@mcp-toolkit/core`
  dependencies. Preserves the zero-dep promise of core.
- Native TTL via `SETEX`, so eviction is free.

### 1.5 Tests

Write one **shared conformance suite** (`packages/testing/src/storage-conformance.ts`) that
every provider must pass, and run it against all three. This is the pattern a reference
implementation should be demonstrating anyway.

---

## Phase 2 — SDK v2 migration ✅ DONE

`@modelcontextprotocol/sdk@1.30.0` is the end of the 1.x line. 2026-07-28 support ships as
restructured packages, all `2.0.0`, published 2026-07-28:

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/server` | `createMcpHandler`, `McpServer`, `inputRequired`, `acceptedContent` |
| `@modelcontextprotocol/server/stdio` | `serveStdio` |
| `@modelcontextprotocol/client` | `Client` with `versionNegotiation` |
| `@modelcontextprotocol/node` | `toNodeHandler` (replaces the removed `handler.node()`) |

> **Completed 2026-09-02.** 2.2/2.3/2.4 landed. Verified against the real built server with
> real clients: stdio and HTTP each serve modern (pinned *and* auto-negotiated) and legacy
> clients; 10 tools / 2 resources / 5 prompts list and call correctly on both eras. A hostile
> `Origin` now gets `403` where the old wildcard CORS allowed it.
>
> **Regression found and fixed during verification.** `createMcpHandler` invokes the factory
> *per request*, so minting `sessionId` inside it gave every HTTP request a fresh handle and
> no session could be read back — worse than the old SSE transport, which held one `Server`
> per connection. The handle is now minted once per process in `index.ts`. This is a bridge,
> not the destination; see the corrected Phase 4 note below.
>
> Also added, because the e2e exposed that Phase 1's providers were unreachable from the
> binary: `--storage memory|file`, `--storage-dir`, plus a warning when memory is used over
> HTTP. And `--modern-only` / `--allow-origin`.

> ⚠️ **Verify before coding.** The API names above were taken from the SDK's
> `docs/migration/support-2026-07-28.md`, not from installed typings. First task of this
> phase is to install the packages and confirm every symbol against the real `.d.ts`.

### 2.1 Spike ✅ PASSED (2026-09-02)

Stood up v2 servers and drove them with real clients on both eras. Results:

| Path | Result |
|------|--------|
| Raw modern HTTP + `_meta` envelope | `tools/list` → `["echo"]` |
| `Client` pinned `2026-07-28` | `era=modern`, list + call OK |
| `Client` `mode: "auto"` | `era=modern`, list + call OK |
| `Client` default (legacy) | `era=legacy`, list + call OK |
| `serveStdio` + default client | `era=legacy`, list + call OK |

Every symbol the plan assumed is real. **Corrections and discoveries:**

1. **The decisive one — the low-level `Server` works through `createMcpHandler` on both
   eras, with raw JSON Schema `Tool[]`.** `McpServerFactory` returns `McpServer | Server`.
   So this repo's tool/resource/prompt registry pattern and its `.toJSONSchema()` tool
   definitions **survive unchanged**. 2.2 is far smaller than feared. (By contrast
   `McpServer.registerTool` *requires* Zod or a raw Zod shape and throws on raw JSON
   Schema — so the high-level API would have forced a rewrite of every tool. Staying
   low-level is both smaller and truer to the documented patterns.)
2. **`setRequestHandler` takes a method string now**: `setRequestHandler("tools/list", h)`
   replaces `setRequestHandler(ListToolsRequestSchema, h)`. A 3-arg form
   (`method, {params, result}, handler`) covers custom methods.
3. **Trap: `LATEST_PROTOCOL_VERSION` is `2025-11-25`**, and `SUPPORTED_PROTOCOL_VERSIONS`
   does *not* contain `2026-07-28`. Those constants describe the **legacy** era only; the
   modern revision lives in internal `FIRST_MODERN_PROTOCOL_VERSION` /
   `MODERN_WIRE_REVISION`. Never read `LATEST_*` as "newest supported".
4. **The `legacy` enums differ between entry points**: HTTP is
   `legacy?: 'stateless' | 'reject'`, stdio is `legacy?: 'serve' | 'reject'`.
5. **`cacheScope` is `'public' | 'private'`** — not the `'user'`/`'shared'` the blog
   summary implied. Corrects Phase 7.1.
6. **The SDK ships the security helpers 2.3 planned to hand-roll**: `validateOriginHeader`,
   `validateHostHeader`, `originValidationResponse`, `hostHeaderValidationResponse`,
   `localhostAllowedOrigins`, `localhostAllowedHostnames`, plus `requireBearerAuth` /
   `verifyBearerToken`. Use these rather than writing our own.
7. **Trace context keys are exported** (`TRACEPARENT_META_KEY`, `TRACESTATE_META_KEY`,
   `BAGGAGE_META_KEY`), and `ResourceNotFoundError` exists — Phases 7.2 and 8 get easier.
8. Modern requests **must** carry a per-request `_meta` envelope (protocol version, client
   info, capabilities) or the server answers `-32602` naming the missing keys.
9. `McpHttpHandler` is Web-standard (`fetch(Request) => Response`); `toNodeHandler` bridges
   it to `node:http`. `handler.node()` is indeed gone.

### 2.2 `packages/mcp/src/server.ts`

- Capabilities no longer belong in a constructor — they are served via `server/discover`.
- `sessionId` currently minted per *server instance* (`sessionId = randomUUID()` in
  `createServer`) must go. `ServerContext.sessionId` becomes per-*request*, resolved from the
  tool's `session_id` argument.
- `context.currentRequestId` currently derives from `params._meta.progressToken`, which is a
  misuse (a progress token is not a request id). Fix while in here.

### 2.3 `packages/mcp/src/transport/http.ts` — full rewrite

Current implementation is **two generations behind**: `SSEServerTransport` on `/sse` +
`/message/:sessionId` is the 2024-11-05 HTTP+SSE transport, deprecated by Streamable HTTP in
2025-03-26, and now superseded again.

- Replace with `createMcpHandler(...)` + `toNodeHandler`, `legacy: 'stateless'`.
- Emit/handle `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`.
- Drop the `transports` Map and the session-keyed message route entirely.
- **Security fixes while here (not spec-driven, but real):**
  - `Access-Control-Allow-Origin: *` alongside bearer auth is wrong — make the origin
    allowlist configurable.
  - No `Origin` validation → DNS-rebinding exposure on a localhost server. Add it.

### 2.4 `packages/mcp/src/transport/stdio.ts`

`server.connect(new StdioServerTransport())` → `serveStdio(() => buildServer())`.

---

## Phase 3 — Elicitation: push → pull ✅ DONE

`packages/mcp/src/elicitation/helpers.ts:190` calls `server.elicitInput()`. On 2026-era
connections that **throws a typed error**.

New shape: *return* an `InputRequiredResult` carrying `inputRequests` + `requestState`; the
client resubmits with `inputResponses`.

- Rewrite all four helpers — `elicitInput`, `elicitText`, `elicitConfirmation`, `elicitChoice`
  — around `inputRequired()` / `acceptedContent()`.
- ~~**This is the cleanest win in the migration:** the legacy shim translates modern-style
  returns *down* to 2025 push, so writing it the new way is automatically backward compatible.~~
  **Half right — corrected by the spike.** The shim does translate down, but only where a
  connection exists to push on. Measured:

  | Transport | Era | Elicitation |
  |---|---|---|
  | stdio | modern | ✅ |
  | stdio | legacy | ✅ (shim translates down) |
  | HTTP | modern | ✅ |
  | HTTP | legacy | ❌ *"per-request legacy serving cannot receive server-to-client requests"* |

  The last row is inherent to stateless HTTP, not a shim limitation — and not a regression
  from this phase, since the SSE transport that made it possible was already removed in
  Phase 2. Documented in the module header.
- `DEFAULT_ELICITATION_TIMEOUT_MS` / `MCP_ELICITATION_TIMEOUT_MS` are superseded by server
  options `inputRequired: { maxRounds, roundTimeoutMs }`. Dropped.
- Helper signatures change from `(server, ...)` to returning a result — **breaking** for any
  consumer.

> **Completed 2026-09-02.** Verified end-to-end on both transports and both eras.
>
> **A bug caught before shipping.** `inputResponses` carries *only* the answers to the
> requests issued in the round immediately before — they do **not** accumulate. Measured
> directly: round 2 sees `["a"]`, round 3 sees `["b"]` and `a` is gone. A handler that asks
> sequentially and re-asks for what it cannot see loops until `maxRounds` fires. My first
> draft of the helpers did exactly that. Fixed with two correct shapes:
> - `elicitAll` + `textRequest`/`confirmationRequest`/`choiceRequest` — ask everything in one
>   round, nothing to remember. The recommended path.
> - `carryForward` — merges carried answers with newly arrived ones and re-signs them into
>   `requestState` via `createRequestStateCodec`. Needed only when a later question depends on
>   an earlier answer. Requires the new `ServerConfig.requestStateKey` (**min 32 bytes**).
>
> Both verified to terminate: one-round = 2 prompts, sequential = 2 prompts with the second
> question depending on the first answer.

---

## Phase 4 — Session state / workflow enforcement on handles ✅ DONE

Depends on Phase 1.

> **Completed 2026-09-02.** The handle now travels in the request, so instances are
> interchangeable. Verified against two independent server processes over one shared file
> store: A mints a handle, B reads it, B writes to it, A sees B's write, and A reads it back
> as `session://{handle}`. An unknown handle is refused. stdio still needs no handle at all.
>
> **Also fixed: a concurrency bug.** The old code assigned `sessionId`/`currentRequestId`
> onto one shared `context` object. Harmless when a connection owned a server; a race under
> stateless HTTP, where requests interleave. Each request now gets its own context, with a
> test that fails if it regresses to mutation.
>
> **Correction to this plan's premise:** `getDefaultWorkflowTracker` was flagged as a
> process-global to remove. It holds *hook definitions* registered at setup, and
> `checkWorkflowAllowed` is never called in the request path — so it is not session state and
> was left alone. Removing public API on a false premise would have been the wrong call.

`spec/session-state.ts` gates tool ordering from instance memory
(`private state: SessionState = "uninitialized"`). Stateless removes the ground that stands on.

**Enforcement does not weaken.** The check changes from
*"do I remember this caller running `session_init`?"* to
*"did the caller pass a `session_id` that resolves to an initialized session?"* — and refuses
if not. That is arguably **stronger**: it survives restarts and works across instances,
whereas today's version silently fails open the moment you run two replicas.

- `SessionStateTracker` becomes stateless: `checkToolAllowed(toolName, sessionId)` reads
  through `SessionConsumer` instead of a private field.
- **Remove the per-process handle bridge** added in Phase 2 (`const sessionId = randomUUID()`
  hoisted in `index.ts`) once the handle arrives on the request. Until then HTTP behaves as
  one session per process.
- Every tool in `requiresInitTools` gains a `session_id` argument in its Zod schema.
- `session_init` returns the handle prominently in its result text so the model threads it back.
- `spec/workflow-state.ts` (re-exported from core) gets the same treatment — progress recorded
  against the handle in storage, not in a module-level singleton
  (`getDefaultWorkflowTracker` is a process-global and must go).
- **Separately:** signed `requestState` via `createRequestStateCodec` is *not* an alternative
  to handles — it carries short-lived continuation state *within* one multi-round-trip
  operation (Phase 3). Both exist because they do different jobs. Needs an HMAC key in config.

---

## Phase 5 — Tool delegation, re-expressed as pull ✅ DONE

Per decision #2, **revised mid-phase with the user's agreement.**

> **Completed 2026-09-02.** The spike found `inputRequired.createMessage()` — sampling has a
> working *pull* equivalent — so delegation did not have to be gated off on modern
> connections. It now genuinely works there. Verified end-to-end:
>
> | Transport | Era | Delegation |
> |---|---|---|
> | stdio | modern | ✅ delegated |
> | stdio | legacy | ✅ delegated (shim) |
> | stdio | modern, client without `sampling` | ✅ local fallback |
> | HTTP | modern | ✅ delegated |
> | HTTP | legacy | ✅ local fallback (no push channel) |
>
> **Bug found and fixed — it also affected Phase 3.** `clientCapabilities` was read from
> `server.getClientCapabilities()`, which returns the handshake capabilities and is
> **undefined on modern connections**; there they arrive in the per-request `_meta` envelope.
> So delegation silently never fired on modern, and Phase 3's `canElicit` was silently false
> there too. `readClientCapabilities` now reads the envelope first and falls back to the
> connection, using the SDK's `CLIENT_CAPABILITIES_META_KEY`.
>
> Also removed a genuine smell: `clientSupportsSampling` reached into the private
> `server._clientCapabilities`. It now takes the context.

`strategy/index.ts` + `strategy/client-discovery.ts:81` are built on `server.createMessage()`.
Sampling is deprecated and **hard-errors on modern connections**.

- ~~Add an era check to `executeWithDelegation`. Modern → skip the delegate path.~~
  **Superseded.** `executeWithDelegation(context, args, spec, localFn, options)` now returns
  `outcome: "pending"` with a `request` the handler hands back; the client puts it to the LLM
  and calls the tool again. `DelegationSpec` splits the old `delegateFn` into `build` (ask)
  and `parse` (read the answer), neither of which awaits anything.
- Because the handler re-runs from the top, the delegation point must sit **before any
  writes**. In `session_init` it does — discovery happens before `initSession` — so
  re-running is safe. Documented in the module header as a constraint for anyone adding a
  delegating tool.
- `server.ts:44` ships `session_init:client_discovery` as `delegate-first` **by default**,
  so the out-of-the-box path is the one that breaks. The existing `fallbackEnabled` machinery
  already does the right thing once the era check routes into it.
- Document in `docs/tool-delegation.md` (Phase 9). The deprecation clock is now less
  pressing: the pull form does not use the deprecated server-to-client `sampling/createMessage`
  path on modern connections.
- Note in docs that the spec's suggested replacement ("integrate directly with LLM provider
  APIs") is **not** a drop-in — it does not let a server borrow the *host's* model, which was
  the entire point of delegation.

---

## Phase 6 — Retire MCP logging transport ✅ DONE

Logging is deprecated; spec says stderr for stdio, OpenTelemetry for structured observability.

- ~~Delete `McpProtocolTransport` or gate it to legacy-era only.~~ **Both premises were
  wrong; deprecated and made honest instead.**

> **Completed 2026-09-02.**
>
> **The premise was wrong.** Unlike sampling and elicitation, `sendLoggingMessage()` does
> **not** throw on a modern connection — logging is deprecated but functional. Measured:
>
> | Transport | Era | `sendLoggingMessage` | Client receives it |
> |---|---|---|---|
> | stdio | modern | resolves | ✅ |
> | stdio | legacy | resolves | ✅ |
> | HTTP | modern | resolves | ❌ **silently dropped** |
> | HTTP | legacy | resolves | ❌ **silently dropped** |
>
> So the real problem is not that it errors — it is that over HTTP it *succeeds and goes
> nowhere*, which an operator would read as working logging. Gating it to "legacy-only" would
> have been wrong too, since it works fine on modern stdio and is broken on legacy HTTP: the
> axis is the transport, not the era.
>
> Deleting it outright was also premature — the spec gives deprecated features a minimum
> twelve-month window, and it is public API. So: marked `@deprecated` with the measured table
> in the doc block, and it now warns **once** on stderr when delivery fails. A silent hole in
> the logs is worse than a noisy one.
>
> `StderrTransport` is confirmed as the survivor and now emits OpenTelemetry's
> `SeverityNumber` / `SeverityText` alongside the existing fields, so a collector ingests it
> without a translation step — which is what the spec means by "OpenTelemetry for structured
> observability", achieved with no new dependency. Verified on the real server:
> `{"level":"info",...,"SeverityNumber":9,"SeverityText":"INFO",...}`.
- `StderrTransport` is the survivor — the `LogTransport` abstraction holds up well, only one
  implementation retires.
- Trace context in the log line is left to Phase 7.2, which owns W3C trace propagation.

---

## Phase 7 — Adopt new spec surface

### 7.1 Cache hints (`ttlMs`, `cacheScope`)

More important than they sound: **these are what replace the long-lived SSE stream for
learning about list changes.** Without them, clients have no freshness signal at all.

- Server option: `cacheHints: { 'tools/callTool': { ttlMs, cacheScope } }`.
- Attach to `ListTools` / `ListResources` / `ListPrompts` and resource reads.
- Fold into `spec/pagination.ts`'s `createPaginatedResponse`.
- `cacheScope: 'user'` vs `'shared'` is a **privacy decision** — anything derived from session
  config must be user-scoped. Cross-reference `docs/privacy.md`.

### 7.2 W3C trace context

Propagate `traceparent` / `tracestate` / `baggage` through `_meta`. Natural fit with the
logging module now that the MCP transport is retiring.

---

## Phase 8 — Schema and error-code cleanup

- **JSON Schema 2020-12** is now fully supported (`oneOf`/`anyOf`/`allOf`, conditionals,
  `$ref`/`$defs`). Drop `zod-to-json-schema` entirely: `packages/model/src/schema.ts:142`
  re-exports it, but the codebase has already moved to Zod 4's native `.toJSONSchema()`
  (`tools/session-init.ts:42`, `:254`, and all four toolkit tools). Remove the dependency and
  the re-export; update `docs/mcp-reference.md`, which still shows the old import.
- Guard rails the spec now requires: **must not auto-dereference external `$ref` URIs**;
  should bound schema depth and validation time. Add both, and a test — good reference-impl
  material.
- `structuredContent` may now be **any JSON value**, not just an object. No current usage
  (`outputSchema`/`structuredContent` appear nowhere in `packages/*/src`) — consider adding
  an example tool, since a reference implementation ought to demonstrate it.
- **Error code `-32002` → `-32602`** for resource-not-found. The repo hardcodes no error
  codes, so behaviour is inherited from the SDK — low risk, but verify `handleResourceRead`
  after the v2 swap.
- **Roots**: deprecated, and the repo does not use them. No action.

---

## Phase 9 — Documentation

All spec links are stale and must move to `2026-07-28`:

- `docs/mcp-reference.md` — pins `2025-06-18` throughout; also documents `pagination.ts` and
  `logging.ts` at paths that have since moved under `spec/`, and shows the removed
  `zodToJsonSchema` import.
- `packages/mcp/README.md:114-122` — pins `2025-03-26`.
- `docs/tool-delegation.md` — add the sampling deprecation clock (Phase 5).
- `docs/privacy.md` — add `cacheScope` guidance (Phase 7.1).
- `docs/getting-started.md` — new storage provider choice, `session_id` in tool calls.
- Root `README.md` — state the supported protocol version explicitly.
- **New:** `docs/stateless.md` explaining the handle pattern. This is the highest-value doc in
  the set, because it is the concept most implementors will get wrong.

---

## Deferred (not in this migration)

| Item | Why deferred |
|------|--------------|
| **Extensions framework** | Negotiation plumbing is worth having, but no extension is needed yet. |
| **Tasks** | Now an extension, redesigned, `tasks/list` removed. Repo has no task support today, so this is a *feature*, not a migration. |
| **MCP Apps** | Sandboxed-iframe UI. Significant new surface; separate effort. |

---

## Sequencing and risk

```
Phase 1 (storage) ──────────────┐
   independent, ship first      │
                                ▼
Phase 2 (SDK v2) ──► Phase 3 (elicitation)
   │                 Phase 5 (delegation gate)
   │                 Phase 6 (logging)
   │                 Phase 7 (cache/trace)
   └──────────────►  Phase 4 (session state)  ◄── also needs Phase 1
                     Phase 8 (schema)
                                ▼
                     Phase 9 (docs) — last, once APIs settle
```

**Highest risk:** Phase 2. The SDK restructure touches every entry point at once and the
public API is confirmed only from a migration doc, not from typings. The 2.1 spike is the
mitigation — do not skip it.

**Lowest risk / highest immediate value:** Phase 1. It fixes a live multi-instance bug and
needs no new dependency.

**Breaking changes for downstream template users:** storage interface (1.1), elicitation
helper signatures (3), `session_id` tool arguments (4). All three warrant a migration note in
the changeset.

## Definition of done

Per `.claude/CLAUDE.md` — all of the following green **locally** before any push:

```bash
pnpm build && pnpm check && pnpm typecheck && pnpm test
```

Plus, specific to this work:

- [x] Storage conformance suite passes against Memory, File, and Redis providers
- [x] Server verified against a 2026-era client **and** a 2025-era client (dual-era proof)
- [x] Two HTTP instances behind a round-robin proxy share session state correctly
      **(Done in Phase 4, not Phase 2 — corrected.** Shared *storage* landed in Phase 1 and stateless
      *transport* in Phase 2, but the handle is still per-process, so two instances still do
      not share a session. Only the `session_id` tool argument closes this. Now verified passing:
      instance A's `session_init` is read, updated and re-read across instance B.)
- [ ] MCP Inspector (`make mcp`) still connects
- [ ] No `2025-` spec URLs remain outside deliberate historical references
