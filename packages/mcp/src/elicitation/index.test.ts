/**
 * Elicitation Module Tests
 *
 * Tests for the example schemas and module exports.
 */

import { describe, expect, it } from "vitest";
import {
  // Re-exports from helpers
  elicitInput,
  elicitConfirmation,
  elicitText,
  elicitChoice,
  clientSupportsElicitation,
  getElicitationTimeout,
  DEFAULT_ELICITATION_TIMEOUT_MS,
  ElicitationNotSupportedError,
  ElicitationDeclinedError,
  ElicitationValidationError,
  // Example schemas
  EXAMPLE_SCHEMAS,
} from "./index.js";

describe("Elicitation Module", () => {
  describe("exports", () => {
    it("exports elicitation helper functions", () => {
      expect(elicitInput).toBeDefined();
      expect(typeof elicitInput).toBe("function");

      expect(elicitConfirmation).toBeDefined();
      expect(typeof elicitConfirmation).toBe("function");

      expect(elicitText).toBeDefined();
      expect(typeof elicitText).toBe("function");

      expect(elicitChoice).toBeDefined();
      expect(typeof elicitChoice).toBe("function");
    });

    it("exports utility functions", () => {
      expect(clientSupportsElicitation).toBeDefined();
      expect(typeof clientSupportsElicitation).toBe("function");

      expect(getElicitationTimeout).toBeDefined();
      expect(typeof getElicitationTimeout).toBe("function");
    });

    it("exports constants", () => {
      // 5 minutes default timeout for elicitation
      expect(DEFAULT_ELICITATION_TIMEOUT_MS).toBe(300_000);
    });

    it("exports error classes", () => {
      expect(ElicitationNotSupportedError).toBeDefined();
      expect(ElicitationDeclinedError).toBeDefined();
      expect(ElicitationValidationError).toBeDefined();
    });
  });

  describe("EXAMPLE_SCHEMAS", () => {
    it("exports all example schemas", () => {
      expect(EXAMPLE_SCHEMAS).toHaveProperty("confirmation");
      expect(EXAMPLE_SCHEMAS).toHaveProperty("feedback");
      expect(EXAMPLE_SCHEMAS).toHaveProperty("task");
      expect(EXAMPLE_SCHEMAS).toHaveProperty("config");
    });

    describe("confirmation schema", () => {
      const schema = EXAMPLE_SCHEMAS.confirmation;

      it("has correct type", () => {
        expect(schema.type).toBe("object");
      });

      it("has confirm property", () => {
        expect(schema.properties.confirm).toBeDefined();
        expect(schema.properties.confirm.type).toBe("boolean");
      });

      it("has optional reason property", () => {
        expect(schema.properties.reason).toBeDefined();
        expect(schema.properties.reason.type).toBe("string");
      });

      it("requires confirm field", () => {
        expect(schema.required).toContain("confirm");
      });
    });

    describe("feedback schema", () => {
      const schema = EXAMPLE_SCHEMAS.feedback;

      it("has correct type", () => {
        expect(schema.type).toBe("object");
      });

      it("has rating property with enum", () => {
        expect(schema.properties.rating).toBeDefined();
        expect(schema.properties.rating.type).toBe("string");
        expect(schema.properties.rating.enum).toEqual(["poor", "fair", "good", "excellent"]);
      });

      it("has optional comments property with max length", () => {
        expect(schema.properties.comments).toBeDefined();
        expect(schema.properties.comments.type).toBe("string");
        expect(schema.properties.comments.maxLength).toBe(1000);
      });

      it("requires rating field", () => {
        expect(schema.required).toContain("rating");
      });
    });

    describe("task schema", () => {
      const schema = EXAMPLE_SCHEMAS.task;

      it("has correct type", () => {
        expect(schema.type).toBe("object");
      });

      it("has title property with constraints", () => {
        expect(schema.properties.title).toBeDefined();
        expect(schema.properties.title.type).toBe("string");
        expect(schema.properties.title.minLength).toBe(1);
        expect(schema.properties.title.maxLength).toBe(200);
      });

      it("has description property", () => {
        expect(schema.properties.description).toBeDefined();
        expect(schema.properties.description.type).toBe("string");
      });

      it("has priority property with enum and default", () => {
        expect(schema.properties.priority).toBeDefined();
        expect(schema.properties.priority.type).toBe("string");
        expect(schema.properties.priority.enum).toEqual(["low", "medium", "high", "critical"]);
        expect(schema.properties.priority.default).toBe("medium");
      });

      it("requires title field", () => {
        expect(schema.required).toContain("title");
      });
    });

    describe("config schema", () => {
      const schema = EXAMPLE_SCHEMAS.config;

      it("has correct type", () => {
        expect(schema.type).toBe("object");
      });

      it("has enabled property with default", () => {
        expect(schema.properties.enabled).toBeDefined();
        expect(schema.properties.enabled.type).toBe("boolean");
        expect(schema.properties.enabled.default).toBe(true);
      });

      it("has timeout property with constraints", () => {
        expect(schema.properties.timeout).toBeDefined();
        expect(schema.properties.timeout.type).toBe("integer");
        expect(schema.properties.timeout.minimum).toBe(1);
        expect(schema.properties.timeout.maximum).toBe(3600);
        expect(schema.properties.timeout.default).toBe(30);
      });

      it("has mode property with enum and default", () => {
        expect(schema.properties.mode).toBeDefined();
        expect(schema.properties.mode.type).toBe("string");
        expect(schema.properties.mode.enum).toEqual(["development", "staging", "production"]);
        expect(schema.properties.mode.default).toBe("development");
      });

      it("has no required fields (all optional)", () => {
        expect(schema.required).toBeUndefined();
      });
    });
  });
});
