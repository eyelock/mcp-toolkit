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
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      thresholds: {
        // 97% threshold accounts for defensive code protected by Zod validation
        // that is technically unreachable but good practice to keep
        statements: 97,
        branches: 94,
        functions: 100,
        lines: 97,
      },
    },
  },
});
