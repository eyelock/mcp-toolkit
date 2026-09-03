/**
 * MCP Server Setup
 *
 * Creates and configures the MCP server with tools, resources, and prompts.
 * Supports the tool delegation pattern.
 *
 * Session and Request Tracking:
 * - Each server instance has a unique sessionId (generated at creation)
 * - Each request can have a requestId (from MCP _meta or auto-generated)
 * - Hooks are fired at session start/end and around tool execution
 */

import { randomUUID } from "node:crypto";
import type { SessionProvider } from "@mcp-toolkit/core";
import { createMemoryProvider } from "@mcp-toolkit/core";
import type { ServerIdentity, ToolDelegationConfig } from "@mcp-toolkit/model";
import type { ClientCapabilities, InputResponses } from "@modelcontextprotocol/server";
import {
  CLIENT_CAPABILITIES_META_KEY,
  createRequestStateCodec,
  Server,
} from "@modelcontextprotocol/server";
import { loadCoreHooks } from "./hooks/index.js";
import { handleGetPrompt, registerPrompts } from "./prompts/index.js";
import { getResourceTemplates, handleResourceRead, registerResources } from "./resources/index.js";
import { createSessionStateTracker, type SessionStateTracker } from "./spec/session-state.js";
import { handleToolCall, registerTools } from "./tools/index.js";

/**
 * Default tool delegations for out-of-the-box functionality
 *
 * Tools default to "local-only" (self-reliant), but certain tools
 * benefit from delegation when the LLM knows better.
 *
 * Client discovery is configured as "delegate-first" because only
 * the LLM knows what model it is - this is a perfect delegation case.
 */
const DEFAULT_TOOL_DELEGATIONS: ToolDelegationConfig = {
  // Client discovery: Only the LLM knows its own model identifier
  "session_init:client_discovery": {
    mode: "delegate-first",
    fallbackEnabled: true,
  },
};

export interface ServerConfig {
  name?: string;
  version?: string;
  provider?: SessionProvider;
  identity?: ServerIdentity;
  /** Default tool delegation configuration */
  defaultToolDelegations?: ToolDelegationConfig;
  /**
   * Handle used when a request supplies no `session_id`.
   *
   * Set this for single-session transports (stdio), where one process serves
   * one conversation. Leave it unset for HTTP: with more than one instance
   * there is no sensible default, and requests must carry their own handle.
   */
  defaultSessionId?: string;
  /** Tools that require session initialization before use */
  requiresInitTools?: string[];
  /**
   * Secret used to sign `requestState` for multi-round-trip requests.
   *
   * `requestState` round-trips through an untrusted client, so anything the
   * server decides from it must be tamper-evident. Supply a key to enable
   * multi-step elicitation; without one, a handler can still ask for several
   * things in a single round, which needs no carried state.
   *
   * Must be at least 32 bytes.
   */
  requestStateKey?: string | Uint8Array;
}

/**
 * Result of createServer - includes both the MCP Server and context
 */
export interface CreateServerResult {
  /** The MCP SDK Server instance */
  server: Server;
  /** Server context with session tracking and hooks */
  context: ServerContext;
}

/**
 * Work out which session a request addresses.
 *
 * The caller's explicit handle wins. Falling back to the server default keeps
 * stdio ergonomic - one process, one session, no handle to thread - while HTTP,
 * which sets no default, requires the handle and so can be served by any
 * instance.
 */
/**
 * Read the calling client's declared capabilities.
 *
 * The two eras put them in different places, and neither has both:
 * - modern (`2026-07-28`): in the per-request `_meta` envelope, because there
 *   is no handshake to remember them from
 * - legacy: on the connection, captured during `initialize`
 *
 * Legacy HTTP has neither - per-request serving carries no capabilities - which
 * is why sampling and elicitation cannot work there.
 */
function readClientCapabilities(
  server: Server,
  envelope: Record<string, unknown> | undefined
): ClientCapabilities | undefined {
  const fromEnvelope = envelope?.[CLIENT_CAPABILITIES_META_KEY];
  if (fromEnvelope && typeof fromEnvelope === "object") {
    return fromEnvelope as ClientCapabilities;
  }
  return server.getClientCapabilities();
}

export function resolveSessionId(
  args: Record<string, unknown>,
  context: Pick<ServerContext, "sessionId">
): string | null {
  const supplied = args.session_id;
  if (typeof supplied === "string" && supplied.length > 0) {
    return supplied;
  }
  return context.sessionId ?? null;
}

