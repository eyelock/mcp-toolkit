/**
 * Progress Notification Utilities Tests
 */

import { describe, expect, it, vi } from "vitest";
import {
  ProgressError,
  ProgressReporter,
  createProgressReporter,
  processWithProgress,
} from "./progress.js";
import { CancellationError } from "./cancellation.js";

describe("ProgressError", () => {
  it("creates error with message", () => {
    const error = new ProgressError("Progress must increase");
    expect(error.message).toBe("Progress must increase");
    expect(error.name).toBe("ProgressError");
  });

  it("is instanceof Error", () => {
    const error = new ProgressError("test");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("ProgressReporter", () => {
  describe("when disabled", () => {
    it("is disabled when server is null", () => {
      const reporter = new ProgressReporter(null, "token");
      expect(reporter.isEnabled).toBe(false);
    });

    it("is disabled when progressToken is undefined", () => {
      const mockServer = { server: { notification: vi.fn() } };
      const reporter = new ProgressReporter(mockServer as never, undefined);
      expect(reporter.isEnabled).toBe(false);
    });

    it("report does nothing when disabled", async () => {
      const reporter = new ProgressReporter(null, "token");
      await expect(reporter.report({ progress: 1 })).resolves.toBeUndefined();
    });

    it("complete does nothing when disabled", async () => {
      const reporter = new ProgressReporter(null, "token");
      await expect(reporter.complete()).resolves.toBeUndefined();
    });
  });

  describe("when enabled", () => {
    it("is enabled when server and token are provided", () => {
      const mockServer = { server: { notification: vi.fn() } };
      const reporter = new ProgressReporter(mockServer as never, "token-123");
      expect(reporter.isEnabled).toBe(true);
    });

    it("sends notification on report", async () => {
      const notification = vi.fn().mockResolvedValue(undefined);
      const mockServer = { server: { notification } };
      const reporter = new ProgressReporter(mockServer as never, "token-123");

      await reporter.report({ progress: 1, total: 10, message: "Processing..." });

      expect(notification).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token-123",
          progress: 1,
          total: 10,
          message: "Processing...",
        },
      });
    });

    it("throws ProgressError if progress does not increase", async () => {
      const mockServer = { server: { notification: vi.fn() } };
      const reporter = new ProgressReporter(mockServer as never, "token");

      await reporter.report({ progress: 5 });
      await expect(reporter.report({ progress: 3 })).rejects.toThrow(ProgressError);
    });

    it("throws ProgressError if progress is same", async () => {
      const mockServer = { server: { notification: vi.fn() } };
      const reporter = new ProgressReporter(mockServer as never, "token");

      await reporter.report({ progress: 5 });
      await expect(reporter.report({ progress: 5 })).rejects.toThrow(ProgressError);
    });

    it("handles notification errors silently", async () => {
      const notification = vi.fn().mockRejectedValue(new Error("Network error"));
      const mockServer = { server: { notification } };
      const reporter = new ProgressReporter(mockServer as never, "token");

      // Should not throw
      await expect(reporter.report({ progress: 1 })).resolves.toBeUndefined();
    });
  });

  describe("reportPercentage", () => {
    it("reports with 1-based indexing", async () => {
      const notification = vi.fn().mockResolvedValue(undefined);
      const mockServer = { server: { notification } };
      const reporter = new ProgressReporter(mockServer as never, "token");

      await reporter.reportPercentage(0, 10, "First item");

      expect(notification).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token",
          progress: 1, // 0 + 1 = 1 (1-based)
          total: 10,
          message: "First item",
        },
      });
    });
  });

  describe("complete", () => {
    it("sends final progress with default message", async () => {
      const notification = vi.fn().mockResolvedValue(undefined);
      const mockServer = { server: { notification } };
      const reporter = new ProgressReporter(mockServer as never, "token");

      await reporter.report({ progress: 5 });
      await reporter.complete();

      expect(notification).toHaveBeenLastCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token",
          progress: 6,
          total: undefined,
          message: "Complete",
        },
      });
    });

    it("sends final progress with custom message", async () => {
      const notification = vi.fn().mockResolvedValue(undefined);
      const mockServer = { server: { notification } };
      const reporter = new ProgressReporter(mockServer as never, "token");

      await reporter.report({ progress: 1 });
      await reporter.complete("All done!");

      expect(notification).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            message: "All done!",
          }),
        })
      );
    });
  });
});

