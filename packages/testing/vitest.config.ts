import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        // Re-export barrel files
        "src/index.ts",
        // Schema definitions are validated by Zod at runtime
        "src/schema.ts",
      ],
      thresholds: {
        // Lower thresholds for testing utilities
        // Some branches are hard to reach (e.g., Anthropic client, error paths)
        statements: 80,
        branches: 75,
        functions: 85,
        lines: 80,
      },
    },
  },
});