export function createServer(config: ServerConfig = {}): CreateServerResult {
  const {
    name = "mcp-toolkit",
    version = "0.0.0",
    provider = createMemoryProvider(),
    identity = { canonicalName: name, tags: {} },
    defaultToolDelegations = {},
    defaultSessionId,
    requiresInitTools = [],
    requestStateKey,
  } = config;

  // Merge user-provided delegations with defaults (user overrides take precedence)
  const mergedDelegations: ToolDelegationConfig = {
    ...DEFAULT_TOOL_DELEGATIONS,
    ...defaultToolDelegations,
  };

  // Workflow enforcement. The tracker holds rules only - session state is
  // resolved from storage per request, so this is safe to share.
  const sessionStateTracker = createSessionStateTracker("session_init", requiresInitTools);

  // Signed carry-state for multi-round-trip requests. The SDK verifies it
  // before the handler runs, so `ctx.mcpReq.requestState()` is trustworthy.
  const requestStateCodec = requestStateKey
    ? createRequestStateCodec<Record<string, unknown>>({ key: requestStateKey })
    : undefined;

  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      ...(requestStateCodec ? { requestState: { verify: requestStateCodec.verify } } : {}),
    }
  );

  // Store provider, identity, and server in context for handlers
  // Server instance is needed for sampling access in tool delegation
  const context: ServerContext = {
    server,
    provider,
    identity,
    name,
    version,
    defaultToolDelegations: mergedDelegations,
    sessionId: defaultSessionId ?? null,
    sessionStateTracker,
    currentRequestId: null,
    mintRequestState: requestStateCodec ? (payload) => requestStateCodec.mint(payload) : undefined,
  };

  // Register tool handlers
  server.setRequestHandler("tools/list", async () => ({
    tools: registerTools(),
  }));

  server.setRequestHandler("tools/call", async (request, ctx) => {
    const args = request.params.arguments ?? {};

    // A fresh context per request rather than mutating the shared one: under
    // the stateless protocol several requests may be in flight at once, and
    // assigning sessionId/requestId onto one shared object would let them
    // overwrite each other.
    const requestContext: ServerContext = {
      ...context,
      sessionId: resolveSessionId(args, context),
      currentRequestId: randomUUID(),
      // Multi-round-trip input. On the first round this is undefined; when the
      // client resubmits after fulfilling an InputRequiredResult, the answers
      // arrive here. See ./elicitation.
      inputResponses: ctx.mcpReq.inputResponses,
      clientCapabilities: readClientCapabilities(
        server,
        ctx.mcpReq.envelope as Record<string, unknown> | undefined
      ),
      carriedState: requestStateCodec
        ? (ctx.mcpReq.requestState<Record<string, unknown>>() ?? undefined)
        : undefined,
    };

    const blockMessage = await sessionStateTracker.checkToolAllowed(
      request.params.name,
      requestContext.sessionId,
      provider
    );
    if (blockMessage) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: blockMessage }],
      };
    }

    return handleToolCall(request.params.name, args, requestContext);
  });

  // Register resource handlers
  server.setRequestHandler("resources/list", async () => ({
    resources: registerResources(),
  }));

  server.setRequestHandler("resources/read", async (request) => {
    return handleResourceRead(request.params.uri, context);
  });

  server.setRequestHandler("resources/templates/list", async () => ({
    resourceTemplates: getResourceTemplates(),
  }));

  // Register prompt handlers
  server.setRequestHandler("prompts/list", async () => ({
    prompts: registerPrompts(),
  }));

  server.setRequestHandler("prompts/get", async (request) => {
    const promptArgs = request.params.arguments;
    const promptContext: ServerContext = {
      ...context,
      sessionId: resolveSessionId(promptArgs ?? {}, context),
    };
    return handleGetPrompt(request.params.name, promptArgs, promptContext);
  });

  return { server, context };
}

export type ServerContext = {
  /** MCP Server instance for sampling access (optional for backward compatibility with tests) */
  server?: Server;
  /** Session provider for storage */
  provider: SessionProvider;
  /** Server identity with canonical name and tags */
  identity: ServerIdentity;
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Default tool delegation configuration */
  defaultToolDelegations?: ToolDelegationConfig;
  /**
   * Handle for the session this request addresses.
   *
   * Resolved per request from the caller's `session_id`, falling back to the
   * server's `defaultSessionId` (stdio). `null` means the request named no
   * session - handlers that need one should say so rather than guess.
   */
  sessionId: string | null;
  /** Session state tracker for workflow enforcement */
  sessionStateTracker: SessionStateTracker;
  /** Current request ID (updated per request) */
  currentRequestId: string | null;
  /**
   * Answers to input this handler previously requested, present only on a
   * resubmitted request.
   *
   * Under `2026-07-28` a server cannot push a question to the client mid-call;
   * it returns an `InputRequiredResult` and the client calls again with the
   * answers. This is where they land.
   */
  inputResponses?: InputResponses | Record<string, unknown>;
  /**
   * What the calling client declared it can do.
   *
   * Undefined on a legacy HTTP connection, where per-request serving carries no
   * capabilities - which is also why elicitation cannot work there.
   */
  clientCapabilities?: ClientCapabilities;
  /**
   * Verified state this handler minted on a previous round.
   *
   * `inputResponses` only carries answers to the requests issued in the round
   * immediately before - they do not accumulate. Anything a handler needs to
   * remember across rounds travels here instead, signed so a client cannot
   * forge it.
   */
  carriedState?: Record<string, unknown>;
  /** Sign state to carry into the next round. Present when a key is configured. */
  mintRequestState?: (payload: Record<string, unknown>) => Promise<string>;
};

/**
 * Get session start hooks content
 *
 * Call this when the session begins to get guidance for the LLM.
 */
export async function getSessionStartHooks(
  context: ServerContext
): Promise<{ content: string; sessionId: string | null; requestId: string | null }> {
  const { content } = await loadCoreHooks("session", "start");
  return {
    content,
    sessionId: context.sessionId,
    requestId: context.currentRequestId,
  };
}

/**
 * Get session end hooks content
 *
 * Call this when the session ends to get cleanup guidance for the LLM.
 */
export async function getSessionEndHooks(
  context: ServerContext
): Promise<{ content: string; sessionId: string | null }> {
  const { content } = await loadCoreHooks("session", "end");
  return {
    content,
    sessionId: context.sessionId,
  };
}
