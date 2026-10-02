import {
  PlatformError,
  isCanonicalId,
  normalizeCapabilityKey,
  type CapabilityKey,
  type ProviderId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeProviderDefinition,
  normalizeProviderKey,
  normalizeProviderReadiness,
  normalizeProviderVersion,
  type ProviderDefinition,
  type ProviderReadiness,
} from "./model.js";

export interface ProviderRegistration {
  readonly provider: ProviderDefinition;
  readonly reused: boolean;
}

export interface ProviderSelectionRequest {
  readonly capability: CapabilityKey | string;
  readonly providerId?: ProviderId;
  readonly providerKey?: string;
  readonly providerVersion?: string;
}

export interface ProviderSelection {
  readonly provider: ProviderDefinition;
  readonly readiness: ProviderReadiness;
}

export interface ProviderRegistry {
  register(definition: ProviderDefinition): ProviderRegistration;
  setReadiness(readiness: ProviderReadiness): ProviderReadiness;
  get(providerId: ProviderId): ProviderDefinition | null;
  getReadiness(providerId: ProviderId): ProviderReadiness | null;
  list(): readonly ProviderDefinition[];
  select(request: ProviderSelectionRequest): ProviderSelection;
}

interface RegisteredProvider {
  readonly definition: ProviderDefinition;
  readonly fingerprint: string;
}

function definitionFingerprint(definition: ProviderDefinition): string {
  return fingerprintCanonicalJson(definition);
}

function providerKeyVersion(key: string, version: string): string {
  return `${key}@${version}`;
}

function providerError(
  code: string,
  category: "not-found" | "conflict" | "validation",
  message: string,
): PlatformError {
  return new PlatformError({
    code,
    category,
    message,
    retryable: false,
  });
}

function assertSelectionShape(
  request: ProviderSelectionRequest,
): {
  readonly capability: CapabilityKey;
  readonly providerId: ProviderId | null;
  readonly providerKey: string | null;
  readonly providerVersion: string | null;
} {
  const capability = normalizeCapabilityKey(request.capability);
  const hasId = request.providerId !== undefined;
  const hasKey = request.providerKey !== undefined;
  const hasVersion = request.providerVersion !== undefined;

  if (hasId && (hasKey || hasVersion)) {
    throw providerError(
      "provider.selection_ambiguous",
      "validation",
      "Provider selection must use either providerId or exact key/version",
    );
  }
  if (hasKey !== hasVersion) {
    throw providerError(
      "provider.selection_incomplete",
      "validation",
      "Provider key selection requires both key and version",
    );
  }
  if (
    request.providerId !== undefined &&
    !isCanonicalId("provider", request.providerId)
  ) {
    throw providerError(
      "provider.selection_invalid_id",
      "validation",
      "Explicit ProviderId is invalid",
    );
  }

  return Object.freeze({
    capability,
    providerId: request.providerId ?? null,
    providerKey:
      request.providerKey === undefined
        ? null
        : normalizeProviderKey(request.providerKey),
    providerVersion:
      request.providerVersion === undefined
        ? null
        : normalizeProviderVersion(request.providerVersion),
  });
}

function assertEligible(
  registered: RegisteredProvider,
  readiness: ProviderReadiness | undefined,
  capability: CapabilityKey,
  explicit: boolean,
): ProviderSelection {
  if (!registered.definition.capabilities.includes(capability)) {
    throw providerError(
      explicit
        ? "provider.explicit_capability_unsupported"
        : "provider.capability_unavailable",
      "conflict",
      explicit
        ? "Explicit provider does not advertise the requested capability"
        : "No ready provider advertises the requested capability",
    );
  }
  if (!readiness || readiness.state !== "ready") {
    throw providerError(
      explicit
        ? "provider.explicit_not_ready"
        : "provider.capability_unavailable",
      "conflict",
      explicit
        ? "Explicit provider is not ready"
        : "No ready provider is available for the requested capability",
    );
  }
  return Object.freeze({
    provider: registered.definition,
    readiness,
  });
}

