/**
 * File Provider - JSON-on-disk session storage with no external dependencies
 *
 * Sessions are shared across every process on one host, which is the smallest
 * useful step beyond `MemoryProvider`: two server instances on the same machine
 * resolve each other's handles, so the HTTP transport stops depending on sticky
 * routing.
 *
 * ## Design notes
 *
 * - **One file per session.** Concurrent writers touch different files, so
 *   ordinary use needs no lock.
 * - **Atomic writes.** Content goes to a temp file and is then `rename`d into
 *   place. `rename` is atomic within a filesystem, so a reader never observes a
 *   half-written session even if a writer dies mid-flight.
 * - **Expiry swept on read.** No background timer, nothing to leak, and safe in
 *   a runtime that may freeze between requests.
 *
 * For multiple *hosts*, use `RedisProvider`.
 */

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SessionConfig, SessionCreateInput, SessionUpdateInput } from "@mcp-toolkit/model";
import {
  applySessionUpdate,
  buildSessionConfig,
  computeExpiry,
  isExpired,
  type SessionRecord,
  toErrorMessage,
} from "./config.js";
import type { ProviderOptions, ProviderResult, SessionProvider } from "./interface.js";

/** Default location for session files, relative to the working directory */
export const DEFAULT_SESSION_DIR = ".mcp-toolkit/sessions";

export interface FileProviderOptions extends ProviderOptions {
  /** Directory to store session files in (default: `.mcp-toolkit/sessions`) */
  directory?: string;
}

/**
 * Reject anything that could escape the session directory.
 *
 * Handles are server-minted UUIDs in normal operation, but under the stateless
 * protocol they arrive as tool arguments - which makes them untrusted input that
 * reaches a filesystem path. Validate rather than trust.
 */
function assertSafeSessionId(sessionId: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
    throw new Error("Invalid session id: expected 1-128 characters matching [A-Za-z0-9_-]");
  }
}

export class FileProvider implements SessionProvider {
  readonly name = "file";
  private readonly directory: string;
  private readonly ttlMs?: number;

  constructor(options: FileProviderOptions = {}) {
    this.directory = resolve(options.directory ?? DEFAULT_SESSION_DIR);
    this.ttlMs = options.ttlMs;
  }

  private pathFor(sessionId: string): string {
    assertSafeSessionId(sessionId);
    return join(this.directory, `${sessionId}.json`);
  }

  private async write(record: SessionRecord): Promise<void> {
    await mkdir(this.directory, { recursive: true });

    const target = this.pathFor(record.config.sessionId);
    // Unique temp name so concurrent writers to the same session cannot collide
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;

    await writeFile(temp, JSON.stringify(record, null, 2), "utf8");
    try {
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  /**
   * Read a live record, deleting it if it has expired.
   */
  private async read(sessionId: string): Promise<SessionRecord | null> {
    let raw: string;
    try {
      raw = await readFile(this.pathFor(sessionId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }

    let record: SessionRecord;
    try {
      record = JSON.parse(raw) as SessionRecord;
    } catch {
      // A corrupt file is indistinguishable from no session, and keeping it
      // would poison every future read. Drop it.
      await rm(this.pathFor(sessionId), { force: true });
      return null;
    }

    if (isExpired(record)) {
      await rm(this.pathFor(sessionId), { force: true });
      return null;
    }

    return record;
  }

  async initSession(
    input: SessionCreateInput,
    sessionId?: string
  ): Promise<ProviderResult<SessionConfig>> {
    try {
      const config = buildSessionConfig(input, sessionId);
      await this.write({ config, expiresAt: computeExpiry(this.ttlMs) });
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to initialize session"),
      };
    }
  }

  async getSession(sessionId: string): Promise<ProviderResult<SessionConfig | null>> {
    try {
      const record = await this.read(sessionId);
      return { success: true, data: record?.config ?? null };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to read session"),
      };
    }
  }

  async updateSession(
    sessionId: string,
    input: SessionUpdateInput
  ): Promise<ProviderResult<SessionConfig>> {
    try {
      const record = await this.read(sessionId);
      if (!record) {
        return { success: false, error: "No session to update" };
      }

      const updated = applySessionUpdate(record.config, input);
      await this.write({ config: updated, expiresAt: computeExpiry(this.ttlMs) });
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to update session"),
      };
    }
  }

  async clearSession(sessionId: string): Promise<ProviderResult<void>> {
    try {
      await rm(this.pathFor(sessionId), { force: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to clear session"),
      };
    }
  }

  async hasSession(sessionId: string): Promise<boolean> {
    try {
      return (await this.read(sessionId)) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Delete every expired session file.
   *
   * Read-time sweeping only reclaims sessions someone asks for; a session that
   * is never requested again would linger forever. Call this periodically from a
   * long-lived process, or from a cron job, to bound disk use.
   *
   * @returns Number of sessions removed
   */
  async sweepExpired(): Promise<number> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return 0;
      }
      throw error;
    }

    let removed = 0;
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      // read() deletes on expiry, so a null result for a file that existed
      // means it was swept.
      const sessionId = entry.slice(0, -".json".length);
      try {
        if ((await this.read(sessionId)) === null) {
          removed++;
        }
      } catch {
        // Skip unreadable entries rather than aborting the whole sweep
      }
    }
    return removed;
  }
}

/**
 * Factory function for creating a file provider
 */
export function createFileProvider(options: FileProviderOptions = {}): SessionProvider {
  return new FileProvider(options);
}
