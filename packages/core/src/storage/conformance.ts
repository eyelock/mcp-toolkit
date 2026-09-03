/**
 * Storage provider conformance suite
 *
 * One suite every `SessionProvider` must pass, so that swapping a backend
 * cannot quietly change behaviour. Run it against your own provider when
 * implementing one:
 *
 * ```typescript
 * import { runProviderConformanceTests } from "@mcp-toolkit/core/testing";
 * import { createMyProvider } from "./my-provider.js";
 *
 * runProviderConformanceTests("MyProvider", {
 *   createProvider: () => createMyProvider(),
 * });
 * ```
 *
 * This module imports `vitest`, so it is published under the `/testing` subpath
 * rather than from the package root - importing `@mcp-toolkit/core` never pulls
 * a test framework into your runtime.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { SessionProvider } from "./interface.js";

/** Small real delay, so `updatedAt` is observably later than `createdAt` */
async function tick(ms = 10): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ConformanceOptions {
  /** Construct a provider with empty state. Called before every test. */
  createProvider: () => SessionProvider | Promise<SessionProvider>;
  /** Tear down anything the provider left behind. Called after every test. */
  cleanup?: () => void | Promise<void>;
  /**
   * Construct a provider configured to expire sessions after `ttlMs`.
   *
   * Omit if the backend does not implement TTL itself (a Redis double, say,
   * where expiry belongs to the real server) - the expiry tests are then
   * skipped rather than failed.
   */
  createExpiringProvider?: (ttlMs: number) => SessionProvider | Promise<SessionProvider>;
}

/**
 * Register the conformance suite for a provider implementation.
 */
