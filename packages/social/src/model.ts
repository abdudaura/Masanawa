import {
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type CharacterVersionId,
  type ExternalReference,
  type Instant,
  type SocialContentId,
  type TenantId,
} from "@masanawa/contracts";

export type SocialAccountState = "active" | "suspended" | "revoked";

export interface SocialAccountBinding {
  readonly tenantId: TenantId;
  readonly accountKey: string;
  readonly characterId: CharacterId;
  readonly providerKey: string;
  readonly externalAccount: ExternalReference;
  readonly displayName: string;
  readonly handle: string | null;
  readonly state: SocialAccountState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface CreateSocialAccountBindingInput {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly providerKey: string;
  readonly externalAccount: ExternalReference;
  readonly displayName: string;
  readonly handle?: string | null;
  readonly createdAt: Instant;
}

export type SocialContentState =
  | "draft"
  | "approval-required"
  | "approved"
  | "publication-pending"
  | "published"
  | "failed"
  | "withdrawn";

export interface SocialMediaReference {
  readonly reference: ExternalReference;
  readonly altText: string | null;
}

export interface SocialContentRevision {
  readonly tenantId: TenantId;
  readonly socialContentId: SocialContentId;
  readonly revisionNumber: number;
  readonly body: string;
  readonly language: string | null;
  readonly media: readonly SocialMediaReference[];
  readonly targetAccountKeys: readonly string[];
  readonly createdAt: Instant;
}

export interface SocialContent {
  readonly tenantId: TenantId;
  readonly socialContentId: SocialContentId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly state: SocialContentState;
  readonly lifecycleRevision: number;
  readonly currentRevisionNumber: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface SocialContentSnapshot {
  readonly content: SocialContent;
  readonly currentRevision: SocialContentRevision;
}

export interface CreateSocialContentInput {
  readonly tenantId: TenantId;
  readonly socialContentId: SocialContentId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly body: string;
  readonly language?: string | null;
  readonly media?: readonly SocialMediaReference[];
  readonly targetAccountKeys: readonly string[];
  readonly createdAt: Instant;
}

export interface AppendSocialContentRevisionInput {
  readonly tenantId: TenantId;
  readonly socialContentId: SocialContentId;
  readonly expectedRevisionNumber: number;
  readonly body: string;
  readonly language?: string | null;
  readonly media?: readonly SocialMediaReference[];
  readonly targetAccountKeys: readonly string[];
  readonly createdAt: Instant;
}

const providerPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const accountKeyPattern = /^[a-z][a-z0-9._:%-]{2,511}$/u;

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function integer(value: number, name: string, min: number): number {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeSocialProviderKey(value: string): string {
  const normalized = bounded(value, "providerKey", 2, 80).toLowerCase();
  if (!providerPattern.test(normalized)) {
    throw new TypeError("providerKey is invalid");
  }
  return normalized;
}

function externalReference(
  input: ExternalReference,
  name: string,
): ExternalReference {
  const observedAt = toInstant(input.observedAt);
  const expiresAt =
    input.expiresAt === undefined ? undefined : toInstant(input.expiresAt);
  if (expiresAt !== undefined && expiresAt <= observedAt) {
    throw new Error(`${name} expiry must follow observation`);
  }
  const provenance =
    input.provenance === undefined
      ? undefined
      : Object.freeze(
          Object.fromEntries(
            Object.entries(input.provenance).map(([key, value]) => [
              bounded(key, `${name}.provenance key`, 1, 120),
              bounded(value, `${name}.provenance value`, 0, 500),
            ]),
          ),
        );
  return Object.freeze({
    system: bounded(input.system, `${name}.system`, 1, 120),
    namespace: bounded(input.namespace, `${name}.namespace`, 1, 160),
    value: bounded(input.value, `${name}.value`, 1, 2048),
    observedAt,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    ...(provenance === undefined ? {} : { provenance }),
  });
}

export function socialAccountKey(input: {
  readonly providerKey: string;
  readonly externalAccount: ExternalReference;
}): string {
  const providerKey = normalizeSocialProviderKey(input.providerKey);
  const ref = externalReference(input.externalAccount, "externalAccount");
  const key = `${providerKey}:${encodeURIComponent(ref.system)}:${encodeURIComponent(
    ref.namespace,
  )}:${encodeURIComponent(ref.value)}`.toLowerCase();
  if (!accountKeyPattern.test(key) || key.length > 512) {
    throw new TypeError("derived social account key is invalid");
  }
  return key;
}

export function createSocialAccountBinding(
  input: CreateSocialAccountBindingInput,
): SocialAccountBinding {
  const createdAt = toInstant(input.createdAt);
  const providerKey = normalizeSocialProviderKey(input.providerKey);
  const externalAccount = externalReference(
    input.externalAccount,
    "externalAccount",
  );
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    accountKey: socialAccountKey({ providerKey, externalAccount }),
    characterId: parseCanonicalId("character", input.characterId),
    providerKey,
    externalAccount,
    displayName: bounded(input.displayName, "displayName", 1, 160),
    handle:
      input.handle === undefined || input.handle === null
        ? null
        : bounded(input.handle, "handle", 1, 160),
    state: "active" as const,
    revision: 1,
    createdAt,
    updatedAt: createdAt,
  });
}

const accountTransitions: Readonly<
  Record<SocialAccountState, readonly SocialAccountState[]>
> = Object.freeze({
  active: ["suspended", "revoked"],
  suspended: ["active", "revoked"],
  revoked: [],
});

export function transitionSocialAccountBinding(input: {
  readonly current: SocialAccountBinding;
  readonly expectedRevision: number;
  readonly nextState: SocialAccountState;
  readonly updatedAt: Instant;
}): SocialAccountBinding {
  if (integer(input.expectedRevision, "expectedRevision", 1) !== input.current.revision) {
    throw new Error("social account binding revision is stale");
  }
  if (!accountTransitions[input.current.state].includes(input.nextState)) {
    throw new Error(
      `Invalid social account transition: ${input.current.state} -> ${input.nextState}`,
    );
  }
  const updatedAt = toInstant(input.updatedAt);
  if (updatedAt < input.current.updatedAt) {
    throw new Error("social account update cannot move time backwards");
  }
  return Object.freeze({
    ...input.current,
    state: input.nextState,
    revision: input.current.revision + 1,
    updatedAt,
  });
}

function contentBody(value: string): string {
  if (typeof value !== "string" || value.length > 100_000) {
    throw new RangeError("social content body is invalid");
  }
  return value;
}

function language(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = bounded(value, "language", 2, 35);
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(normalized)) {
    throw new TypeError("language is invalid");
  }
  return normalized;
}