export function createProviderRegistry(): ProviderRegistry {
  const byId = new Map<ProviderId, RegisteredProvider>();
  const byKeyVersion = new Map<string, ProviderId>();
  const readiness = new Map<ProviderId, ProviderReadiness>();

  return Object.freeze({
    register(input: ProviderDefinition): ProviderRegistration {
      const definition = normalizeProviderDefinition(input);
      const fingerprint = definitionFingerprint(definition);
      const existingById = byId.get(definition.providerId);
      if (existingById) {
        if (existingById.fingerprint !== fingerprint) {
          throw providerError(
            "provider.registration_id_conflict",
            "conflict",
            "ProviderId is already bound to a different definition",
          );
        }
        return Object.freeze({
          provider: existingById.definition,
          reused: true,
        });
      }

      const keyVersion = providerKeyVersion(
        definition.key,
        definition.version,
      );
      const existingId = byKeyVersion.get(keyVersion);
      if (existingId) {
        throw providerError(
          "provider.registration_key_version_conflict",
          "conflict",
          "Provider key/version is already bound to another ProviderId",
        );
      }

      const registered = Object.freeze({ definition, fingerprint });
      byId.set(definition.providerId, registered);
      byKeyVersion.set(keyVersion, definition.providerId);
      return Object.freeze({ provider: definition, reused: false });
    },

    setReadiness(input: ProviderReadiness): ProviderReadiness {
      const normalized = normalizeProviderReadiness(input);
      if (!byId.has(normalized.providerId)) {
        throw providerError(
          "provider.readiness_not_registered",
          "not-found",
          "Provider must be registered before readiness can be published",
        );
      }
      const prior = readiness.get(normalized.providerId);
      if (
        prior &&
        Date.parse(normalized.checkedAt) < Date.parse(prior.checkedAt)
      ) {
        throw providerError(
          "provider.readiness_stale",
          "conflict",
          "Provider readiness observation is older than the current observation",
        );
      }
      readiness.set(normalized.providerId, normalized);
      return normalized;
    },

    get(providerId: ProviderId): ProviderDefinition | null {
      return byId.get(providerId)?.definition ?? null;
    },

    getReadiness(providerId: ProviderId): ProviderReadiness | null {
      return readiness.get(providerId) ?? null;
    },

    list(): readonly ProviderDefinition[] {
      return Object.freeze(
        [...byId.values()]
          .map((entry) => entry.definition)
          .sort(
            (left, right) =>
              left.selectionPriority - right.selectionPriority ||
              left.key.localeCompare(right.key) ||
              left.version.localeCompare(right.version) ||
              left.providerId.localeCompare(right.providerId),
          ),
      );
    },

    select(request: ProviderSelectionRequest): ProviderSelection {
      const selection = assertSelectionShape(request);

      if (selection.providerId !== null) {
        const registered = byId.get(selection.providerId);
        if (!registered) {
          throw providerError(
            "provider.explicit_not_found",
            "not-found",
            "Explicit provider is not registered",
          );
        }
        return assertEligible(
          registered,
          readiness.get(selection.providerId),
          selection.capability,
          true,
        );
      }

      if (
        selection.providerKey !== null &&
        selection.providerVersion !== null
      ) {
        const providerId = byKeyVersion.get(
          providerKeyVersion(
            selection.providerKey,
            selection.providerVersion,
          ),
        );
        if (!providerId) {
          throw providerError(
            "provider.explicit_not_found",
            "not-found",
            "Explicit provider key/version is not registered",
          );
        }
        return assertEligible(
          byId.get(providerId)!,
          readiness.get(providerId),
          selection.capability,
          true,
        );
      }

      const eligible = [...byId.values()]
        .filter(
          (entry) =>
            entry.definition.capabilities.includes(selection.capability) &&
            readiness.get(entry.definition.providerId)?.state === "ready",
        )
        .sort(
          (left, right) =>
            left.definition.selectionPriority -
              right.definition.selectionPriority ||
            left.definition.key.localeCompare(right.definition.key) ||
            left.definition.version.localeCompare(right.definition.version) ||
            left.definition.providerId.localeCompare(
              right.definition.providerId,
            ),
        );

      const selected = eligible[0];
      if (!selected) {
        throw providerError(
          "provider.capability_unavailable",
          "conflict",
          "No ready provider is available for the requested capability",
        );
      }
      return assertEligible(
        selected,
        readiness.get(selected.definition.providerId),
        selection.capability,
        false,
      );
    },
  });
}
