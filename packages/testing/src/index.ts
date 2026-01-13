/**
 * @mcp-toolkit/testing
 *
 * Testing harness and evals framework for MCP Toolkit.
 *
 * This package provides two main capabilities:
 *
 * 1. **Unit Test Harness** - For testing MCP tools, resources, and prompts
 *    in isolation without requiring a full MCP server or LLM connection.
 *
 * 2. **Evals Framework** - For running scripted, deterministic evaluations
 *    against real LLM providers with support for LLM-as-Judge assertions.
 *
 * @example Test Harness
 * ```typescript
 * import { createTestHarness, assertToolResult } from "@mcp-toolkit/testing/harness";
 *
 * const harness = createTestHarness({
 *   tools: {
 *     my_tool: async (args, ctx) => ({
 *       content: [{ type: "text", text: `Hello ${args.name}` }],
 *     }),
 *   },
 * });
 *
 * const { result } = await harness.callTool("my_tool", { name: "World" });
 * assertToolResult(result, { contentContains: "Hello World" });
 * ```
 *
 * @example Evals Framework
 * ```typescript
 * import { createEvalRunner, createAnthropicClient } from "@mcp-toolkit/testing/evals";
 * import { createTestHarness } from "@mcp-toolkit/testing/harness";
 *
 * const runner = createEvalRunner({
 *   harness: createTestHarness({ tools }),
 *   llmClient: createAnthropicClient({ model: "claude-sonnet-4-20250514" }),
 * });
 *
 * const result = await runner.runScenario({
 *   name: "basic-test",
 *   prompt: "Use my_tool",
 *   toolCalls: [{ tool: "my_tool", arguments: {} }],
 *   assertions: [{ type: "tool-called", tool: "my_tool" }],
 * });
 * ```
 *
 * @packageDocumentation
 */

// Schema types
export type {
  LLMProvider,
  LLMConfig,
  MockToolCall,
  ExpectedToolResult,
  TestCase,
  AssertionType,
  Assertion,
  ScriptedToolCall,
  EvalScenario,
  EvalSuite,
  AssertionResult,
  ToolCallResult,
  EvalResult,
  EvalSuiteResult,
  JudgeVerdict,
} from "./schema.js";

export {
  LLMProviderSchema,
  LLMConfigSchema,
  MockToolCallSchema,
  ExpectedToolResultSchema,
  TestCaseSchema,
  AssertionTypeSchema,
  AssertionSchema,
  ScriptedToolCallSchema,
  EvalScenarioSchema,
  EvalSuiteSchema,
  AssertionResultSchema,
  ToolCallResultSchema,
  EvalResultSchema,
  EvalSuiteResultSchema,
  JudgeVerdictSchema,
} from "./schema.js";

// Test Harness
export type {
  ToolHandler,
  ResourceHandler,
  PromptHandler,
  HarnessContext,
  TestHarnessConfig,
  HarnessToolResult,
} from "./harness/index.js";

export {
  TestHarness,
  createTestHarness,
  assertToolResult,
  runTestCase,
  runTestCases,
} from "./harness/index.js";

// Evals Framework
export type {
  LLMClient,
  ChatMessage,
  ChatResponse,
  LLMClientFactory,
  EvalRunnerConfig,
  EvalOptions,
} from "./evals/index.js";

export {
  EvalRunner,
  createEvalRunner,
  evaluateAssertion,
  createAnthropicClient,
  createMockLLMClient,
} from "./evals/index.js";

// LLM-as-Judge
export type {
  JudgeConfig,
  JudgmentRequest,
  RubricCriterion,
  RubricResult,
} from "./judge/index.js";

export {
  LLMJudge,
  createLLMJudge,
  PRESET_RUBRICS,
} from "./judge/index.js";

// Reporters
export type {
  ReportFormat,
  ReporterOptions,
  Reporter,
} from "./reporters/index.js";

export {
  jsonReporter,
  markdownReporter,
  htmlReporter,
  consoleReporter,
  getReporter,
  formatResult,
} from "./reporters/index.js";