function accountKey(value: string): string {
  const normalized = bounded(value, "targetAccountKey", 3, 512).toLowerCase();
  if (!accountKeyPattern.test(normalized)) {
    throw new TypeError("targetAccountKey is invalid");
  }
  return normalized;
}

function targetKeys(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 32) {
    throw new RangeError("targetAccountKeys must contain 1..32 entries");
  }
  const normalized = values.map(accountKey);
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError("targetAccountKeys must be unique");
  }
  return Object.freeze([...normalized].sort());
}

function mediaReferences(
  values: readonly SocialMediaReference[] | undefined,
): readonly SocialMediaReference[] {
  if (values === undefined) return Object.freeze([]);
  if (!Array.isArray(values) || values.length > 24) {
    throw new RangeError("social media reference count is invalid");
  }
  return Object.freeze(
    values.map((item, index) =>
      Object.freeze({
        reference: externalReference(item.reference, `media[${index}]`),
        altText:
          item.altText === null
            ? null
            : bounded(item.altText, `media[${index}].altText`, 1, 1000),
      }),
    ),
  );
}

function contentRevision(input: {
  readonly tenantId: TenantId;
  readonly socialContentId: SocialContentId;
  readonly revisionNumber: number;
  readonly body: string;
  readonly language?: string | null;
  readonly media?: readonly SocialMediaReference[];
  readonly targetAccountKeys: readonly string[];
  readonly createdAt: Instant;
}): SocialContentRevision {
  const body = contentBody(input.body);
  const media = mediaReferences(input.media);
  if (body.trim().length === 0 && media.length === 0) {
    throw new Error("social content requires text or media");
  }
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    socialContentId: parseCanonicalId("social-content", input.socialContentId),
    revisionNumber: integer(input.revisionNumber, "revisionNumber", 1),
    body,
    language: language(input.language),
    media,
    targetAccountKeys: targetKeys(input.targetAccountKeys),
    createdAt: toInstant(input.createdAt),
  });
}

