import baseConfig from "@mcp-toolkit/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: ["src/interface.ts"], // Types only, no executable code
      },
    },
  })
);
