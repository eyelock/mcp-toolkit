/**
 * CLI session storage
 *
 * The CLI is a single-user, single-session context, so it operates on one
 * well-known handle rather than minting a new one per invocation. That is an
 * application-level decision the stateless protocol explicitly allows: state is
 * addressed by an explicit handle, and here the handle is a constant.
 *
 * Backed by `FileProvider` so that state survives between invocations - a fresh
 * `MemoryProvider` per command could never see what the previous command wrote.
 */

import { createFileProvider, type SessionProvider } from "@mcp-toolkit/core";

/**
 * The handle the CLI stores its session under.
 */
export const CLI_SESSION_ID = "cli";

/**
 * Create the provider backing CLI commands.
 *
 * @param directory - Override the session directory (used by tests)
 */
export function createCliProvider(directory?: string): SessionProvider {
  return createFileProvider(directory ? { directory } : {});
}
