/**
 * Storage module - Pluggable storage backends for MCP Toolkit
 *
 * Provides the SessionProvider interface and three implementations:
 *
 * | Provider | Shared across | Dependencies | Use for |
 * |----------|---------------|--------------|---------|
 * | `MemoryProvider` | nothing | none | stdio, tests |
 * | `FileProvider`   | processes on one host | none | single-host HTTP |
 * | `RedisProvider`  | hosts | injected client | production HTTP |
 *
 * Sessions are addressed by an explicit handle on every read and mutate, which
 * is what lets more than one server instance serve the same session - see
 * `interface.ts` for why the `2026-07-28` spec revision requires this.
 */

export * from "./config.js";
export * from "./file.js";
export * from "./interface.js";
export * from "./memory.js";
export * from "./redis.js";
