import {
  isCanonicalId,
  toInstant,
  type ExternalReference,
  type ExternalSubjectRef,
} from "@masanawa/contracts";
import type {
  SocialAccountBinding,
  SocialAudienceIntent,
  SocialContent,
} from "./model.js";

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("revision must be a positive safe integer");
  }
  return value;
}

function normalizeExternalReference(
  input: ExternalReference,
): ExternalReference {
  const observedAt = toInstant(input.observedAt);
  const expiresAt =
    input.expiresAt === undefined ? undefined : toInstant(input.expiresAt);
  if (expiresAt !== undefined && expiresAt <= observedAt) {
    throw new Error("external reference expiry must follow observation");
  }
  const provenance = input.provenance
    ? Object.freeze(
        Object.fromEntries(
          Object.entries(input.provenance).map(([key, value]) => [
            bounded(key, "provenance key", 1, 100),
            bounded(value, "provenance value", 1, 500),
          ]),
        ),
      )
    : undefined;

  return Object.freeze({
    system: bounded(input.system, "external system", 1, 100).toLowerCase(),
    namespace: bounded(input.namespace, "external namespace", 1, 160),
    value: bounded(input.value, "external value", 1, 512),
    observedAt,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    ...(provenance === undefined ? {} : { provenance }),
  });
}

function normalizeAccount(
  input: ExternalSubjectRef,
): ExternalSubjectRef {
  const base = normalizeExternalReference(input);
  if (input.subjectKind !== "user" && input.subjectKind !== "channel") {
    throw new TypeError("social account subjectKind must be user or channel");
  }
  if (
    input.authenticationStrength !== "linked" &&
    input.authenticationStrength !== "strong"
  ) {
    throw new Error("social account binding requires linked or strong identity evidence");
  }
  return Object.freeze({
    ...base,
    subjectKind: input.subjectKind,
    ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
    authenticationStrength: input.authenticationStrength,
  });
}

export function socialAccountKey(
  account: Pick<ExternalSubjectRef, "system" | "namespace" | "value">,
): string {
  return [
    bounded(account.system, "external system", 1, 100).toLowerCase(),
    encodeURIComponent(
      bounded(account.namespace, "external namespace", 1, 160),
    ),
    encodeURIComponent(bounded(account.value, "external value", 1, 512)),
  ].join(":");
}

export function createSocialAccountBinding(input: Omit<
  SocialAccountBinding,
  "accountKey" | "state" | "revision" | "updatedAt" | "revokedAt"
>): SocialAccountBinding {
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("tenantId is invalid");
  }
  if (!isCanonicalId("character", input.characterId)) {
    throw new TypeError("characterId is invalid");
  }
  if (!isCanonicalId("user", input.linkedByUserId)) {
    throw new TypeError("linkedByUserId is invalid");
  }
  const account = normalizeAccount(input.account);
  const linkedAt = toInstant(input.linkedAt);
  if (account.observedAt > linkedAt) {
    throw new Error("social account evidence cannot be observed after linking");
  }

  return Object.freeze({
    tenantId: input.tenantId,
    characterId: input.characterId,
    accountKey: socialAccountKey(account),
    account,
    linkedByUserId: input.linkedByUserId,
    state: "active" as const,
    revision: 1,
    linkedAt,
    updatedAt: linkedAt,
    revokedAt: null,
  });
}

export function revokeSocialAccountBinding(input: {
  readonly binding: SocialAccountBinding;
  readonly expectedRevision: number;
  readonly revokedAt: string;
}): SocialAccountBinding {
  if (revision(input.expectedRevision) !== input.binding.revision) {
    throw new Error("social account binding revision is stale");
  }
  if (input.binding.state === "revoked") return input.binding;
  const revokedAt = toInstant(input.revokedAt);
  if (revokedAt < input.binding.updatedAt) {
    throw new Error("social account binding time cannot move backwards");
  }
  return Object.freeze({
    ...input.binding,
    state: "revoked" as const,
    revision: input.binding.revision + 1,
    updatedAt: revokedAt,
    revokedAt,
  });
}

function audience(value: SocialAudienceIntent): SocialAudienceIntent {
  if (value !== "public" && value !== "followers" && value !== "private") {
    throw new TypeError("social audience is invalid");
  }
  return value;
}

function normalizeMedia(values: readonly ExternalReference[]): readonly ExternalReference[] {
  if (!Array.isArray(values) || values.length > 16) {
    throw new RangeError("social media references are invalid");
  }
  const normalized = values.map(normalizeExternalReference);
  const keys = normalized.map((item) =>
    [item.system, item.namespace, item.value].join(":"),
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("social media references contain duplicates");
  }
  return Object.freeze(normalized);
}

export function createSocialContent(input: {
  readonly binding: SocialAccountBinding;
  readonly socialContentId: SocialContent["socialContentId"];
  readonly text: string | null;
  readonly media: readonly ExternalReference[];
  readonly audience: SocialAudienceIntent;
  readonly createdAt: SocialContent["createdAt"];
}): SocialContent {
  if (input.binding.state !== "active") {
    throw new Error("social content requires an active account binding");
  }
  if (!isCanonicalId("social-content", input.socialContentId)) {
    throw new TypeError("socialContentId is invalid");
  }
  const text =
    input.text === null ? null : bounded(input.text, "social text", 1, 20_000);
  const media = normalizeMedia(input.media);
  if (text === null && media.length === 0) {
    throw new Error("social content must contain text or media");
  }
  const createdAt = toInstant(input.createdAt);

  return Object.freeze({
    tenantId: input.binding.tenantId,
    socialContentId: input.socialContentId,
    characterId: input.binding.characterId,
    accountKey: input.binding.accountKey,
    state: "draft" as const,
    text,
    media,
    audience: audience(input.audience),
    revision: 1,
    createdAt,
    updatedAt: createdAt,
    archivedAt: null,
  });
}

function assertContentBinding(
  content: SocialContent,
  binding: SocialAccountBinding,
): void {
  if (
    binding.state !== "active" ||
    content.tenantId !== binding.tenantId ||
    content.characterId !== binding.characterId ||
    content.accountKey !== binding.accountKey
  ) {
    throw new Error("social content/account binding scope mismatch");
  }
}

export function markSocialContentReady(input: {
  readonly content: SocialContent;
  readonly binding: SocialAccountBinding;
  readonly expectedRevision: number;
  readonly readyAt: string;
}): SocialContent {
  assertContentBinding(input.content, input.binding);
  if (revision(input.expectedRevision) !== input.content.revision) {
    throw new Error("social content revision is stale");
  }
  if (input.content.state !== "draft") {
    throw new Error("only draft social content can become ready");
  }
  const readyAt = toInstant(input.readyAt);
  if (readyAt < input.content.updatedAt) {
    throw new Error("social content time cannot move backwards");
  }
  return Object.freeze({
    ...input.content,
    state: "ready" as const,
    revision: input.content.revision + 1,
    updatedAt: readyAt,
  });
}

export function archiveSocialContent(input: {
  readonly content: SocialContent;
  readonly expectedRevision: number;
  readonly archivedAt: string;
}): SocialContent {
  if (revision(input.expectedRevision) !== input.content.revision) {
    throw new Error("social content revision is stale");
  }
  if (input.content.state === "archived") return input.content;
  const archivedAt = toInstant(input.archivedAt);
  if (archivedAt < input.content.updatedAt) {
    throw new Error("social content time cannot move backwards");
  }
  return Object.freeze({
    ...input.content,
    state: "archived" as const,
    revision: input.content.revision + 1,
    updatedAt: archivedAt,
    archivedAt,
  });
}
