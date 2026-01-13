/**
 * MCP Test Harness
 *
 * Provides utilities for unit testing MCP tools, resources, and prompts
 * without requiring a full MCP server or LLM connection.
 */

import type { SessionProvider } from "@mcp-toolkit/core";
import { createMemoryProvider } from "@mcp-toolkit/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ExpectedToolResult, TestCase } from "../schema.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Tool handler function type
 */
export type ToolHandler<T = unknown> = (
  args: T,
  context: HarnessContext
) => Promise<CallToolResult>;

/**
 * Resource handler function type
 */
export type ResourceHandler = (
  uri: string,
  context: HarnessContext
) => Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string }> } | null>;

/**
 * Prompt handler function type
 */
export type PromptHandler = (
  name: string,
  args: Record<string, string> | undefined,
  context: HarnessContext
) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> } | null>;

/**
 * Context passed to handlers during testing
 */
export interface HarnessContext {
  provider: SessionProvider;
  [key: string]: unknown;
}

/**
 * Test harness configuration
 */
export interface TestHarnessConfig {
  /** Session provider (defaults to MemoryProvider) */
  provider?: SessionProvider;
  /** Tool handlers to register */
  tools?: Record<string, ToolHandler>;
  /** Resource handlers to register */
  resources?: Record<string, ResourceHandler>;
  /** Prompt handlers to register */
  prompts?: Record<string, PromptHandler>;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Result of a harness tool call
 */
export interface HarnessToolResult {
  result: CallToolResult;
  durationMs: number;
}

// =============================================================================
// Test Harness
// =============================================================================

/**
 * MCP Test Harness for unit testing tools, resources, and prompts
 *
 * @example
 * ```typescript
 * const harness = createTestHarness({
 *   tools: {
 *     my_tool: async (args, ctx) => ({
 *       content: [{ type: "text", text: `Hello ${args.name}` }],
 *     }),
 *   },
 * });
 *
 * const result = await harness.callTool("my_tool", { name: "World" });
 * expect(result.result.content[0].text).toBe("Hello World");
 * ```
 */
export class TestHarness {
  private readonly provider: SessionProvider;
  private readonly tools: Map<string, ToolHandler>;
  private readonly resources: Map<string, ResourceHandler>;
  private readonly prompts: Map<string, PromptHandler>;
  private readonly contextData: Record<string, unknown>;

  constructor(config: TestHarnessConfig = {}) {
    this.provider = config.provider ?? createMemoryProvider();
    this.tools = new Map(Object.entries(config.tools ?? {}));
    this.resources = new Map(Object.entries(config.resources ?? {}));
    this.prompts = new Map(Object.entries(config.prompts ?? {}));
    this.contextData = config.context ?? {};
  }

  /**
   * Get the harness context
   */
  get context(): HarnessContext {
    return {
      provider: this.provider,
      ...this.contextData,
    };
  }

  /**
   * Register a tool handler
   */
  registerTool(name: string, handler: ToolHandler): void {
    this.tools.set(name, handler);
  }

  /**
   * Register a resource handler
   */
  registerResource(pattern: string, handler: ResourceHandler): void {
    this.resources.set(pattern, handler);
  }

  /**
   * Register a prompt handler
   */
  registerPrompt(name: string, handler: PromptHandler): void {
    this.prompts.set(name, handler);
  }

  /**
   * Call a registered tool
   */
  async callTool(name: string, args: unknown = {}): Promise<HarnessToolResult> {
    const handler = this.tools.get(name);
    if (!handler) {
      return {
        result: {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        },
        durationMs: 0,
      };
    }

    const start = performance.now();
    try {
      const result = await handler(args, this.context);
      return {
        result,
        durationMs: performance.now() - start,
      };
    } catch (error) {
      return {
        result: {
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        },
        durationMs: performance.now() - start,
      };
    }
  }

  /**
   * Read a registered resource
   */
  async readResource(uri: string): Promise<{
    contents: Array<{ uri: string; mimeType?: string; text?: string }>;
  } | null> {
    // Try exact match first
    const exactHandler = this.resources.get(uri);
    if (exactHandler) {
      return exactHandler(uri, this.context);
    }

    // Try pattern matching
    for (const [pattern, handler] of this.resources) {
      if (uri.startsWith(pattern) || new RegExp(pattern).test(uri)) {
        return handler(uri, this.context);
      }
    }

    return null;
  }

  /**
   * Get a registered prompt
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>
  ): Promise<{
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  } | null> {
    const handler = this.prompts.get(name);
    if (!handler) {
      return null;
    }
    return handler(name, args, this.context);
  }

  /**
   * List registered tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * List registered resources
   */
  listResources(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * List registered prompts
   */
  listPrompts(): string[] {
    return Array.from(this.prompts.keys());
  }

  /**
   * Reset the harness state (clears provider session)
   */
  async reset(): Promise<void> {
    await this.provider.clearSession();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new test harness
 */
export function createTestHarness(config?: TestHarnessConfig): TestHarness {
  return new TestHarness(config);
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that a tool result matches expected criteria
 */
export function assertToolResult(
  result: CallToolResult,
  expected: ExpectedToolResult
): { passed: boolean; message?: string } {
  // Check isError
  if (expected.isError !== undefined) {
    if (result.isError !== expected.isError) {
      return {
        passed: false,
        message: `Expected isError=${expected.isError}, got ${result.isError}`,
      };
    }
  }

  // Get text content
  const textContent = result.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  // Check contentContains
  if (expected.contentContains !== undefined) {
    if (!textContent.includes(expected.contentContains)) {
      return {
        passed: false,
        message: `Expected content to contain "${expected.contentContains}"`,
      };
    }
  }

  // Check contentMatches
  if (expected.contentMatches !== undefined) {
    const regex = new RegExp(expected.contentMatches);
    if (!regex.test(textContent)) {
      return {
        passed: false,
        message: `Expected content to match "${expected.contentMatches}"`,
      };
    }
  }

  // Check custom assertion
  if (expected.custom !== undefined) {
    if (!expected.custom(result)) {
      return {
        passed: false,
        message: "Custom assertion failed",
      };
    }
  }

  return { passed: true };
}

/**
 * Run a test case
 */
export async function runTestCase(
  harness: TestHarness,
  testCase: TestCase
): Promise<{ passed: boolean; message?: string; durationMs: number }> {
  // Setup
  if (testCase.setup) {
    await testCase.setup();
  }

  try {
    // Call tool
    const { result, durationMs } = await harness.callTool(
      testCase.toolCall.name,
      testCase.toolCall.arguments
    );

    // Assert if expected is provided
    if (testCase.expected) {
      const assertion = assertToolResult(result, testCase.expected);
      return { ...assertion, durationMs };
    }

    return { passed: true, durationMs };
  } finally {
    // Teardown
    if (testCase.teardown) {
      await testCase.teardown();
    }
  }
}

/**
 * Run multiple test cases
 */
export async function runTestCases(
  harness: TestHarness,
  testCases: TestCase[]
): Promise<Array<{ name: string; passed: boolean; message?: string; durationMs: number }>> {
  const results: Array<{ name: string; passed: boolean; message?: string; durationMs: number }> =
    [];

  for (const testCase of testCases) {
    const result = await runTestCase(harness, testCase);
    results.push({ name: testCase.name, ...result });
  }

  return results;
}

// =============================================================================
// Convenience Exports
// =============================================================================

export type { TestCase, ExpectedToolResult } from "../schema.js";
