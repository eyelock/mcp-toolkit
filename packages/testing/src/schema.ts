/**
 * Testing Package Schema Definitions
 *
 * Zod schemas for test harness and evals framework.
 */

import { z } from "zod";

// =============================================================================
// LLM Provider Configuration
// =============================================================================

/**
 * Supported LLM providers
 */
export const LLMProviderSchema = z.enum(["anthropic", "openai", "custom"]);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

/**
 * LLM configuration for evals
 */
export const LLMConfigSchema = z.object({
  provider: LLMProviderSchema.default("anthropic"),
  model: z.string().describe("Model identifier (e.g., 'claude-sonnet-4-20250514')"),
  apiKey: z.string().optional().describe("API key (defaults to env var)"),
  baseUrl: z.string().url().optional().describe("Custom API base URL"),
  maxTokens: z.number().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0),
});
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// =============================================================================
// Test Harness Types
// =============================================================================

/**
 * Mock tool call for scripted testing
 */
export const MockToolCallSchema = z.object({
  name: z.string().describe("Tool name to call"),
  arguments: z.record(z.unknown()).default({}).describe("Tool arguments"),
});
export type MockToolCall = z.infer<typeof MockToolCallSchema>;

/**
 * Expected tool result for assertions
 */
export const ExpectedToolResultSchema = z.object({
  isError: z.boolean().optional(),
  contentContains: z.string().optional().describe("Text the content should contain"),
  contentMatches: z.string().optional().describe("Regex pattern to match"),
  custom: z.function().args(z.unknown()).returns(z.boolean()).optional(),
});
export type ExpectedToolResult = z.infer<typeof ExpectedToolResultSchema>;

/**
 * Test case for unit testing
 */
export const TestCaseSchema = z.object({
  name: z.string().describe("Test case name"),
  description: z.string().optional(),
  toolCall: MockToolCallSchema,
  expected: ExpectedToolResultSchema.optional(),
  setup: z.function().returns(z.promise(z.void())).optional(),
  teardown: z.function().returns(z.promise(z.void())).optional(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

// =============================================================================
// Eval Framework Types
// =============================================================================

/**
 * Assertion types for eval validation
 */
export const AssertionTypeSchema = z.enum([
  "tool-called",
  "tool-not-called",
  "tool-args-match",
  "response-contains",
  "response-matches",
  "llm-judge",
  "custom",
]);
export type AssertionType = z.infer<typeof AssertionTypeSchema>;

/**
 * Single assertion definition
 */
export const AssertionSchema = z.object({
  type: AssertionTypeSchema,
  tool: z.string().optional().describe("Tool name for tool-* assertions"),
  args: z.record(z.unknown()).optional().describe("Expected args for tool-args-match"),
  text: z.string().optional().describe("Text for response-contains"),
  pattern: z.string().optional().describe("Regex for response-matches"),
  criteria: z.string().optional().describe("Criteria for llm-judge"),
  fn: z
    .function()
    .args(z.unknown())
    .returns(z.boolean())
    .optional()
    .describe("Custom assertion function"),
  weight: z.number().min(0).max(1).default(1).describe("Weight for scoring"),
});
export type Assertion = z.infer<typeof AssertionSchema>;

/**
 * Scripted tool call in an eval scenario
 */
export const ScriptedToolCallSchema = z.object({
  tool: z.string().describe("Tool to call"),
  arguments: z.record(z.unknown()).default({}),
  expectedResult: ExpectedToolResultSchema.optional(),
});
export type ScriptedToolCall = z.infer<typeof ScriptedToolCallSchema>;

/**
 * Eval scenario definition
 */
export const EvalScenarioSchema = z.object({
  name: z.string().describe("Eval name"),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]).describe("Tags for filtering"),

  // Initial prompt to the LLM
  prompt: z.string().describe("User prompt to send to the LLM"),

  // Scripted tool calls (deterministic)
  toolCalls: z.array(ScriptedToolCallSchema).default([]).describe("Scripted tool calls to execute"),

  // Assertions to validate
  assertions: z.array(AssertionSchema).default([]),

  // Scoring configuration
  scoring: z
    .object({
      passCriteria: z
        .enum(["all-assertions", "any-assertion", "weighted-threshold"])
        .default("all-assertions"),
      threshold: z.number().min(0).max(1).default(1).describe("Threshold for weighted-threshold"),
    })
    .default({}),

  // Timeout for the eval
  timeoutMs: z.number().positive().default(60_000),
});
export type EvalScenario = z.infer<typeof EvalScenarioSchema>;

/**
 * Eval suite containing multiple scenarios
 */
export const EvalSuiteSchema = z.object({
  name: z.string().describe("Suite name"),
  description: z.string().optional(),
  scenarios: z.array(EvalScenarioSchema),
  llmConfig: LLMConfigSchema.optional().describe("LLM config for all scenarios"),
  setup: z.function().returns(z.promise(z.void())).optional(),
  teardown: z.function().returns(z.promise(z.void())).optional(),
});
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;

// =============================================================================
// Results Types
// =============================================================================

/**
 * Result of a single assertion
 */
export const AssertionResultSchema = z.object({
  assertion: AssertionSchema,
  passed: z.boolean(),
  message: z.string().optional(),
  score: z.number().min(0).max(1),
});
export type AssertionResult = z.infer<typeof AssertionResultSchema>;

/**
 * Result of a tool call
 */
export const ToolCallResultSchema = z.object({
  tool: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown(),
  durationMs: z.number(),
  error: z.string().optional(),
});
export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;

/**
 * Result of a single eval scenario
 */
export const EvalResultSchema = z.object({
  scenario: z.string().describe("Scenario name"),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  durationMs: z.number(),
  toolCalls: z.array(ToolCallResultSchema),
  assertions: z.array(AssertionResultSchema),
  llmResponse: z.string().optional(),
  error: z.string().optional(),
});
export type EvalResult = z.infer<typeof EvalResultSchema>;

/**
 * Result of an eval suite run
 */
export const EvalSuiteResultSchema = z.object({
  suite: z.string(),
  passed: z.boolean(),
  totalScenarios: z.number(),
  passedScenarios: z.number(),
  failedScenarios: z.number(),
  score: z.number().min(0).max(1),
  durationMs: z.number(),
  results: z.array(EvalResultSchema),
  timestamp: z.string().datetime(),
});
export type EvalSuiteResult = z.infer<typeof EvalSuiteResultSchema>;

// =============================================================================
// LLM Judge Types
// =============================================================================

/**
 * LLM Judge verdict
 */
export const JudgeVerdictSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  criteria: z.string(),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;
