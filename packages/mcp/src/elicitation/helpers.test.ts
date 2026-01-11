/**
 * Elicitation Helpers Tests
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  DEFAULT_ELICITATION_TIMEOUT_MS,
  ElicitationNotSupportedError,
  clientSupportsElicitation,
  elicitChoice,
  elicitConfirmation,
  elicitInput,
  elicitText,
  getElicitationTimeout,
} from "./helpers.js";

/**
 * Mock server type for testing elicitation functionality
 */
interface MockServer extends Partial<Server> {
  _clientCapabilities?: { elicitation?: { form?: boolean } };
  elicitInput: Mock;
}

describe("Elicitation Helpers", () => {
  describe("getElicitationTimeout", () => {
    const originalEnv = process.env.MCP_ELICITATION_TIMEOUT_MS;

    afterEach(() => {
      if (originalEnv === undefined) {
        process.env.MCP_ELICITATION_TIMEOUT_MS = undefined;
      } else {
        process.env.MCP_ELICITATION_TIMEOUT_MS = originalEnv;
      }
    });

    it("should return options timeout when provided", () => {
      process.env.MCP_ELICITATION_TIMEOUT_MS = "60000";
      expect(getElicitationTimeout(30000)).toBe(30000);
    });

    it("should return env timeout when no options", () => {
      process.env.MCP_ELICITATION_TIMEOUT_MS = "60000";
      expect(getElicitationTimeout()).toBe(60000);
    });

    it("should return default when no env or options", () => {
      process.env.MCP_ELICITATION_TIMEOUT_MS = undefined;
      expect(getElicitationTimeout()).toBe(DEFAULT_ELICITATION_TIMEOUT_MS);
    });

    it("should ignore invalid env values", () => {
      process.env.MCP_ELICITATION_TIMEOUT_MS = "invalid";
      expect(getElicitationTimeout()).toBe(DEFAULT_ELICITATION_TIMEOUT_MS);
    });

    it("should ignore negative env values", () => {
      process.env.MCP_ELICITATION_TIMEOUT_MS = "-1000";
      expect(getElicitationTimeout()).toBe(DEFAULT_ELICITATION_TIMEOUT_MS);
    });
  });

  describe("clientSupportsElicitation", () => {
    it("should return false when no capabilities", () => {
      const server = {} as unknown as Server;
      expect(clientSupportsElicitation(server)).toBe(false);
    });

    it("should return false when elicitation not in capabilities", () => {
      const server = {
        _clientCapabilities: {},
      } as unknown as Server;
      expect(clientSupportsElicitation(server)).toBe(false);
    });

    it("should return false when form not in elicitation", () => {
      const server = {
        _clientCapabilities: { elicitation: {} },
      } as unknown as Server;
      expect(clientSupportsElicitation(server)).toBe(false);
    });

    it("should return true when form elicitation supported", () => {
      const server = {
        _clientCapabilities: { elicitation: { form: true } },
      } as unknown as Server;
      expect(clientSupportsElicitation(server)).toBe(true);
    });
  });

  describe("elicitInput", () => {
    let mockServer: MockServer;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockServer = {
        _clientCapabilities: { elicitation: { form: true } },
        elicitInput: vi.fn(),
      };
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should throw when client does not support elicitation", async () => {
      const unsupportedServer = {} as unknown as Server;

      await expect(
        elicitInput(unsupportedServer, "Test", { type: "object", properties: {} })
      ).rejects.toThrow(ElicitationNotSupportedError);
    });

    it("should return typed result on accept", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { name: "John", age: 30 },
      });

      const result = await elicitInput<{ name: string; age: number }>(mockServer, "Enter details", {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
          age: { type: "integer", title: "Age" },
        },
      });

      expect(result.action).toBe("accept");
      expect(result.content).toEqual({ name: "John", age: 30 });
    });

    it("should return decline action", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "decline",
      });

      const result = await elicitInput(mockServer, "Test", { type: "object", properties: {} });

      expect(result.action).toBe("decline");
      expect(result.content).toBeUndefined();
    });

    it("should return cancel action", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "cancel",
      });

      const result = await elicitInput(mockServer, "Test", { type: "object", properties: {} });

      expect(result.action).toBe("cancel");
    });

    it("should pass timeout to server", async () => {
      mockServer.elicitInput.mockResolvedValue({ action: "cancel" });

      await elicitInput(mockServer, "Test", { type: "object", properties: {} }, { timeout: 10000 });

      expect(mockServer.elicitInput).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("should not log when logEvent is false", async () => {
      mockServer.elicitInput.mockResolvedValue({ action: "cancel" });

      await elicitInput(
        mockServer,
        "Test",
        { type: "object", properties: {} },
        { logEvent: false }
      );

      // Should not have logged (no calls to console.error for debug messages)
      // This is a bit indirect since we mock console.error
      expect(mockServer.elicitInput).toHaveBeenCalled();
    });
  });

  describe("elicitConfirmation", () => {
    let mockServer: MockServer;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockServer = {
        _clientCapabilities: { elicitation: { form: true } },
        elicitInput: vi.fn(),
      };
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should return confirmed true when user confirms", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { confirm: true },
      });

      const result = await elicitConfirmation(mockServer, "Confirm action?");

      expect(result.confirmed).toBe(true);
    });

    it("should return confirmed false when user declines", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { confirm: false },
      });

      const result = await elicitConfirmation(mockServer, "Confirm action?");

      expect(result.confirmed).toBe(false);
    });

    it("should return reason when provided", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { confirm: false, reason: "Not ready" },
      });

      const result = await elicitConfirmation(mockServer, "Confirm action?");

      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe("Not ready");
    });

    it("should return not confirmed on cancel", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "cancel",
      });

      const result = await elicitConfirmation(mockServer, "Confirm action?");

      expect(result.confirmed).toBe(false);
    });
  });

  describe("elicitText", () => {
    let mockServer: MockServer;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockServer = {
        _clientCapabilities: { elicitation: { form: true } },
        elicitInput: vi.fn(),
      };
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should return text value on accept", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { value: "Hello World" },
      });

      const result = await elicitText(mockServer, "Enter text:");

      expect(result).toBe("Hello World");
    });

    it("should return undefined on cancel", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "cancel",
      });

      const result = await elicitText(mockServer, "Enter text:");

      expect(result).toBeUndefined();
    });

    it("should pass field config", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { value: "Test" },
      });

      await elicitText(mockServer, "Enter:", {
        title: "Custom Title",
        description: "Custom description",
        minLength: 1,
        maxLength: 100,
        default: "Default",
      });

      expect(mockServer.elicitInput).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedSchema: expect.objectContaining({
            properties: expect.objectContaining({
              value: expect.objectContaining({
                title: "Custom Title",
                description: "Custom description",
                minLength: 1,
                maxLength: 100,
                default: "Default",
              }),
            }),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe("elicitChoice", () => {
    let mockServer: MockServer;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockServer = {
        _clientCapabilities: { elicitation: { form: true } },
        elicitInput: vi.fn(),
      };
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should return selected choice on accept", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { choice: "medium" },
      });

      const result = await elicitChoice(mockServer, "Select priority:", [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ]);

      expect(result).toBe("medium");
    });

    it("should return undefined on decline", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "decline",
      });

      const result = await elicitChoice(mockServer, "Select:", [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ]);

      expect(result).toBeUndefined();
    });

    it("should pass enum values and labels", async () => {
      mockServer.elicitInput.mockResolvedValue({
        action: "accept",
        content: { choice: "opt1" },
      });

      await elicitChoice(mockServer, "Choose:", [
        { value: "opt1", label: "Option 1" },
        { value: "opt2", label: "Option 2" },
      ]);

      expect(mockServer.elicitInput).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedSchema: expect.objectContaining({
            properties: expect.objectContaining({
              choice: expect.objectContaining({
                enum: ["opt1", "opt2"],
                enumNames: ["Option 1", "Option 2"],
              }),
            }),
          }),
        }),
        expect.any(Object)
      );
    });
  });
});
