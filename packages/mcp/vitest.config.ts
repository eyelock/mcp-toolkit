import baseConfig from "@mcp-toolkit/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: [
          // Main entry point - integration code with process.argv handling
          "src/index.ts",
          // Server setup - wires handlers together, requires MCP protocol simulation
          "src/server.ts",
          // Transport implementations - require actual server connections
          "src/transport/stdio.ts",
          "src/transport/http.ts",
        ],
        // MCP package has more integration-style code that's harder to unit test
        // Coverage can be improved separately from toolkit work
        thresholds: {
          statements: 85,
          branches: 85,
          functions: 85,
          lines: 85,
        },
      },
    },
  })
);
