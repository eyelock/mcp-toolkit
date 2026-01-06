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
 *   mcp-toolkit --dev                        # adds env=development tag
 *   mcp-toolkit --tag env=staging --tag team=platform
 *
 * Environment Variables:
 *   MCP_TAGS - Comma-separated tags (e.g., "env=development,team=platform")
 */

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
const VERSION = "0.0.0";

/**
 * Parse tags from CLI arguments and environment variable.
 * CLI tags take precedence over environment tags.
 *
 * @param args - CLI arguments
 * @returns Merged tags object
 */
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

  const server = createServer({
    name: CANONICAL_NAME,
    version: VERSION,
    identity: {
      canonicalName: CANONICAL_NAME,
      tags,
    },
  });

  if (options.mode === "http") {
    await createHttpTransport(server, options.httpConfig);
  } else {
    await createStdioTransport(server);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Re-export for library usage
export { createServer } from "./server.js";
export type { ServerConfig, ServerContext } from "./server.js";
export * from "./transport/index.js";
