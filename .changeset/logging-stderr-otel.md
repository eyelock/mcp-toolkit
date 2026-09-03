---
"@mcp-toolkit/mcp": minor
---

Deprecate protocol logging; make stderr output OpenTelemetry-shaped

MCP `2026-07-28` deprecates protocol logging (SEP-2577) in favour of stderr for
stdio and OpenTelemetry for structured observability.

Unlike sampling and elicitation, `sendLoggingMessage()` does **not** throw on a
modern connection — it keeps working. The real hazard is subtler:

| Transport | Era | `sendLoggingMessage` | Client receives it |
|---|---|---|---|
| stdio | modern | resolves | yes |
| stdio | legacy | resolves | yes |
| HTTP | modern | resolves | **no — dropped** |
| HTTP | legacy | resolves | **no — dropped** |

Over HTTP the call succeeds and the message goes nowhere, because stateless
per-request serving has no open stream to deliver a notification on. Nothing
throws, so logging looks healthy while producing nothing.

**Changes**

- `McpProtocolTransport` is marked `@deprecated`, with the table above in its
  doc block so the gap is discoverable at the call site. It still works, and
  remains supported for the spec's minimum twelve-month deprecation window.
- It now warns **once** on stderr when delivery fails, rather than swallowing
  the error silently.
- `StderrTransport` — the transport that works identically on both transports —
  now emits OpenTelemetry log-data-model fields (`SeverityNumber`,
  `SeverityText`) alongside the existing ones, so a collector can ingest the
  output directly.
- New `OTEL_SEVERITY_NUMBER` export maps the eight RFC 5424 levels to
  OpenTelemetry severity numbers.

No dependency was added: the output is OTel-compatible JSON on stderr, which is
what container and serverless platforms already collect.
