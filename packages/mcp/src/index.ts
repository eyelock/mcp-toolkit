#!/usr/bin/env node
/**
 * MCP Toolkit Server Entry Point
 *
 * Supports multiple transport modes:
 * - stdio (default): For local development and MCP inspector
 * - http: For remote deployment with SSE
 *
 * Usage:
 *   mcp-toolkit                              # stdio mode (default)
 *   mcp-toolkit --stdio                      # explicit stdio mode
 *   mcp-toolkit --http                       # HTTP mode on port 3000
 *   mcp-toolkit --http --port 8080 --host 0.0.0.0
 *   mcp-toolkit --http --token secret123
 *   mcp-toolkit --http --allow-origin https://app.example.com
 *   mcp-toolkit --modern-only                # refuse 2025-era clients
 *   mcp-toolkit --http --storage file        # share sessions across instances
 *   mcp-toolkit --http --storage file --storage-dir /var/lib/mcp
 *   mcp-toolkit --dev                        # adds env=development tag
 *   mcp-toolkit --tag env=staging --tag team=platform
 *
 * Environment Variables:
 *   MCP_TAGS - Comma-separated tags (e.g., "env=development,team=platform")
 */

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createFileProvider, createMemoryProvider, type SessionProvider } from "@mcp-toolkit/core";
import type { ServerTags } from "@mcp-toolkit/model";
import { createServer } from "./server.js";
import {
  createHttpTransport,
  createStdioTransport,
  parseTransportArgs,
} from "./transport/index.js";

// =============================================================================
// Server Identity Configuration
// =============================================================================
// Change this value when setting up your MCP server project.
// This canonical name identifies this server across all installations.
const CANONICAL_NAME = "mcp-toolkit";

// Read version from package.json
const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };

/**
 * Parse tags from CLI arguments and environment variable.
 * CLI tags take precedence over environment tags.
 *
 * @param args - CLI arguments
 * @returns Merged tags object
 */
/**
 * Choose the session store.
 *
 * Memory is the default because it needs nothing, and it is correct for stdio -
 * one process owns the conversation. Over HTTP it is a footgun: sessions live in
 * one process's heap, so a second replica cannot see them. We warn rather than
 * silently switching, since a surprising default is worse than an explicit one.
 */
function parseStorage(args: string[], mode: string): SessionProvider {
  const kindIndex = args.indexOf("--storage");
  const kind = kindIndex !== -1 ? args[kindIndex + 1] : "memory";

  if (kind === "file") {
    const dirIndex = args.indexOf("--storage-dir");
    const directory = dirIndex !== -1 ? args[dirIndex + 1] : undefined;
    return createFileProvider(directory ? { directory } : {});
  }

  if (kind !== "memory") {
    console.error(`[mcp-toolkit] Unknown --storage "${kind}"; falling back to memory.`);
  }

  if (mode === "http") {
    console.error(
      "[mcp-toolkit] Using in-memory sessions over HTTP: correct for a single instance only. " +
        "Pass --storage file to share sessions across processes, or supply a RedisProvider " +
        "for multiple hosts."
    );
  }

  return createMemoryProvider();
}

function parseTags(args: string[]): ServerTags {
  const tags: ServerTags = {};

  // Parse from MCP_TAGS environment variable first (lower precedence)
  const envTags = process.env.MCP_TAGS;
  if (envTags) {
    for (const pair of envTags.split(",")) {
      const trimmed = pair.trim();
      if (trimmed) {
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1);
          tags[key] = value;
        }
      }
    }
  }

  // Parse --tag key=value from CLI (higher precedence, overwrites env)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === "--tag" && nextArg !== undefined) {
      const eqIndex = nextArg.indexOf("=");
      if (eqIndex > 0) {
        const key = nextArg.slice(0, eqIndex);
        const value = nextArg.slice(eqIndex + 1);
        tags[key] = value;
      }
      i++; // Skip the value argument
    }
  }

  // --dev is a convenience flag that adds env=development
  if (args.includes("--dev")) {
    tags.env = "development";
  }

  return tags;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseTransportArgs(args);
  const tags = parseTags(args);

  // A factory, not an instance: the stateless protocol lets the SDK build a
  // server per request, which is what allows requests to be spread across
  // instances without sticky routing.
  // One provider, shared by every server the factory builds - that is what
  // makes the instances interchangeable.
  const provider = parseStorage(args, options.mode);

  // stdio serves one conversation per process, so a process-wide default handle
  // is correct there and saves the model from threading session_id on every
  // call. HTTP gets no default: any instance may serve any request, so the
  // handle has to travel *in* the request or it means nothing.
  const defaultSessionId = options.mode === "stdio" ? randomUUID() : undefined;

  const factory = () =>
    createServer({
      name: CANONICAL_NAME,
      version: VERSION,
      provider,
      defaultSessionId,
      identity: {
        canonicalName: CANONICAL_NAME,
        tags,
      },
    });

  if (options.mode === "http") {
    await createHttpTransport(factory, {
      ...options.httpConfig,
      rejectLegacy: options.rejectLegacy,
    });
  } else {
    await createStdioTransport(factory, { rejectLegacy: options.rejectLegacy });
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Hooks system
export * from "./hooks/index.js";
export type { CreateServerResult, ServerConfig, ServerContext } from "./server.js";
// Re-export for library usage
export { createServer, getSessionEndHooks, getSessionStartHooks } from "./server.js";

// MCP Specification implementations
export * from "./spec/index.js";
export * from "./transport/index.js";
