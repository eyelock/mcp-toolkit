/**
 * Client Discovery Tests
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_DISCOVERY_TIMEOUT_MS,
  createClientDiscoveryRequest,
  discoverClientMetadata,
  parseClientDiscoveryResponse,
} from "./client-discovery.js";

describe("Client Discovery", () => {
  describe("parseClientDiscoveryResponse", () => {
    it("parses valid JSON response", () => {
      const response = JSON.stringify({
        clientName: "claude-desktop",
        clientVersion: "1.0.0",
        model: "claude-opus-4-5-20251101",
        modelProvider: "anthropic",
        capabilities: {
          supportsStreaming: true,
          supportsImages: true,
          supportsFunctionCalling: true,
        },
      });

      const result = parseClientDiscoveryResponse(response);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("claude-desktop");
      expect(result?.model).toBe("claude-opus-4-5-20251101");
      expect(result?.modelProvider).toBe("anthropic");
    });

    it("parses JSON wrapped in markdown code block", () => {
      const response = `\`\`\`json
{
  "clientName": "cursor",
  "model": "gpt-4-turbo",
  "modelProvider": "openai"
}
\`\`\``;

      const result = parseClientDiscoveryResponse(response);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("cursor");
      expect(result?.model).toBe("gpt-4-turbo");
    });

    it("parses JSON wrapped in plain code block", () => {
      const response = `\`\`\`
{
  "clientName": "vscode",
  "model": "claude-sonnet-4-20250514"
}
\`\`\``;

      const result = parseClientDiscoveryResponse(response);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("vscode");
    });

    it("handles minimal valid response", () => {
      const response = JSON.stringify({
        clientName: "test-client",
      });

      const result = parseClientDiscoveryResponse(response);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("test-client");
    });

    it("returns null for invalid JSON", () => {
      const result = parseClientDiscoveryResponse("not valid json");

      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      const result = parseClientDiscoveryResponse("");

      expect(result).toBeNull();
    });

    it("accepts empty object (all fields optional in schema)", () => {
      // ClientMetadataSchema has all fields optional
      const response = JSON.stringify({});

      const result = parseClientDiscoveryResponse(response);

      // Empty object is valid since all fields are optional
      expect(result).toEqual({});
    });

    it("strips unknown fields", () => {
      const response = JSON.stringify({
        clientName: "test",
        unknownField: "should be stripped",
      });

      const result = parseClientDiscoveryResponse(response);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("test");
      expect(result).not.toHaveProperty("unknownField");
    });

    it("returns null for invalid field types", () => {
      // clientName must be a string if provided
      const response = JSON.stringify({
        clientName: 12345,
      });

      const result = parseClientDiscoveryResponse(response);

      expect(result).toBeNull();
    });

    it("handles whitespace around response", () => {
      const response = `
        {
          "clientName": "whitespace-test"
        }
      `;

      const result = parseClientDiscoveryResponse(response);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("whitespace-test");
    });
  });

  describe("createClientDiscoveryRequest", () => {
    it("returns properly structured request", () => {
      const request = createClientDiscoveryRequest();

      expect(request).toHaveProperty("messages");
      expect(request).toHaveProperty("maxTokens");
      expect(request.maxTokens).toBe(500);
    });

    it("includes single user message", () => {
      const request = createClientDiscoveryRequest();

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe("user");
      expect(request.messages[0].content.type).toBe("text");
    });

    it("message contains discovery prompt", () => {
      const request = createClientDiscoveryRequest();

      const text = request.messages[0].content.text;
      expect(text).toContain("clientName");
      expect(text).toContain("model");
      expect(text).toContain("modelProvider");
      expect(text).toContain("JSON");
    });
  });

  describe("discoverClientMetadata", () => {
    it("returns null when sampling is not supported", async () => {
      const mockServer = {} as unknown as Server;

      const result = await discoverClientMetadata(mockServer);

      expect(result).toBeNull();
    });

    it("returns null when server has no sampling capability", async () => {
      const mockServer = {
        _clientCapabilities: { tools: {} },
      } as unknown as Server;

      const result = await discoverClientMetadata(mockServer);

      expect(result).toBeNull();
    });

    it("returns metadata on successful discovery", async () => {
      const mockResponse = {
        role: "assistant",
        model: "test",
        content: JSON.stringify({
          clientName: "test-client",
          model: "test-model",
          modelProvider: "test-provider",
        }),
      };

      const mockServer = {
        _clientCapabilities: { sampling: {} },
        createMessage: vi.fn().mockResolvedValue(mockResponse),
      } as unknown as Server;

      const result = await discoverClientMetadata(mockServer);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("test-client");
      expect(result?.model).toBe("test-model");
    });

    it("returns null when createMessage throws", async () => {
      const mockServer = {
        _clientCapabilities: { sampling: {} },
        createMessage: vi.fn().mockRejectedValue(new Error("Network error")),
      } as unknown as Server;

      const result = await discoverClientMetadata(mockServer);

      expect(result).toBeNull();
    });

    it("returns null when response has invalid field types", async () => {
      const mockResponse = {
        role: "assistant",
        model: "test",
        // clientName must be a string, not a number
        content: JSON.stringify({ clientName: 12345 }),
      };

      const mockServer = {
        _clientCapabilities: { sampling: {} },
        createMessage: vi.fn().mockResolvedValue(mockResponse),
      } as unknown as Server;

      const result = await discoverClientMetadata(mockServer);

      expect(result).toBeNull();
    });

    it("returns empty object for unknown fields (all fields optional)", async () => {
      const mockResponse = {
        role: "assistant",
        model: "test",
        // Unknown fields get stripped, leaving empty object
        content: JSON.stringify({ unknownField: "value" }),
      };

      const mockServer = {
        _clientCapabilities: { sampling: {} },
        createMessage: vi.fn().mockResolvedValue(mockResponse),
      } as unknown as Server;

      const result = await discoverClientMetadata(mockServer);

      // Empty object is valid since all fields are optional
      expect(result).toEqual({});
    });

    it("handles markdown code block in response", async () => {
      const mockResponse = {
        role: "assistant",
        model: "test",
        content: `\`\`\`json
{
  "clientName": "code-block-client",
  "model": "code-block-model"
}
\`\`\``,
      };

      const mockServer = {
        _clientCapabilities: { sampling: {} },
        createMessage: vi.fn().mockResolvedValue(mockResponse),
      } as unknown as Server;

      const result = await discoverClientMetadata(mockServer);

      expect(result).not.toBeNull();
      expect(result?.clientName).toBe("code-block-client");
    });

    it("uses custom timeout when provided", async () => {
      const mockResponse = {
        role: "assistant",
        model: "test",
        content: JSON.stringify({ clientName: "timeout-test" }),
      };

      const mockServer = {
        _clientCapabilities: { sampling: {} },
        createMessage: vi.fn().mockResolvedValue(mockResponse),
      } as unknown as Server;

      await discoverClientMetadata(mockServer, 60000);

      expect(mockServer.createMessage).toHaveBeenCalledWith(expect.any(Object), { timeout: 60000 });
    });
  });

  describe("Constants", () => {
    it("exports default discovery timeout", () => {
      expect(CLIENT_DISCOVERY_TIMEOUT_MS).toBe(30_000);
    });
  });
});
