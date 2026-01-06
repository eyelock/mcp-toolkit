import esbuild from "esbuild";

/**
 * Default esbuild configuration for MCP Toolkit packages
 * @param {import("esbuild").BuildOptions} options
 * @returns {import("esbuild").BuildOptions}
 */
export function createBuildConfig(options = {}) {
  return {
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outdir: "dist",
    sourcemap: true,
    external: [],
    ...options,
  };
}

/**
 * Build with the default configuration
 * @param {import("esbuild").BuildOptions} options
 */
export async function build(options = {}) {
  await esbuild.build(createBuildConfig(options));
}

export default { createBuildConfig, build };
