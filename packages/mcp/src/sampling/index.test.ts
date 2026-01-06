import { describe, expect, it } from "vitest";
import {
  createFeatureSuggestionRequest,
  createProjectDescriptionRequest,
  parseFeatureSuggestion,
  createSessionSummaryRequest,
  createCodeReviewRequest,
  createExplanationRequest,
  type SessionEntry,
} from "./index.js";

describe("Sampling Patterns", () => {
  describe("createProjectDescriptionRequest", () => {
    it("creates a valid request structure", () => {
      const request = createProjectDescriptionRequest("my-api");

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe("user");
      expect(request.maxTokens).toBe(200);
    });

    it("includes project name in the prompt", () => {
      const request = createProjectDescriptionRequest("awesome-project");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("awesome-project");
    });

    it("has text content type", () => {
      const request = createProjectDescriptionRequest("test");

      const content = request.messages[0].content as { type: string };
      expect(content.type).toBe("text");
    });
  });

  describe("createFeatureSuggestionRequest", () => {
    it("creates a valid request structure", () => {
      const request = createFeatureSuggestionRequest("web-api");

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe("user");
      expect(request.maxTokens).toBe(100);
    });

    it("includes project type in the prompt", () => {
      const request = createFeatureSuggestionRequest("microservice");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("microservice");
    });

    it("mentions all available features", () => {
      const request = createFeatureSuggestionRequest("test");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("tools");
      expect(content.text).toContain("resources");
      expect(content.text).toContain("prompts");
      expect(content.text).toContain("sampling");
    });
  });

  describe("parseFeatureSuggestion", () => {
    it("parses valid JSON response", () => {
      const response = '{"tools": true, "resources": false}';
      const result = parseFeatureSuggestion(response);

      expect(result).toEqual({ tools: true, resources: false });
    });

    it("parses full feature set", () => {
      const response = '{"tools": true, "resources": true, "prompts": false, "sampling": false}';
      const result = parseFeatureSuggestion(response);

      expect(result).toEqual({
        tools: true,
        resources: true,
        prompts: false,
        sampling: false,
      });
    });

    it("returns null for invalid JSON", () => {
      const result = parseFeatureSuggestion("not valid json");

      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      const result = parseFeatureSuggestion("");

      expect(result).toBeNull();
    });

    it("returns null for malformed JSON", () => {
      const result = parseFeatureSuggestion("{tools: true}");

      expect(result).toBeNull();
    });
  });

  describe("createSessionSummaryRequest", () => {
    const sampleEntries: SessionEntry[] = [
      {
        type: "task",
        timestamp: "2024-01-15T10:00:00Z",
        description: "Fixed login bug",
        outcome: "success",
      },
      {
        type: "review",
        timestamp: "2024-01-15T11:00:00Z",
        description: "Code review for PR #123",
      },
    ];

    it("creates a request with two messages (assistant + user)", () => {
      const request = createSessionSummaryRequest(sampleEntries, "standup");

      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe("assistant");
      expect(request.messages[1].role).toBe("user");
    });

    it("includes session entries in assistant context", () => {
      const request = createSessionSummaryRequest(sampleEntries, "standup");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("Fixed login bug");
      expect(content.text).toContain("Code review for PR #123");
      expect(content.text).toContain("[success]");
    });

    it("uses standup format instructions", () => {
      const request = createSessionSummaryRequest(sampleEntries, "standup");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("daily standup");
      expect(content.text).toContain("What was accomplished");
    });

    it("uses handoff format instructions", () => {
      const request = createSessionSummaryRequest(sampleEntries, "handoff");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("handoff");
      expect(content.text).toContain("next developer");
    });

    it("uses weekly format instructions", () => {
      const request = createSessionSummaryRequest(sampleEntries, "weekly");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("weekly progress");
      expect(content.text).toContain("stakeholder");
    });

    it("uses custom prompt when format is custom", () => {
      const customPrompt = "Generate a haiku about the session";
      const request = createSessionSummaryRequest(sampleEntries, "custom", customPrompt);

      const content = request.messages[1].content as { text: string };
      expect(content.text).toBe(customPrompt);
    });

    it("defaults to generic summary for custom without prompt", () => {
      const request = createSessionSummaryRequest(sampleEntries, "custom");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("Summarize");
    });

    it("has appropriate maxTokens", () => {
      const request = createSessionSummaryRequest(sampleEntries, "standup");

      expect(request.maxTokens).toBe(500);
    });
  });

  describe("createCodeReviewRequest", () => {
    const sampleCode = `function add(a, b) {
  return a + b;
}`;

    it("creates a request with two messages (assistant + user)", () => {
      const request = createCodeReviewRequest(sampleCode, "javascript");

      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe("assistant");
      expect(request.messages[1].role).toBe("user");
    });

    it("includes code in assistant context with language", () => {
      const request = createCodeReviewRequest(sampleCode, "typescript");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("typescript");
      expect(content.text).toContain("function add");
    });

    it("focuses on security when specified", () => {
      const request = createCodeReviewRequest(sampleCode, "javascript", "security");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("security");
      expect(content.text).toContain("vulnerabilities");
    });

    it("focuses on performance when specified", () => {
      const request = createCodeReviewRequest(sampleCode, "javascript", "performance");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("performance");
      expect(content.text).toContain("bottlenecks");
    });

    it("focuses on readability when specified", () => {
      const request = createCodeReviewRequest(sampleCode, "javascript", "readability");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("clarity");
      expect(content.text).toContain("maintainability");
    });

    it("reviews all aspects by default", () => {
      const request = createCodeReviewRequest(sampleCode, "javascript");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("security");
      expect(content.text).toContain("performance");
      expect(content.text).toContain("readability");
    });

    it("has appropriate maxTokens for detailed review", () => {
      const request = createCodeReviewRequest(sampleCode, "javascript");

      expect(request.maxTokens).toBe(1000);
    });
  });

  describe("createExplanationRequest", () => {
    it("creates a request with two messages (assistant + user)", () => {
      const request = createExplanationRequest("closures");

      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe("assistant");
      expect(request.messages[1].role).toBe("user");
    });

    it("includes concept in both messages", () => {
      const request = createExplanationRequest("dependency injection");

      const assistantContent = request.messages[0].content as { text: string };
      const userContent = request.messages[1].content as { text: string };

      expect(assistantContent.text).toContain("dependency injection");
      expect(userContent.text).toContain("dependency injection");
    });

    it("adapts context for beginner audience", () => {
      const request = createExplanationRequest("recursion", "beginner");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("simple terms");
      expect(content.text).toContain("analogies");
    });

    it("adapts context for intermediate audience", () => {
      const request = createExplanationRequest("recursion", "intermediate");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("balanced");
      expect(content.text).toContain("technical depth");
    });

    it("adapts context for expert audience", () => {
      const request = createExplanationRequest("recursion", "expert");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("nuances");
      expect(content.text).toContain("advanced");
    });

    it("defaults to intermediate audience", () => {
      const request = createExplanationRequest("async/await");

      const content = request.messages[0].content as { text: string };
      expect(content.text).toContain("balanced");
    });

    it("requests structured explanation", () => {
      const request = createExplanationRequest("promises");

      const content = request.messages[1].content as { text: string };
      expect(content.text).toContain("definition");
      expect(content.text).toContain("Key concepts");
      expect(content.text).toContain("practical example");
      expect(content.text).toContain("pitfalls");
    });

    it("has appropriate maxTokens", () => {
      const request = createExplanationRequest("monads");

      expect(request.maxTokens).toBe(800);
    });
  });
});
