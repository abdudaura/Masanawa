import {
  isCanonicalId,
  type ToolVersionId,
} from "@masanawa/contracts";
import type { ProviderSelectionRequest } from "@masanawa/providers";
import {
  canonicalJson,
  type AuthorityContext,
  type CanonicalJson,
} from "@masanawa/security";

export interface ToolInvocation {
  readonly toolVersionId: ToolVersionId;
  readonly authority: AuthorityContext;
  readonly input: CanonicalJson;
  readonly idempotencyKey: string | null;
  readonly providerSelection: Omit<
    ProviderSelectionRequest,
    "capability"
  > | null;
}

export interface NormalizedToolInvocation extends ToolInvocation {
  readonly idempotencyKey: string | null;
}

function boundedIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 256) {
    throw new TypeError("tool idempotencyKey is invalid");
  }
  return normalized;
}

function freezeCanonical(value: CanonicalJson): CanonicalJson {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeCanonical));
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, CanonicalJson> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = freezeCanonical(item);
    }
    return Object.freeze(output);
  }
  return value;
}

export function normalizeToolInvocation(
  input: ToolInvocation,
): NormalizedToolInvocation {
  // Canonical JSON validation rejects undefined, non-finite numbers and
  // executable/non-data values before an adapter ever sees the payload.
  const parsed = JSON.parse(canonicalJson(input.input)) as CanonicalJson;

  if (!isCanonicalId("tool-version", input.toolVersionId)) {
    throw new TypeError("toolVersionId is invalid");
  }

  let providerSelection: NormalizedToolInvocation["providerSelection"] = null;
  if (input.providerSelection !== null) {
    if (
      input.providerSelection.providerId === undefined &&
      input.providerSelection.providerKey === undefined &&
      input.providerSelection.providerVersion === undefined
    ) {
      throw new TypeError(
        "providerSelection must identify an explicit provider",
      );
    }
    providerSelection = Object.freeze({
      ...(input.providerSelection.providerId !== undefined
        ? { providerId: input.providerSelection.providerId }
        : {}),
      ...(input.providerSelection.providerKey !== undefined
        ? { providerKey: input.providerSelection.providerKey.trim() }
        : {}),
      ...(input.providerSelection.providerVersion !== undefined
        ? { providerVersion: input.providerSelection.providerVersion.trim() }
        : {}),
    });
  }

  return Object.freeze({
    toolVersionId: input.toolVersionId,
    authority: input.authority,
    input: freezeCanonical(parsed),
    idempotencyKey:
      input.idempotencyKey === null
        ? null
        : boundedIdempotencyKey(input.idempotencyKey),
    providerSelection,
  });
}
