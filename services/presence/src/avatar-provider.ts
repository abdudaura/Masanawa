import {
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type CharacterVersionId,
  type ExternalReference,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";

export const avatarRendererKinds = [
  "static-image",
  "live2d",
  "vrm",
  "mmd",
  "spine",
  "remote-avatar",
] as const;

export type AvatarRendererKind = (typeof avatarRendererKinds)[number];

export interface AvatarAppearanceReference extends ExternalReference {
  readonly mediaType?: string;
}

export interface AvatarProviderDescriptor {
  readonly providerKey: string;
  readonly ready: boolean;
  readonly rendererKinds: readonly AvatarRendererKind[];
  readonly acceptedMediaTypes: readonly string[];
  readonly observedAt: Instant;
  readonly reason: string | null;
}

export interface AvatarPresentationRequest {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly appearanceReference: AvatarAppearanceReference;
  readonly preferredRendererKinds: readonly AvatarRendererKind[];
  readonly allowAudioOnlyFallback: boolean;
  readonly now: Instant;
}

export type AvatarPresentationPlan =
  | {
      readonly mode: "avatar";
      readonly providerKey: string;
      readonly rendererKind: AvatarRendererKind;
      readonly tenantId: TenantId;
      readonly characterId: CharacterId;
      readonly characterVersionId: CharacterVersionId;
      readonly appearanceReference: AvatarAppearanceReference;
    }
  | {
      readonly mode: "audio-only";
      readonly providerKey: null;
      readonly rendererKind: null;
      readonly tenantId: TenantId;
      readonly characterId: CharacterId;
      readonly characterVersionId: CharacterVersionId;
      readonly appearanceReference: null;
      readonly reason: "no-compatible-renderer";
    };

export interface AvatarPresentationLease {
  readonly leaseId: string;
  readonly providerKey: string;
  readonly rendererKind: AvatarRendererKind;
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly appearanceReference: AvatarAppearanceReference;
  readonly openedAt: Instant;
  readonly expiresAt: Instant | null;
}

export interface AvatarProvider {
  descriptor(input: {
    readonly tenantId: TenantId;
    readonly observedAt: Instant;
  }): Promise<AvatarProviderDescriptor>;

  open(input: {
    readonly plan: Extract<AvatarPresentationPlan, { readonly mode: "avatar" }>;
    readonly requestKey: string;
    readonly now: Instant;
  }): Promise<AvatarPresentationLease>;

  close(input: {
    readonly leaseId: string;
    readonly reason: "ended" | "replaced" | "provider-failed";
  }): Promise<void>;
}

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function rendererKind(value: string): AvatarRendererKind {
  if (!avatarRendererKinds.includes(value as AvatarRendererKind)) {
    throw new TypeError("renderer kind is invalid");
  }
  return value as AvatarRendererKind;
}

function mediaType(value: string): string {
  const normalized = bounded(value, "mediaType", 3, 160).toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(normalized)) {
    throw new TypeError("mediaType is invalid");
  }
  return normalized;
}

function normalizeReference(
  input: AvatarAppearanceReference,
  now: Instant,
): AvatarAppearanceReference {
  const observedAt = toInstant(input.observedAt);
  const expiresAt =
    input.expiresAt === undefined ? undefined : toInstant(input.expiresAt);
  const instantNow = toInstant(now);

  if (observedAt > instantNow) {
    throw new Error("Appearance reference was observed in the future");
  }
  if (expiresAt !== undefined && expiresAt <= instantNow) {
    throw new Error("Appearance reference expired");
  }

  const provenance =
    input.provenance === undefined
      ? undefined
      : Object.freeze(
          Object.fromEntries(
            Object.entries(input.provenance).map(([key, value]) => [
              bounded(key, "provenance key", 1, 120),
              bounded(value, "provenance value", 0, 500),
            ]),
          ),
        );

  return Object.freeze({
    system: bounded(input.system, "appearance.system", 1, 120),
    namespace: bounded(input.namespace, "appearance.namespace", 1, 160),
    value: bounded(input.value, "appearance.value", 1, 2048),
    observedAt,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    ...(provenance === undefined ? {} : { provenance }),
    ...(input.mediaType === undefined
      ? {}
      : { mediaType: mediaType(input.mediaType) }),
  });
}