describe("createProgressReporter", () => {
  it("creates disabled reporter when server is null", () => {
    const reporter = createProgressReporter(null);
    expect(reporter.isEnabled).toBe(false);
  });

  it("creates disabled reporter when no extra", () => {
    const mockServer = { server: { notification: vi.fn() } };
    const reporter = createProgressReporter(mockServer as never);
    expect(reporter.isEnabled).toBe(false);
  });

  it("creates disabled reporter when no progressToken", () => {
    const mockServer = { server: { notification: vi.fn() } };
    const reporter = createProgressReporter(mockServer as never, { _meta: {} });
    expect(reporter.isEnabled).toBe(false);
  });

  it("creates enabled reporter with progressToken", () => {
    const mockServer = { server: { notification: vi.fn() } };
    const reporter = createProgressReporter(mockServer as never, {
      _meta: { progressToken: "my-token" },
    });
    expect(reporter.isEnabled).toBe(true);
  });
});

describe("processWithProgress", () => {
  it("processes all items and returns results", async () => {
    const reporter = new ProgressReporter(null, undefined);
    const items = [1, 2, 3];

    const results = await processWithProgress(items, async (item) => item * 2, reporter);

    expect(results).toEqual([2, 4, 6]);
  });

  it("reports progress for each item by default", async () => {
    const notification = vi.fn().mockResolvedValue(undefined);
    const mockServer = { server: { notification } };
    const reporter = new ProgressReporter(mockServer as never, "token");

    await processWithProgress(["a", "b", "c"], async (item) => item, reporter);

    // Should report 3 times (once per item)
    expect(notification).toHaveBeenCalledTimes(3);
  });

  it("respects reportInterval option", async () => {
    const notification = vi.fn().mockResolvedValue(undefined);
    const mockServer = { server: { notification } };
    const reporter = new ProgressReporter(mockServer as never, "token");

    await processWithProgress([1, 2, 3, 4, 5], async (item) => item, reporter, {
      reportInterval: 2,
    });

    // Reports at: 2, 4, 5 (last item always reported)
    expect(notification).toHaveBeenCalledTimes(3);
  });

  it("uses custom message generator", async () => {
    const notification = vi.fn().mockResolvedValue(undefined);
    const mockServer = { server: { notification } };
    const reporter = new ProgressReporter(mockServer as never, "token");

    await processWithProgress(["file1.txt", "file2.txt"], async (item) => item, reporter, {
      messageGenerator: (_i, _t, item) => `Processing ${item}`,
    });

    expect(notification).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          message: "Processing file1.txt",
        }),
      })
    );
  });

  it("throws CancellationError when signal aborted", async () => {
    const reporter = new ProgressReporter(null, undefined);
    const controller = new AbortController();
    controller.abort("user cancelled");

    await expect(
      processWithProgress([1, 2, 3], async (item) => item, reporter, {
        signal: controller.signal,
      })
    ).rejects.toThrow(CancellationError);
  });

  it("cancels mid-processing when signal aborted", async () => {
    const reporter = new ProgressReporter(null, undefined);
    const controller = new AbortController();
    let processed = 0;

    await expect(
      processWithProgress(
        [1, 2, 3, 4, 5],
        async (item) => {
          processed++;
          if (processed === 2) {
            controller.abort();
          }
          return item;
        },
        reporter,
        { signal: controller.signal }
      )
    ).rejects.toThrow(CancellationError);

    expect(processed).toBe(2);
  });
});
