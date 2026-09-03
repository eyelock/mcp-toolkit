/**
 * Session Resource
 *
 * Exposes a session's configuration as an MCP resource.
 *
 * ## Two ways to address a session
 *
 * Resources are addressed by URI, so under the stateless protocol the handle
 * belongs *in the URI*:
 *
 * - `session://{sessionId}` - explicit, and the only form that works when more
 *   than one instance serves the server.
 * - `session://current` - resolves to the server's default handle. Meaningful
 *   over stdio, where one process serves one conversation; over HTTP there is
 *   no "current" and it says so.
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28/server/resources
 */

import type {
  ReadResourceResult,
  Resource,
  ResourceTemplateType,
} from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";

/** URI that resolves to the server's default session (stdio) */
export const SESSION_RESOURCE_URI = "session://current";

/** Template for addressing a session by its handle */
export const SESSION_URI_TEMPLATE = "session://{sessionId}";

/**
 * Session resource definition
 */
export const sessionResource: Resource = {
  uri: SESSION_RESOURCE_URI,
  name: "Current Session",
  description:
    "The default session's configuration. Only meaningful on single-session transports (stdio); " +
    "use session://{sessionId} to address a specific session.",
  mimeType: "application/json",
};

/**
 * Handle-addressed session template
 */
export const sessionResourceTemplate: ResourceTemplateType = {
  uriTemplate: SESSION_URI_TEMPLATE,
  name: "Session by handle",
  description: "Configuration for the session with the given handle, as returned by session_init.",
  mimeType: "application/json",
};

function jsonResource(uri: string, body: unknown): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(body, null, 2),
      },
    ],
  };
}

/**
 * Read a session by handle.
 *
 * @param sessionId - Handle to read, or null to use the server default
 * @param uri - URI to echo back on the result
 */
export async function readSessionByHandle(
  sessionId: string | null,
  uri: string,
  context: ServerContext
): Promise<ReadResourceResult> {
  if (!sessionId) {
    return jsonResource(uri, {
      error: "No session addressed",
      detail:
        "This server has no default session, which is normal over HTTP. Read " +
        "session://{sessionId} using the handle returned by session_init.",
    });
  }

  const result = await context.provider.getSession(sessionId);

  if (!result.data) {
    return jsonResource(uri, {
      error: "No active session",
      sessionId,
    });
  }

  return jsonResource(uri, result.data);
}

/**
 * Read the default session resource (`session://current`)
 */
export async function readSessionResource(context: ServerContext): Promise<ReadResourceResult> {
  return readSessionByHandle(context.sessionId, SESSION_RESOURCE_URI, context);
}

/**
 * Read a handle-addressed session URI, or null when the URI is not one.
 */
export async function readTemplatedSessionResource(
  uri: string,
  context: ServerContext
): Promise<ReadResourceResult | null> {
  if (!uri.startsWith("session://") || uri === SESSION_RESOURCE_URI) {
    return null;
  }

  const sessionId = decodeURIComponent(uri.slice("session://".length));
  if (!sessionId) {
    return null;
  }

  return readSessionByHandle(sessionId, uri, context);
}
