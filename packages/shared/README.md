# @mcp-toolkit/shared

Shared configuration packages for MCP Toolkit monorepo.

## Packages

This directory contains shared configuration packages used across the monorepo:

| Package | Purpose |
|---------|---------|
| `@mcp-toolkit/typescript-config` | Shared TypeScript configuration |
| `@mcp-toolkit/vitest-config` | Shared Vitest test configuration |
| `@mcp-toolkit/esbuild-config` | Shared esbuild bundler configuration |

## TypeScript Config

### Usage

In your package's `tsconfig.json`:

```json
{
  "extends": "@mcp-toolkit/typescript-config/library.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Available Configs

- `base.json` - Base TypeScript settings
- `library.json` - For library packages (extends base)

### Key Settings

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

## Vitest Config

### Usage

In your package's `vitest.config.ts`:

```typescript
import { defineConfig } from "@mcp-toolkit/vitest-config";

export default defineConfig({
  // Package-specific overrides
});
```

Or extend directly:

```typescript
import { defineConfig } from "vitest/config";
import baseConfig from "@mcp-toolkit/vitest-config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    // Your overrides
  },
});
```

### Default Settings

- Uses V8 coverage provider
- Includes `src/**/*.test.ts` test files
- Configured for ESM modules

## esbuild Config

### Usage

For bundling packages:

```typescript
import { build } from "esbuild";
import { baseConfig } from "@mcp-toolkit/esbuild-config";

await build({
  ...baseConfig,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
});
```

### Default Settings

- Target: ES2022
- Format: ESM
- Bundling enabled
- Source maps enabled

## Adding New Shared Configs

1. Create a new directory under `packages/shared/`
2. Add a `package.json` with the config name
3. Export configuration files
4. Reference in consuming packages

## Build Commands

Shared configs don't typically need building, but if they include TypeScript:

```bash
pnpm build          # Build all shared packages
pnpm typecheck      # Type check
```
