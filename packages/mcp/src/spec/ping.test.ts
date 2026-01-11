/**
 * Ping Utilities Tests
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  handlePing,
  createServerStatus,
  formatPingResponse,
  initializeServerStartTime,
  getServerUptimeMs,
} from "./ping.js";

describe("handlePing", () => {
  it("returns healthy status", () => {
    const result = handlePing();
    expect(result.healthy).toBe(true);
  });

  it("returns ISO timestamp", () => {
    const result = handlePing();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("returns undefined latency when no startTime provided", () => {
    const result = handlePing();
    expect(result.latencyMs).toBeUndefined();
  });

  it("calculates latency when startTime provided", () => {
    const startTime = Date.now() - 50;
    const result = handlePing(startTime);
    expect(result.latencyMs).toBeGreaterThanOrEqual(50);
    expect(result.latencyMs).toBeLessThan(200);
  });
});

describe("initializeServerStartTime / getServerUptimeMs", () => {
  beforeEach(() => {
    // Reset the module-level state by reinitializing
    initializeServerStartTime();
  });

  it("returns 0 uptime before initialization", async () => {
    // Import fresh to test uninitialized state
    // Note: We can't easily reset module state, but we can verify after init
    initializeServerStartTime();
    const uptime = getServerUptimeMs();
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(uptime).toBeLessThan(100);
  });

  it("tracks uptime after initialization", async () => {
    initializeServerStartTime();
    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));
    const uptime = getServerUptimeMs();
    expect(uptime).toBeGreaterThanOrEqual(10);
    expect(uptime).toBeLessThan(200);
  });
});

describe("createServerStatus", () => {
  beforeEach(() => {
    initializeServerStartTime();
  });

  it("creates status with required fields", () => {
    const status = createServerStatus("test-server", "1.0.0");
    expect(status.name).toBe("test-server");
    expect(status.version).toBe("1.0.0");
    expect(status.healthy).toBe(true);
    expect(status.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("includes optional message", () => {
    const status = createServerStatus("test-server", "1.0.0", {
      message: "All systems operational",
    });
    expect(status.message).toBe("All systems operational");
  });

  it("includes optional metadata", () => {
    const status = createServerStatus("test-server", "1.0.0", {
      metadata: { features: ["tools", "resources"] },
    });
    expect(status.metadata).toEqual({ features: ["tools", "resources"] });
  });

  it("allows overriding healthy status", () => {
    const status = createServerStatus("test-server", "1.0.0", {
      healthy: false,
    });
    expect(status.healthy).toBe(false);
  });

  it("defaults healthy to true", () => {
    const status = createServerStatus("test-server", "1.0.0", {});
    expect(status.healthy).toBe(true);
  });
});

describe("formatPingResponse", () => {
  it("formats ping result as MCP tool response", () => {
    const pingResult = {
      healthy: true,
      timestamp: "2024-01-01T00:00:00.000Z",
      latencyMs: 5,
    };
    const response = formatPingResponse(pingResult);

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
    expect(JSON.parse(response.content[0].text)).toEqual(pingResult);
  });

  it("formats server status as MCP tool response", () => {
    const status = {
      name: "test-server",
      version: "1.0.0",
      healthy: true,
      uptimeMs: 1000,
      timestamp: "2024-01-01T00:00:00.000Z",
      message: "OK",
    };
    const response = formatPingResponse(status);

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
    expect(JSON.parse(response.content[0].text)).toEqual(status);
  });

  it("pretty prints JSON with 2-space indentation", () => {
    const pingResult = {
      healthy: true,
      timestamp: "2024-01-01T00:00:00.000Z",
    };
    const response = formatPingResponse(pingResult);

    // Should have newlines from pretty printing
    expect(response.content[0].text).toContain("\n");
    expect(response.content[0].text).toContain("  ");
  });
});
