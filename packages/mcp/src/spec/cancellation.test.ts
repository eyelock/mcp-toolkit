/**
 * Cancellation Utilities Tests
 */

import { describe, expect, it } from "vitest";
import {
  CancellationError,
  checkCancelled,
  createLinkedAbortController,
  isCancelled,
  withCancellation,
} from "./cancellation.js";

describe("CancellationError", () => {
  it("creates error with default message", () => {
    const error = new CancellationError();
    expect(error.message).toBe("Operation was cancelled");
    expect(error.name).toBe("CancellationError");
  });

  it("creates error with custom reason", () => {
    const error = new CancellationError("User requested cancellation");
    expect(error.message).toBe("User requested cancellation");
  });

  it("is instanceof Error", () => {
    const error = new CancellationError();
    expect(error).toBeInstanceOf(Error);
  });
});

describe("checkCancelled", () => {
  it("does nothing when signal is undefined", () => {
    expect(() => checkCancelled(undefined)).not.toThrow();
  });

  it("does nothing when signal is not aborted", () => {
    const controller = new AbortController();
    expect(() => checkCancelled(controller.signal)).not.toThrow();
  });

  it("throws CancellationError when signal is aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => checkCancelled(controller.signal)).toThrow(CancellationError);
  });

  it("includes reason in error when abort has string reason", () => {
    const controller = new AbortController();
    controller.abort("timeout");
    try {
      checkCancelled(controller.signal);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CancellationError);
      expect((error as CancellationError).message).toBe("timeout");
    }
  });

  it("uses default message when reason is not a string", () => {
    const controller = new AbortController();
    controller.abort({ code: 123 });
    try {
      checkCancelled(controller.signal);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CancellationError);
      expect((error as CancellationError).message).toBe("Operation was cancelled");
    }
  });
});

describe("isCancelled", () => {
  it("returns false when signal is undefined", () => {
    expect(isCancelled(undefined)).toBe(false);
  });

  it("returns false when signal is not aborted", () => {
    const controller = new AbortController();
    expect(isCancelled(controller.signal)).toBe(false);
  });

  it("returns true when signal is aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(isCancelled(controller.signal)).toBe(true);
  });
});

describe("createLinkedAbortController", () => {
  it("creates standalone controller when no parent signal", () => {
    const controller = createLinkedAbortController(undefined);
    expect(controller.signal.aborted).toBe(false);
  });

  it("immediately aborts if parent is already aborted", () => {
    const parent = new AbortController();
    parent.abort("parent cancelled");

    const linked = createLinkedAbortController(parent.signal);
    expect(linked.signal.aborted).toBe(true);
    expect(linked.signal.reason).toBe("parent cancelled");
  });

  it("aborts when parent aborts later", () => {
    const parent = new AbortController();
    const linked = createLinkedAbortController(parent.signal);

    expect(linked.signal.aborted).toBe(false);

    parent.abort("delayed cancel");

    expect(linked.signal.aborted).toBe(true);
    expect(linked.signal.reason).toBe("delayed cancel");
  });

  it("can be aborted independently of parent", () => {
    const parent = new AbortController();
    const linked = createLinkedAbortController(parent.signal);

    linked.abort("child cancelled");

    expect(linked.signal.aborted).toBe(true);
    expect(parent.signal.aborted).toBe(false);
  });
});

describe("withCancellation", () => {
  it("runs operation when not cancelled", async () => {
    const result = await withCancellation(undefined, async () => {
      return "success";
    });
    expect(result).toBe("success");
  });

  it("throws before operation if already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      withCancellation(controller.signal, async () => {
        return "should not run";
      })
    ).rejects.toThrow(CancellationError);
  });

  it("throws after operation if cancelled during", async () => {
    const controller = new AbortController();

    await expect(
      withCancellation(controller.signal, async () => {
        controller.abort();
        return "completed";
      })
    ).rejects.toThrow(CancellationError);
  });

  it("returns result when completed without cancellation", async () => {
    const controller = new AbortController();

    const result = await withCancellation(controller.signal, async () => {
      return { data: "test" };
    });

    expect(result).toEqual({ data: "test" });
  });
});
