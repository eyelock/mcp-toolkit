/**
 * Init Command
 *
 * CLI equivalent of session_init MCP tool.
 * Demonstrates CLI/MCP parity pattern.
 */

import { SessionFeaturesSchema } from "@mcp-toolkit/model";
import { createMemoryProvider } from "@mcp-toolkit/provider";
import { Args, Command, Flags } from "@oclif/core";

export default class Init extends Command {
  static override description = "Initialize a new session with project configuration";

  static override examples = [
    "<%= config.bin %> init my-project",
    "<%= config.bin %> init my-project --tools --resources --prompts",
    "<%= config.bin %> init my-project --all-features",
  ];

  static override flags = {
    tools: Flags.boolean({
      description: "Enable tools feature",
      default: true,
      allowNo: true,
    }),
    resources: Flags.boolean({
      description: "Enable resources feature",
      default: true,
      allowNo: true,
    }),
    prompts: Flags.boolean({
      description: "Enable prompts feature",
      default: false,
      allowNo: true,
    }),
    sampling: Flags.boolean({
      description: "Enable sampling feature",
      default: false,
      allowNo: true,
    }),
    "all-features": Flags.boolean({
      description: "Enable all features",
      default: false,
    }),
  };

  static override args = {
    projectName: Args.string({
      description: "Project name (kebab-case)",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Init);

    // Validate project name format
    if (!/^[a-z0-9-]+$/.test(args.projectName)) {
      this.error("Project name must be kebab-case (lowercase letters, numbers, and hyphens only)");
    }

    // Determine features
    const features = flags["all-features"]
      ? { tools: true, resources: true, prompts: true, sampling: true }
      : {
          tools: flags.tools,
          resources: flags.resources,
          prompts: flags.prompts,
          sampling: flags.sampling,
        };

    // Validate features
    const validatedFeatures = SessionFeaturesSchema.parse(features);

    // Use provider (in real implementation, this would persist)
    const provider = createMemoryProvider();
    const result = await provider.initSession({
      projectName: args.projectName,
      features: validatedFeatures,
    });

    if (!result.success) {
      this.error(`Failed to initialize session: ${result.error}`);
    }

    const session = result.data!;
    const enabledFeatures = Object.entries(session.features)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    this.log("");
    this.log("✓ Session initialized successfully!");
    this.log("");
    this.log(`  Project:  ${session.projectName}`);
    this.log(`  Features: ${enabledFeatures.join(", ") || "none"}`);
    this.log(`  Created:  ${session.createdAt}`);
    this.log("");
  }
}
