/**
 * In-Memory Provider - Reference implementation with no external dependencies
 *
 * This provider stores session data in memory. Useful for:
 * - Development and testing
 * - Single-session use cases
 * - As a reference for implementing custom providers
 */

import {
  type SessionConfig,
  SessionConfigSchema,
  SessionFeaturesSchema,
  type SessionInitInput,
  type SessionUpdateInput,
} from "@mcp-toolkit/model";
import type { ProviderResult, SessionProvider } from "./interface.js";

export class MemoryProvider implements SessionProvider {
  readonly name = "memory";
  private session: SessionConfig | null = null;

  async initSession(input: SessionInitInput): Promise<ProviderResult<SessionConfig>> {
    try {
      const now = new Date().toISOString();

      // Apply defaults to features
      const features = SessionFeaturesSchema.parse(input.features ?? {});

      const config: SessionConfig = {
        projectName: input.projectName,
        features,
        createdAt: now,
        updatedAt: now,
      };

      // Validate complete config
      const validated = SessionConfigSchema.parse(config);
      this.session = validated;

      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize session",
      };
    }
  }

  async getSession(): Promise<ProviderResult<SessionConfig | null>> {
    return { success: true, data: this.session };
  }

  async updateSession(input: SessionUpdateInput): Promise<ProviderResult<SessionConfig>> {
    if (!this.session) {
      return { success: false, error: "No session to update" };
    }

    try {
      const updated: SessionConfig = {
        ...this.session,
        ...input,
        features: input.features
          ? { ...this.session.features, ...input.features }
          : this.session.features,
        updatedAt: new Date().toISOString(),
      };

      const validated = SessionConfigSchema.parse(updated);
      this.session = validated;

      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update session",
      };
    }
  }

  async clearSession(): Promise<ProviderResult<void>> {
    this.session = null;
    return { success: true };
  }

  async hasSession(): Promise<boolean> {
    return this.session !== null;
  }
}

/**
 * Factory function for creating a memory provider
 */
export function createMemoryProvider(): SessionProvider {
  return new MemoryProvider();
}
