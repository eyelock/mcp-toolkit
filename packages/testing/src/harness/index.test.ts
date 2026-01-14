/**
 * Test Harness Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TestCase } from "../schema.js";
import {
  TestHarness,
  type ToolHandler,
  assertToolResult,
  createTestHarness,
  runTestCase,
  runTestCases,
} from "./index.js";

describe("TestHarness", () => {
  describe("createTestHarness", () => {
    it("creates a harness with default config", () => {
      const harness = createTestHarness();
      expect(harness).toBeInstanceOf(TestHarness);
      expect(harness.listTools()).toEqual([]);
      expect(harness.listResources()).toEqual([]);
      expect(harness.listPrompts()).toEqual([]);
    });

    it("creates a harness with tool handlers", () => {
      const harness = createTestHarness({
        tools: {
          my_tool: async () => ({ content: [{ type: "text", text: "result" }] }),
        },
      });
      expect(harness.listTools()).toContain("my_tool");
    });
  });

  describe("callTool", () => {
    it("calls registered tool handler", async () => {
      const handler: ToolHandler<{ name: string }> = vi.fn(async (args) => ({
        content: [{ type: "text", text: `Hello ${args.name}` }],
      }));

      const harness = createTestHarness({
        tools: { greet: handler },
      });

      const { result, durationMs } = await harness.callTool("greet", { name: "World" });

      expect(handler).toHaveBeenCalledWith({ name: "World" }, expect.any(Object));
      expect(result.content[0]).toEqual({ type: "text", text: "Hello World" });
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });

    it("returns error for unknown tool", async () => {
      const harness = createTestHarness();
      const { result } = await harness.callTool("unknown_tool");

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({ type: "text", text: "Unknown tool: unknown_tool" });
    });

    it("catches and returns handler errors", async () => {
      const harness = createTestHarness({
        tools: {
          failing_tool: async () => {
            throw new Error("Tool failed");
          },
        },
      });

      const { result } = await harness.callTool("failing_tool");

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({ type: "text", text: "Tool failed" });
    });

    it("passes context to handler", async () => {
      const handler = vi.fn(async () => ({ content: [] }));
      const harness = createTestHarness({
        tools: { my_tool: handler },
        context: { customKey: "customValue" },
      });

      await harness.callTool("my_tool", {});

      expect(handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          provider: expect.any(Object),
          customKey: "customValue",
        })
      );
    });
  });

  describe("registerTool", () => {
    it("registers a new tool handler", async () => {
      const harness = createTestHarness();
      harness.registerTool("new_tool", async () => ({
        content: [{ type: "text", text: "registered" }],
      }));

      expect(harness.listTools()).toContain("new_tool");

      const { result } = await harness.callTool("new_tool");
      expect(result.content[0]).toEqual({ type: "text", text: "registered" });
    });
  });

  describe("readResource", () => {
    it("reads resource by exact URI match", async () => {
      const harness = createTestHarness({
        resources: {
          "file://test.txt": async (uri) => ({
            contents: [{ uri, text: "file content" }],
          }),
        },
      });

      const result = await harness.readResource("file://test.txt");
      expect(result?.contents[0].text).toBe("file content");
    });

    it("reads resource by pattern match", async () => {
      const harness = createTestHarness({
        resources: {
          "^file://": async (uri) => ({
            contents: [{ uri, text: "pattern matched" }],
          }),
        },
      });

      const result = await harness.readResource("file://any-file.txt");
      expect(result?.contents[0].text).toBe("pattern matched");
    });

    it("returns null for unmatched URI", async () => {
      const harness = createTestHarness();
      const result = await harness.readResource("unknown://resource");
      expect(result).toBeNull();
    });
  });

  describe("getPrompt", () => {
    it("gets registered prompt", async () => {
      const harness = createTestHarness({
        prompts: {
          greeting: async (promptName, args) => ({
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `${promptName}: Hello ${args?.name ?? "world"}`,
                },
              },
            ],
          }),
        },
      });

      const result = await harness.getPrompt("greeting", { name: "Claude" });
      expect(result?.messages[0].content.text).toBe("greeting: Hello Claude");
    });

    it("returns null for unknown prompt", async () => {
      const harness = createTestHarness();
      const result = await harness.getPrompt("unknown");
      expect(result).toBeNull();
    });
  });

  describe("reset", () => {
    it("clears provider session", async () => {
      const harness = createTestHarness();
      await harness.reset();
      // Should not throw
    });
  });

  describe("context", () => {
    it("provides access to provider", () => {
      const harness = createTestHarness();
      expect(harness.context.provider).toBeDefined();
    });

    it("includes custom context data", () => {
      const harness = createTestHarness({
        context: { foo: "bar" },
      });
      expect(harness.context.foo).toBe("bar");
    });
  });
});

describe("assertToolResult", () => {
  it("passes when isError matches", () => {
    const result = assertToolResult({ content: [], isError: true }, { isError: true });
    expect(result.passed).toBe(true);
  });

  it("fails when isError does not match", () => {
    const result = assertToolResult({ content: [], isError: false }, { isError: true });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("isError");
  });

  it("passes when contentContains is found", () => {
    const result = assertToolResult(
      { content: [{ type: "text", text: "Hello World" }] },
      { contentContains: "World" }
    );
    expect(result.passed).toBe(true);
  });

  it("fails when contentContains is not found", () => {
    const result = assertToolResult(
      { content: [{ type: "text", text: "Hello" }] },
      { contentContains: "World" }
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("contain");
  });

  it("passes when contentMatches regex", () => {
    const result = assertToolResult(
      { content: [{ type: "text", text: "Result: 42" }] },
      { contentMatches: "Result: \\d+" }
    );
    expect(result.passed).toBe(true);
  });

  it("fails when contentMatches regex does not match", () => {
    const result = assertToolResult(
      { content: [{ type: "text", text: "Result: abc" }] },
      { contentMatches: "Result: \\d+" }
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("match");
  });

  it("passes when custom assertion returns true", () => {
    const result = assertToolResult({ content: [] }, { custom: () => true });
    expect(result.passed).toBe(true);
  });

  it("fails when custom assertion returns false", () => {
    const result = assertToolResult({ content: [] }, { custom: () => false });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Custom assertion failed");
  });
});

describe("runTestCase", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness({
      tools: {
        echo: async (args: { value: string }) => ({
          content: [{ type: "text", text: args.value }],
        }),
      },
    });
  });

  it("runs test case and returns result", async () => {
    const testCase: TestCase = {
      name: "echo test",
      toolCall: { name: "echo", arguments: { value: "test" } },
      expected: { contentContains: "test" },
    };

    const result = await runTestCase(harness, testCase);
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("runs setup before test", async () => {
    const setup = vi.fn(async () => {});
    const testCase: TestCase = {
      name: "with setup",
      toolCall: { name: "echo", arguments: {} },
      setup,
    };

    await runTestCase(harness, testCase);
    expect(setup).toHaveBeenCalled();
  });

  it("runs teardown after test", async () => {
    const teardown = vi.fn(async () => {});
    const testCase: TestCase = {
      name: "with teardown",
      toolCall: { name: "echo", arguments: {} },
      teardown,
    };

    await runTestCase(harness, testCase);
    expect(teardown).toHaveBeenCalled();
  });

  it("passes without expected assertion", async () => {
    const testCase: TestCase = {
      name: "no assertion",
      toolCall: { name: "echo", arguments: {} },
    };

    const result = await runTestCase(harness, testCase);
    expect(result.passed).toBe(true);
  });
});

describe("runTestCases", () => {
  it("runs multiple test cases", async () => {
    const harness = createTestHarness({
      tools: {
        add: async (args: { a: number; b: number }) => ({
          content: [{ type: "text", text: String(args.a + args.b) }],
        }),
      },
    });

    const testCases: TestCase[] = [
      {
        name: "add 1+1",
        toolCall: { name: "add", arguments: { a: 1, b: 1 } },
        expected: { contentContains: "2" },
      },
      {
        name: "add 2+3",
        toolCall: { name: "add", arguments: { a: 2, b: 3 } },
        expected: { contentContains: "5" },
      },
    ];

    const results = await runTestCases(harness, testCases);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("add 1+1");
    expect(results[0].passed).toBe(true);
    expect(results[1].name).toBe("add 2+3");
    expect(results[1].passed).toBe(true);
  });
});

describe("registerResource", () => {
  it("registers a resource handler", () => {
    const harness = createTestHarness();
    const handler = vi.fn(async () => ({
      contents: [{ uri: "test://resource", text: "content" }],
    }));

    harness.registerResource("test://resource", handler);

    expect(harness.listResources()).toContain("test://resource");
  });

  it("allows reading registered resource", async () => {
    const harness = createTestHarness();
    const handler = vi.fn(async () => ({
      contents: [{ uri: "test://data", text: "Hello Resource" }],
    }));

    harness.registerResource("test://data", handler);

    const result = await harness.readResource("test://data");
    expect(handler).toHaveBeenCalled();
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].text).toBe("Hello Resource");
  });
});

describe("registerPrompt", () => {
  it("registers a prompt handler", () => {
    const harness = createTestHarness();
    const handler = vi.fn(async () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: "Hello" } }],
    }));

    harness.registerPrompt("greeting", handler);

    expect(harness.listPrompts()).toContain("greeting");
  });

  it("allows getting registered prompt", async () => {
    const harness = createTestHarness();
    const handler = vi.fn(async () => ({
      messages: [
        { role: "user" as const, content: { type: "text" as const, text: "Prompt content" } },
      ],
    }));

    harness.registerPrompt("test-prompt", handler);

    const result = await harness.getPrompt("test-prompt", {});
    expect(handler).toHaveBeenCalled();
    expect(result.messages).toHaveLength(1);
  });
});
