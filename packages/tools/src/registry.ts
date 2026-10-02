import {
  PlatformError,
  normalizeCapabilityKey,
  type CapabilityKey,
  type ToolId,
  type ToolVersionId,
} from "@masanawa/contracts";
import {
  type ProviderRegistry,
  type ProviderSelection,
  type ProviderSelectionRequest,
} from "@masanawa/providers";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeCapabilityDefinition,
  normalizeToolDefinition,
  normalizeToolKey,
  normalizeToolVersion,
  type CapabilityDefinition,
  type ToolDefinition,
} from "./model.js";

export interface CapabilityRegistration {
  readonly capability: CapabilityDefinition;
  readonly reused: boolean;
}

export interface ToolRegistration {
  readonly tool: ToolDefinition;
  readonly reused: boolean;
}

export interface ToolProviderSelectionRequest {
  readonly providerId?: ProviderSelectionRequest["providerId"];
  readonly providerKey?: string;
  readonly providerVersion?: string;
}

export interface ToolRegistry {
  registerCapability(
    definition: CapabilityDefinition,
  ): CapabilityRegistration;
  registerTool(definition: ToolDefinition): ToolRegistration;
  getCapability(key: CapabilityKey | string): CapabilityDefinition | null;
  getToolVersion(toolVersionId: ToolVersionId): ToolDefinition | null;
  getToolByKeyVersion(key: string, version: string): ToolDefinition | null;
  listCapabilities(): readonly CapabilityDefinition[];
  listToolVersions(): readonly ToolDefinition[];
}

function toolError(
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

function keyVersion(key: string, version: string): string {
  return `${key}@${version}`;
}

export function createToolRegistry(): ToolRegistry {
  const capabilities = new Map<
    CapabilityKey,
    {
      readonly definition: CapabilityDefinition;
      readonly fingerprint: string;
    }
  >();
  const toolsByVersionId = new Map<
    ToolVersionId,
    {
      readonly definition: ToolDefinition;
      readonly fingerprint: string;
    }
  >();
  const toolIdByKey = new Map<string, ToolId>();
  const versionIdByKeyVersion = new Map<string, ToolVersionId>();

  return Object.freeze({
    registerCapability(input: CapabilityDefinition): CapabilityRegistration {
      const definition = normalizeCapabilityDefinition(input);
      const fingerprint = fingerprintCanonicalJson(definition);
      const existing = capabilities.get(definition.key);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw toolError(
            "tool.capability_registration_conflict",
            "conflict",
            "Capability key is already bound to a different definition",
          );
        }
        return Object.freeze({
          capability: existing.definition,
          reused: true,
        });
      }
      capabilities.set(
        definition.key,
        Object.freeze({ definition, fingerprint }),
      );
      return Object.freeze({ capability: definition, reused: false });
    },

    registerTool(input: ToolDefinition): ToolRegistration {
      const definition = normalizeToolDefinition(input);
      for (const capability of definition.capabilities) {
        if (!capabilities.has(capability)) {
          throw toolError(
            "tool.capability_not_registered",
            "validation",
            "Tool references an unregistered capability",
          );
        }
      }
      if (
        definition.providerRequirement !== null &&
        !capabilities.has(definition.providerRequirement.capability)
      ) {
        throw toolError(
          "tool.provider_capability_not_registered",
          "validation",
          "Tool provider requirement references an unregistered capability",
        );
      }

      const fingerprint = fingerprintCanonicalJson(definition);
      const existingVersion = toolsByVersionId.get(
        definition.toolVersionId,
      );
      if (existingVersion) {
        if (existingVersion.fingerprint !== fingerprint) {
          throw toolError(
            "tool.version_registration_conflict",
            "conflict",
            "ToolVersionId is already bound to a different definition",
          );
        }
        return Object.freeze({
          tool: existingVersion.definition,
          reused: true,
        });
      }

      const existingToolId = toolIdByKey.get(definition.key);
      if (
        existingToolId !== undefined &&
        existingToolId !== definition.toolId
      ) {
        throw toolError(
          "tool.key_registration_conflict",
          "conflict",
          "Tool key is already bound to another ToolId",
        );
      }

      const kv = keyVersion(definition.key, definition.version);
      const existingVersionId = versionIdByKeyVersion.get(kv);
      if (
        existingVersionId !== undefined &&
        existingVersionId !== definition.toolVersionId
      ) {
        throw toolError(
          "tool.key_version_registration_conflict",
          "conflict",
          "Tool key/version is already bound to another ToolVersionId",
        );
      }

      const sameToolVersions = [...toolsByVersionId.values()].filter(
        (entry) => entry.definition.toolId === definition.toolId,
      );
      if (
        sameToolVersions.some(
          (entry) => entry.definition.key !== definition.key,
        )
      ) {
        throw toolError(
          "tool.id_key_conflict",
          "conflict",
          "ToolId cannot be rebound to a different tool key",
        );
      }

      toolsByVersionId.set(
        definition.toolVersionId,
        Object.freeze({ definition, fingerprint }),
      );
      toolIdByKey.set(definition.key, definition.toolId);
      versionIdByKeyVersion.set(kv, definition.toolVersionId);
      return Object.freeze({ tool: definition, reused: false });
    },

    getCapability(key: CapabilityKey | string): CapabilityDefinition | null {
      return capabilities.get(normalizeCapabilityKey(key))?.definition ?? null;
    },

    getToolVersion(toolVersionId: ToolVersionId): ToolDefinition | null {
      return toolsByVersionId.get(toolVersionId)?.definition ?? null;
    },

    getToolByKeyVersion(key: string, version: string): ToolDefinition | null {
      const versionId = versionIdByKeyVersion.get(
        keyVersion(normalizeToolKey(key), normalizeToolVersion(version)),
      );
      return versionId
        ? toolsByVersionId.get(versionId)?.definition ?? null
        : null;
    },

    listCapabilities(): readonly CapabilityDefinition[] {
      return Object.freeze(
        [...capabilities.values()]
          .map((entry) => entry.definition)
          .sort((left, right) => left.key.localeCompare(right.key)),
      );
    },

    listToolVersions(): readonly ToolDefinition[] {
      return Object.freeze(
        [...toolsByVersionId.values()]
          .map((entry) => entry.definition)
          .sort(
            (left, right) =>
              left.key.localeCompare(right.key) ||
              left.version.localeCompare(right.version) ||
              left.toolVersionId.localeCompare(right.toolVersionId),
          ),
      );
    },
  });
}

export function selectProviderForTool(
  tool: ToolDefinition,
  providers: ProviderRegistry,
  explicit: ToolProviderSelectionRequest = {},
): ProviderSelection | null {
  if (tool.providerRequirement === null) {
    if (
      explicit.providerId !== undefined ||
      explicit.providerKey !== undefined ||
      explicit.providerVersion !== undefined
    ) {
      throw toolError(
        "tool.provider_not_applicable",
        "validation",
        "Provider selection was supplied for a provider-independent Tool",
      );
    }
    return null;
  }

  return providers.select({
    capability: tool.providerRequirement.capability,
    ...(explicit.providerId !== undefined
      ? { providerId: explicit.providerId }
      : {}),
    ...(explicit.providerKey !== undefined
      ? { providerKey: explicit.providerKey }
      : {}),
    ...(explicit.providerVersion !== undefined
      ? { providerVersion: explicit.providerVersion }
      : {}),
  });
}
