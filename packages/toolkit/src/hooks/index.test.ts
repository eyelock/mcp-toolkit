import { describe, it, expect } from "vitest";
import { HookDefinitionSchema } from "@mcp-toolkit/core";
import {
  configHook,
  modelHook,
  planHook,
  buildHook,
  reviewHook,
  allToolkitHooks,
  configHooks,
  modelHooks,
  planHooks,
  buildHooks,
  reviewHooks,
  toolkitBlockingHooks,
  CONFIG_HOOK_ID,
  MODEL_HOOK_ID,
  PLAN_HOOK_ID,
  BUILD_HOOK_ID,
  REVIEW_HOOK_ID,
} from "./index.js";

describe("Toolkit Hook Definitions", () => {
  describe("Hook IDs", () => {
    it("should have correct format for all hook IDs", () => {
      expect(CONFIG_HOOK_ID).toBe("mcp-toolkit:config:start:config");
      expect(MODEL_HOOK_ID).toBe("mcp-toolkit:session:start:model");
      expect(PLAN_HOOK_ID).toBe("mcp-toolkit:action:running:plan");
      expect(BUILD_HOOK_ID).toBe("mcp-toolkit:action:running:build");
      expect(REVIEW_HOOK_ID).toBe("mcp-toolkit:session:end:review");
    });
  });

  describe("Hook Validation", () => {
    it("should validate configHook against schema", () => {
      const result = HookDefinitionSchema.safeParse(configHook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(CONFIG_HOOK_ID);
      }
    });

    it("should validate modelHook against schema", () => {
      const result = HookDefinitionSchema.safeParse(modelHook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(MODEL_HOOK_ID);
      }
    });

    it("should validate planHook against schema", () => {
      const result = HookDefinitionSchema.safeParse(planHook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(PLAN_HOOK_ID);
      }
    });

    it("should validate buildHook against schema", () => {
      const result = HookDefinitionSchema.safeParse(buildHook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(BUILD_HOOK_ID);
      }
    });

    it("should validate reviewHook against schema", () => {
      const result = HookDefinitionSchema.safeParse(reviewHook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(REVIEW_HOOK_ID);
      }
    });
  });

  describe("allToolkitHooks", () => {
    it("should contain all 5 hooks", () => {
      expect(allToolkitHooks).toHaveLength(5);
    });

    it("should be in workflow order", () => {
      expect(allToolkitHooks[0]).toBe(configHook);
      expect(allToolkitHooks[1]).toBe(modelHook);
      expect(allToolkitHooks[2]).toBe(planHook);
      expect(allToolkitHooks[3]).toBe(buildHook);
      expect(allToolkitHooks[4]).toBe(reviewHook);
    });

    it("should all validate against schema", () => {
      for (const hook of allToolkitHooks) {
        const result = HookDefinitionSchema.safeParse(hook);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Phase-specific hook arrays", () => {
    it("configHooks should only contain config hook", () => {
      expect(configHooks).toHaveLength(1);
      expect(configHooks[0]).toBe(configHook);
    });

    it("modelHooks should only contain model hook", () => {
      expect(modelHooks).toHaveLength(1);
      expect(modelHooks[0]).toBe(modelHook);
    });

    it("planHooks should only contain plan hook", () => {
      expect(planHooks).toHaveLength(1);
      expect(planHooks[0]).toBe(planHook);
    });

    it("buildHooks should only contain build hook", () => {
      expect(buildHooks).toHaveLength(1);
      expect(buildHooks[0]).toBe(buildHook);
    });

    it("reviewHooks should only contain review hook", () => {
      expect(reviewHooks).toHaveLength(1);
      expect(reviewHooks[0]).toBe(reviewHook);
    });
  });

  describe("toolkitBlockingHooks", () => {
    it("should have one blocking hook for config", () => {
      expect(toolkitBlockingHooks).toHaveLength(1);
    });

    it("should block toolkit: prefix", () => {
      expect(toolkitBlockingHooks[0].toolPrefix).toBe("toolkit:");
    });

    it("should reference config hook ID", () => {
      expect(toolkitBlockingHooks[0].hookId).toBe(CONFIG_HOOK_ID);
    });

    it("should have descriptive block message", () => {
      expect(toolkitBlockingHooks[0].blockMessage).toContain("configuration");
    });
  });

  describe("Hook Properties", () => {
    describe("configHook", () => {
      it("should be blocking", () => {
        expect(configHook.blocking).toBe(true);
      });

      it("should have MUST requirement level", () => {
        expect(configHook.requirementLevel).toBe("MUST");
      });

      it("should have highest priority", () => {
        expect(configHook.priority).toBe(100);
      });

      it("should have no dependencies", () => {
        expect(configHook.dependencies).toBeUndefined();
      });
    });

    describe("non-config hooks", () => {
      const nonConfigHooks = [modelHook, planHook, buildHook, reviewHook];

      it("should all depend on config", () => {
        for (const hook of nonConfigHooks) {
          expect(hook.dependencies).toContain(CONFIG_HOOK_ID);
        }
      });

      it("should not be blocking", () => {
        for (const hook of nonConfigHooks) {
          expect(hook.blocking).toBeUndefined();
        }
      });
    });
  });

  describe("Hook Tags", () => {
    it("all hooks should have toolkit tag", () => {
      for (const hook of allToolkitHooks) {
        expect(hook.tags).toContain("toolkit");
      }
    });

    it("all hooks should have onboarding tag", () => {
      for (const hook of allToolkitHooks) {
        expect(hook.tags).toContain("onboarding");
      }
    });

    it("config hook should have blocking tag", () => {
      expect(configHook.tags).toContain("blocking");
    });
  });
});
