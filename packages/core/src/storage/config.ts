/**
 * Session config construction and mutation
 *
 * Shared by every provider so that validation, defaulting and timestamp
 * handling behave identically no matter where the session is stored. A provider
 * should only be responsible for *persistence*; the shape of a session is
 * decided here, once.
 */

import { randomUUID } from "node:crypto";
import {
  type SessionConfig,
  SessionConfigSchema,
  type SessionCreateInput,
  SessionFeaturesSchema,
  type SessionUpdateInput,
  ToolDelegationConfigSchema,
} from "@mcp-toolkit/model";

/**
 * Storage envelope wrapping a session with its expiry.
 *
 * Expiry is deliberately kept out of `SessionConfig`: when a session dies is a
 * property of the store, not of the session itself.
 */
export interface SessionRecord {
  config: SessionConfig;
  /** Epoch millis after which this record is dead, or null for no expiry */
  expiresAt: number | null;
}

/**
 * Compute an expiry stamp from a TTL, or null when the provider has no TTL.
 */
export function computeExpiry(ttlMs?: number, now: number = Date.now()): number | null {
  return ttlMs === undefined ? null : now + ttlMs;
}

/**
 * Whether a record has passed its expiry.
 */
export function isExpired(record: SessionRecord, now: number = Date.now()): boolean {
  return record.expiresAt !== null && record.expiresAt <= now;
}

/**
 * Build a validated session config from init input.
 *
 * Mints a handle unless the caller supplies one.
 *
 * @throws {ZodError} when the resulting config fails validation
 */
export function buildSessionConfig(input: SessionCreateInput, sessionId?: string): SessionConfig {
  const now = new Date().toISOString();

  // Apply defaults to features and tool delegations
  const features = SessionFeaturesSchema.parse(input.features ?? {});
  const toolDelegations = ToolDelegationConfigSchema.parse({});

  return SessionConfigSchema.parse({
    sessionId: sessionId ?? randomUUID(),
    projectName: input.projectName,
    features,
    clientMetadata: input.clientMetadata,
    toolDelegations,
    createdAt: now,
    updatedAt: now,
  } satisfies SessionConfig);
}

/**
 * Apply an update to an existing session config.
 *
 * `sessionId` and `createdAt` are immutable - the handle identifies the record
 * and the creation stamp is history. Features merge rather than replace, so a
 * partial feature update does not silently reset the others.
 *
 * @throws {ZodError} when the resulting config fails validation
 */
export function applySessionUpdate(
  existing: SessionConfig,
  input: SessionUpdateInput
): SessionConfig {
  return SessionConfigSchema.parse({
    ...existing,
    ...input,
    sessionId: existing.sessionId,
    createdAt: existing.createdAt,
    features: input.features ? { ...existing.features, ...input.features } : existing.features,
    updatedAt: new Date().toISOString(),
  } satisfies SessionConfig);
}

/**
 * Normalise a thrown value into a provider error string.
 */
export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