export function createSocialContent(
  input: CreateSocialContentInput,
): SocialContentSnapshot {
  const createdAt = toInstant(input.createdAt);
  const currentRevision = contentRevision({
    ...input,
    revisionNumber: 1,
    createdAt,
  });
  const content: SocialContent = Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    socialContentId: parseCanonicalId("social-content", input.socialContentId),
    characterId: parseCanonicalId("character", input.characterId),
    characterVersionId: parseCanonicalId(
      "character-version",
      input.characterVersionId,
    ),
    state: "draft",
    lifecycleRevision: 1,
    currentRevisionNumber: 1,
    createdAt,
    updatedAt: createdAt,
  });
  return Object.freeze({ content, currentRevision });
}

export function appendSocialContentRevision(input: {
  readonly current: SocialContentSnapshot;
  readonly revision: AppendSocialContentRevisionInput;
}): SocialContentSnapshot {
  const current = input.current;
  const revision = input.revision;
  if (
    current.content.tenantId !== revision.tenantId ||
    current.content.socialContentId !== revision.socialContentId
  ) {
    throw new Error("social content revision scope mismatch");
  }
  if (current.content.state !== "draft") {
    throw new Error("only draft social content can be revised");
  }
  if (
    integer(revision.expectedRevisionNumber, "expectedRevisionNumber", 1) !==
    current.content.currentRevisionNumber
  ) {
    throw new Error("social content revision is stale");
  }
  const createdAt = toInstant(revision.createdAt);
  if (createdAt < current.content.updatedAt) {
    throw new Error("social content revision cannot move time backwards");
  }
  const nextRevision = contentRevision({
    tenantId: revision.tenantId,
    socialContentId: revision.socialContentId,
    revisionNumber: current.content.currentRevisionNumber + 1,
    body: revision.body,
    ...(revision.language === undefined ? {} : { language: revision.language }),
    ...(revision.media === undefined ? {} : { media: revision.media }),
    targetAccountKeys: revision.targetAccountKeys,
    createdAt,
  });
  return Object.freeze({
    content: Object.freeze({
      ...current.content,
      currentRevisionNumber: nextRevision.revisionNumber,
      updatedAt: createdAt,
    }),
    currentRevision: nextRevision,
  });
}

const contentTransitions: Readonly<
  Record<SocialContentState, readonly SocialContentState[]>
> = Object.freeze({
  draft: ["approval-required", "approved", "withdrawn"],
  "approval-required": ["approved", "withdrawn"],
  approved: ["publication-pending", "withdrawn"],
  "publication-pending": ["published", "failed"],
  published: ["withdrawn"],
  failed: ["publication-pending", "withdrawn"],
  withdrawn: [],
});

export function transitionSocialContentState(input: {
  readonly current: SocialContent;
  readonly expectedLifecycleRevision: number;
  readonly nextState: SocialContentState;
  readonly updatedAt: Instant;
}): SocialContent {
  if (
    integer(
      input.expectedLifecycleRevision,
      "expectedLifecycleRevision",
      1,
    ) !== input.current.lifecycleRevision
  ) {
    throw new Error("social content lifecycle revision is stale");
  }
  if (!contentTransitions[input.current.state].includes(input.nextState)) {
    throw new Error(
      `Invalid social content transition: ${input.current.state} -> ${input.nextState}`,
    );
  }
  const updatedAt = toInstant(input.updatedAt);
  if (updatedAt < input.current.updatedAt) {
    throw new Error("social content transition cannot move time backwards");
  }
  return Object.freeze({
    ...input.current,
    state: input.nextState,
    lifecycleRevision: input.current.lifecycleRevision + 1,
    updatedAt,
  });
}