export function runProviderConformanceTests(name: string, options: ConformanceOptions): void {
  describe(`${name} (SessionProvider conformance)`, () => {
    let provider: SessionProvider;

    beforeEach(async () => {
      await options.cleanup?.();
      provider = await options.createProvider();
      return async () => {
        await options.cleanup?.();
      };
    });

    describe("initSession", () => {
      it("mints a handle when none is supplied", async () => {
        const result = await provider.initSession({ projectName: "test-project" });

        expect(result.success).toBe(true);
        expect(result.data?.sessionId).toBeTruthy();
        expect(typeof result.data?.sessionId).toBe("string");
      });

      it("honours a caller-supplied handle", async () => {
        const result = await provider.initSession({ projectName: "test-project" }, "supplied-id");

        expect(result.success).toBe(true);
        expect(result.data?.sessionId).toBe("supplied-id");
      });

      it("mints a distinct handle per session", async () => {
        const first = await provider.initSession({ projectName: "first" });
        const second = await provider.initSession({ projectName: "second" });

        expect(first.data?.sessionId).not.toBe(second.data?.sessionId);
      });

      it("applies feature defaults", async () => {
        const result = await provider.initSession({ projectName: "test-project" });

        expect(result.data?.features).toEqual({
          tools: true,
          resources: true,
          prompts: true,
          sampling: true,
        });
      });

      it("respects explicitly disabled features", async () => {
        const result = await provider.initSession({
          projectName: "test-project",
          features: { prompts: false },
        });

        expect(result.data?.features.prompts).toBe(false);
        expect(result.data?.features.tools).toBe(true);
      });

      it("rejects an invalid project name", async () => {
        const result = await provider.initSession({ projectName: "Not Kebab Case" });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      });

      it("stamps createdAt and updatedAt", async () => {
        const result = await provider.initSession({ projectName: "test-project" });

        expect(result.data?.createdAt).toBe(result.data?.updatedAt);
        expect(() => new Date(result.data?.createdAt ?? "")).not.toThrow();
      });
    });

    describe("getSession", () => {
      it("returns null for an unknown handle", async () => {
        const result = await provider.getSession("does-not-exist");

        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });

      it("round-trips a stored session", async () => {
        const created = await provider.initSession({ projectName: "test-project" });
        const read = await provider.getSession(created.data?.sessionId ?? "");

        expect(read.data?.projectName).toBe("test-project");
        expect(read.data?.sessionId).toBe(created.data?.sessionId);
      });
    });

    describe("multi-session isolation", () => {
      // The behaviour the previous single-session interface could not express,
      // and the whole reason handles exist.
      it("keeps concurrent sessions independent", async () => {
        const alpha = await provider.initSession({ projectName: "alpha" });
        const beta = await provider.initSession({ projectName: "beta" });

        const readAlpha = await provider.getSession(alpha.data?.sessionId ?? "");
        const readBeta = await provider.getSession(beta.data?.sessionId ?? "");

        expect(readAlpha.data?.projectName).toBe("alpha");
        expect(readBeta.data?.projectName).toBe("beta");
      });

      it("scopes updates to the addressed session", async () => {
        const alpha = await provider.initSession({ projectName: "alpha" });
        const beta = await provider.initSession({ projectName: "beta" });

        await provider.updateSession(alpha.data?.sessionId ?? "", { projectName: "alpha-renamed" });

        const readBeta = await provider.getSession(beta.data?.sessionId ?? "");
        expect(readBeta.data?.projectName).toBe("beta");
      });

      it("scopes clears to the addressed session", async () => {
        const alpha = await provider.initSession({ projectName: "alpha" });
        const beta = await provider.initSession({ projectName: "beta" });

        await provider.clearSession(alpha.data?.sessionId ?? "");

        expect(await provider.hasSession(alpha.data?.sessionId ?? "")).toBe(false);
        expect(await provider.hasSession(beta.data?.sessionId ?? "")).toBe(true);
      });
    });

    describe("hasSession", () => {
      it("is false for an unknown handle", async () => {
        expect(await provider.hasSession("does-not-exist")).toBe(false);
      });

      it("is true after init", async () => {
        const created = await provider.initSession({ projectName: "test-project" });

        expect(await provider.hasSession(created.data?.sessionId ?? "")).toBe(true);
      });
    });

    describe("updateSession", () => {
      it("fails for an unknown handle", async () => {
        const result = await provider.updateSession("does-not-exist", {
          projectName: "new-name",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      });

      it("updates a field", async () => {
        const created = await provider.initSession({ projectName: "old-name" });
        const result = await provider.updateSession(created.data?.sessionId ?? "", {
          projectName: "new-name",
        });

        expect(result.success).toBe(true);
        expect(result.data?.projectName).toBe("new-name");
      });

      it("merges features rather than replacing them", async () => {
        const created = await provider.initSession({
          projectName: "test-project",
          features: { tools: true, resources: false },
        });

        const result = await provider.updateSession(created.data?.sessionId ?? "", {
          features: { prompts: false },
        });

        expect(result.data?.features.resources).toBe(false);
        expect(result.data?.features.prompts).toBe(false);
        expect(result.data?.features.tools).toBe(true);
      });

      it("preserves the handle and createdAt, and advances updatedAt", async () => {
        const created = await provider.initSession({ projectName: "test-project" });
        const sessionId = created.data?.sessionId ?? "";

        await tick();
        const result = await provider.updateSession(sessionId, { projectName: "new-name" });

        expect(result.data?.sessionId).toBe(sessionId);
        expect(result.data?.createdAt).toBe(created.data?.createdAt);
        expect(result.data?.updatedAt).not.toBe(created.data?.updatedAt);
      });

      it("rejects an invalid update", async () => {
        const created = await provider.initSession({ projectName: "test-project" });
        const result = await provider.updateSession(created.data?.sessionId ?? "", {
          projectName: "Not Kebab Case",
        });

        expect(result.success).toBe(false);
      });

      it("persists the update", async () => {
        const created = await provider.initSession({ projectName: "old-name" });
        const sessionId = created.data?.sessionId ?? "";

        await provider.updateSession(sessionId, { projectName: "new-name" });
        const read = await provider.getSession(sessionId);

        expect(read.data?.projectName).toBe("new-name");
      });
    });

    describe("clearSession", () => {
      it("removes the session", async () => {
        const created = await provider.initSession({ projectName: "test-project" });
        const sessionId = created.data?.sessionId ?? "";

        const result = await provider.clearSession(sessionId);

        expect(result.success).toBe(true);
        expect(await provider.hasSession(sessionId)).toBe(false);
      });

      it("is idempotent for an unknown handle", async () => {
        const result = await provider.clearSession("does-not-exist");

        expect(result.success).toBe(true);
      });
    });

    describe("expiry", () => {
      it.runIf(options.createExpiringProvider)("treats an expired session as absent", async () => {
        const expiring = await options.createExpiringProvider?.(20);
        if (!expiring) {
          return;
        }

        const created = await expiring.initSession({ projectName: "test-project" });
        const sessionId = created.data?.sessionId ?? "";

        expect(await expiring.hasSession(sessionId)).toBe(true);

        await tick(40);

        expect(await expiring.hasSession(sessionId)).toBe(false);
        const read = await expiring.getSession(sessionId);
        expect(read.data).toBeNull();
      });

      it.runIf(options.createExpiringProvider)("refreshes expiry on update", async () => {
        const expiring = await options.createExpiringProvider?.(60);
        if (!expiring) {
          return;
        }

        const created = await expiring.initSession({ projectName: "test-project" });
        const sessionId = created.data?.sessionId ?? "";

        await tick(40);
        await expiring.updateSession(sessionId, { projectName: "new-name" });
        await tick(40);

        // Without a refresh the session would have died at ~60ms; it is now 80ms old.
        expect(await expiring.hasSession(sessionId)).toBe(true);
      });
    });
  });
}