export function normalizeAvatarProviderDescriptor(
  input: AvatarProviderDescriptor,
): AvatarProviderDescriptor {
  if (typeof input.ready !== "boolean") {
    throw new TypeError("provider ready must be boolean");
  }
  const rendererKinds = input.rendererKinds.map(rendererKind);
  if (rendererKinds.length < 1 || rendererKinds.length > avatarRendererKinds.length) {
    throw new RangeError("provider rendererKinds are invalid");
  }
  if (new Set(rendererKinds).size !== rendererKinds.length) {
    throw new TypeError("provider rendererKinds must be unique");
  }

  const acceptedMediaTypes = input.acceptedMediaTypes.map(mediaType);
  if (acceptedMediaTypes.length < 1 || acceptedMediaTypes.length > 64) {
    throw new RangeError("provider acceptedMediaTypes are invalid");
  }
  if (new Set(acceptedMediaTypes).size !== acceptedMediaTypes.length) {
    throw new TypeError("provider acceptedMediaTypes must be unique");
  }

  return Object.freeze({
    providerKey: bounded(input.providerKey, "providerKey", 3, 120),
    ready: input.ready,
    rendererKinds: Object.freeze(rendererKinds),
    acceptedMediaTypes: Object.freeze(acceptedMediaTypes),
    observedAt: toInstant(input.observedAt),
    reason:
      input.reason === null
        ? null
        : bounded(input.reason, "provider reason", 1, 500),
  });
}

export function planAvatarPresentation(input: {
  readonly request: AvatarPresentationRequest;
  readonly providers: readonly AvatarProviderDescriptor[];
}): AvatarPresentationPlan {
  const request = input.request;
  const tenantId = parseCanonicalId("tenant", request.tenantId);
  const characterId = parseCanonicalId("character", request.characterId);
  const characterVersionId = parseCanonicalId(
    "character-version",
    request.characterVersionId,
  );
  const now = toInstant(request.now);
  const appearanceReference = normalizeReference(
    request.appearanceReference,
    now,
  );
  const preferredRendererKinds = request.preferredRendererKinds.map(rendererKind);
  if (
    preferredRendererKinds.length < 1 ||
    preferredRendererKinds.length > avatarRendererKinds.length ||
    new Set(preferredRendererKinds).size !== preferredRendererKinds.length
  ) {
    throw new TypeError("preferredRendererKinds are invalid");
  }

  const referenceMediaType =
    appearanceReference.mediaType === undefined
      ? null
      : mediaType(appearanceReference.mediaType);

  const providers = input.providers
    .map(normalizeAvatarProviderDescriptor)
    .filter((provider) => provider.ready)
    .sort((a, b) => a.providerKey.localeCompare(b.providerKey));

  for (const kind of preferredRendererKinds) {
    const provider = providers.find(
      (candidate) =>
        candidate.rendererKinds.includes(kind) &&
        (referenceMediaType === null ||
          candidate.acceptedMediaTypes.includes(referenceMediaType)),
    );
    if (provider !== undefined) {
      return Object.freeze({
        mode: "avatar" as const,
        providerKey: provider.providerKey,
        rendererKind: kind,
        tenantId,
        characterId,
        characterVersionId,
        appearanceReference,
      });
    }
  }

  if (request.allowAudioOnlyFallback) {
    return Object.freeze({
      mode: "audio-only" as const,
      providerKey: null,
      rendererKind: null,
      tenantId,
      characterId,
      characterVersionId,
      appearanceReference: null,
      reason: "no-compatible-renderer" as const,
    });
  }

  throw new Error("No compatible ready avatar renderer");
}

function sameReference(
  left: AvatarAppearanceReference,
  right: AvatarAppearanceReference,
): boolean {
  return (
    left.system === right.system &&
    left.namespace === right.namespace &&
    left.value === right.value &&
    left.observedAt === right.observedAt &&
    left.expiresAt === right.expiresAt &&
    left.mediaType === right.mediaType
  );
}

export function assertAvatarLeaseMatchesPlan(input: {
  readonly plan: Extract<AvatarPresentationPlan, { readonly mode: "avatar" }>;
  readonly lease: AvatarPresentationLease;
  readonly now: Instant;
}): AvatarPresentationLease {
  const plan = input.plan;
  const lease = input.lease;

  if (
    lease.tenantId !== plan.tenantId ||
    lease.characterId !== plan.characterId ||
    lease.characterVersionId !== plan.characterVersionId
  ) {
    throw new Error("Avatar lease crossed Character presentation scope");
  }
  if (
    lease.providerKey !== plan.providerKey ||
    lease.rendererKind !== plan.rendererKind
  ) {
    throw new Error("Avatar lease does not match selected provider/renderer");
  }

  const leaseReference = normalizeReference(lease.appearanceReference, input.now);
  if (!sameReference(leaseReference, plan.appearanceReference)) {
    throw new Error("Avatar lease changed the selected appearance reference");
  }

  const openedAt = toInstant(lease.openedAt);
  const expiresAt =
    lease.expiresAt === null ? null : toInstant(lease.expiresAt);
  const now = toInstant(input.now);
  if (openedAt > now || (expiresAt !== null && expiresAt <= now)) {
    throw new Error("Avatar lease is not currently usable");
  }

  return Object.freeze({
    leaseId: bounded(lease.leaseId, "leaseId", 8, 256),
    providerKey: plan.providerKey,
    rendererKind: plan.rendererKind,
    tenantId: plan.tenantId,
    characterId: plan.characterId,
    characterVersionId: plan.characterVersionId,
    appearanceReference: leaseReference,
    openedAt,
    expiresAt,
  });
}
