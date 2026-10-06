import {
  toInstant,
  type ChannelAccountId,
  type Instant,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export const launchChannelKinds = ["whatsapp", "telegram"] as const;
export type LaunchChannelKind = (typeof launchChannelKinds)[number];

export const channelAccountStates = ["active", "disabled", "revoked"] as const;
export type ChannelAccountState = (typeof channelAccountStates)[number];

export const channelBindingStates = [
  "pending-proof",
  "active",
  "revoked",
] as const;
export type ChannelBindingState = (typeof channelBindingStates)[number];

export const channelBindingProofMethods = [
  "channel-possession-challenge",
  "authenticated-cross-channel-confirmation",
] as const;
export type ChannelBindingProofMethod =
  (typeof channelBindingProofMethods)[number];

export interface ChannelAccount {
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly providerAccountRef: string;
  readonly state: ChannelAccountState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface ChannelBindingProof {
  readonly purpose: "account-link";
  readonly method: ChannelBindingProofMethod;
  readonly evidenceRef: string;
  readonly verifiedAt: Instant;
}

export interface UserChannelBinding {
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly userId: UserId;
  readonly externalSubjectId: string;
  readonly state: ChannelBindingState;
  readonly proof: ChannelBindingProof | null;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface CreateChannelAccountInput {
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly providerAccountRef: string;
  readonly createdAt: Instant;
}

export interface CreatePendingChannelBindingInput {
  readonly account: ChannelAccount;
  readonly userId: UserId;
  readonly externalSubjectId: string;
  readonly createdAt: Instant;
}

export interface ActivateChannelBindingInput {
  readonly account: ChannelAccount;
  readonly binding: UserChannelBinding;
  readonly expectedRevision: number;
  readonly proof: ChannelBindingProof;
  readonly activatedAt: Instant;
}

export interface ChannelBindingRepository {
  createAccount(input: CreateChannelAccountInput): Promise<ChannelAccount>;
  readAccount(input: {
    readonly tenantId: TenantId;
    readonly channelAccountId: ChannelAccountId;
  }): Promise<ChannelAccount | null>;
  createPendingBinding(
    input: CreatePendingChannelBindingInput,
  ): Promise<UserChannelBinding>;
  readBindingBySubject(input: {
    readonly tenantId: TenantId;
    readonly channelAccountId: ChannelAccountId;
    readonly externalSubjectId: string;
  }): Promise<UserChannelBinding | null>;
  readActiveBindingForUser(input: {
    readonly tenantId: TenantId;
    readonly channelAccountId: ChannelAccountId;
    readonly userId: UserId;
  }): Promise<UserChannelBinding | null>;
  putAccount(input: ChannelAccount): Promise<ChannelAccount>;
  putBinding(input: UserChannelBinding): Promise<UserChannelBinding>;
}

const channelSet = new Set<string>(launchChannelKinds);
const accountStateSet = new Set<string>(channelAccountStates);
const bindingProofMethodSet = new Set<string>(channelBindingProofMethods);

function boundedText(
  value: string,
  name: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
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

function channel(value: LaunchChannelKind): LaunchChannelKind {
  if (!channelSet.has(value)) throw new TypeError("channel is invalid");
  return value;
}

export function normalizeChannelBindingProof(
  input: ChannelBindingProof,
): ChannelBindingProof {
  if (input.purpose !== "account-link") {
    throw new TypeError("channel binding proof purpose is invalid");
  }
  if (!bindingProofMethodSet.has(input.method)) {
    throw new TypeError("channel binding proof method is invalid");
  }
  return Object.freeze({
    purpose: "account-link",
    method: input.method,
    evidenceRef: boundedText(input.evidenceRef, "evidenceRef", 8, 512),
    verifiedAt: toInstant(input.verifiedAt),
  });
}

export function createChannelAccount(
  input: CreateChannelAccountInput,
): ChannelAccount {
  return Object.freeze({
    tenantId: input.tenantId,
    channelAccountId: input.channelAccountId,
    channel: channel(input.channel),
    providerAccountRef: boundedText(
      input.providerAccountRef,
      "providerAccountRef",
      1,
      256,
    ),
    state: "active",
    revision: 1,
    createdAt: toInstant(input.createdAt),
    updatedAt: toInstant(input.createdAt),
  });
}

export function transitionChannelAccount(input: {
  readonly account: ChannelAccount;
  readonly expectedRevision: number;
  readonly state: ChannelAccountState;
  readonly changedAt: Instant;
}): ChannelAccount {
  if (revision(input.expectedRevision) !== input.account.revision) {
    throw new Error("Channel account revision is stale");
  }
  if (!accountStateSet.has(input.state)) {
    throw new TypeError("channel account state is invalid");
  }
  if (input.account.state === "revoked") {
    throw new Error("Revoked channel account is terminal");
  }
  if (input.state === input.account.state) {
    return input.account;
  }
  const allowed =
    (input.account.state === "active" &&
      (input.state === "disabled" || input.state === "revoked")) ||
    (input.account.state === "disabled" &&
      (input.state === "active" || input.state === "revoked"));
  if (!allowed) throw new Error("Invalid channel account lifecycle transition");

  return Object.freeze({
    ...input.account,
    state: input.state,
    revision: input.account.revision + 1,
    updatedAt: toInstant(input.changedAt),
  });
}

export function channelSubjectKey(input: {
  readonly channelAccountId: ChannelAccountId;
  readonly externalSubjectId: string;
}): string {
  return [
    input.channelAccountId,
    encodeURIComponent(
      boundedText(input.externalSubjectId, "externalSubjectId", 1, 512),
    ),
  ].join(":");
}

export function createPendingChannelBinding(
  input: CreatePendingChannelBindingInput,
): UserChannelBinding {
  if (input.account.state !== "active") {
    throw new Error("Channel account is not active");
  }
  const at = toInstant(input.createdAt);
  return Object.freeze({
    tenantId: input.account.tenantId,
    channelAccountId: input.account.channelAccountId,
    channel: input.account.channel,
    userId: input.userId,
    externalSubjectId: boundedText(
      input.externalSubjectId,
      "externalSubjectId",
      1,
      512,
    ),
    state: "pending-proof",
    proof: null,
    revision: 1,
    createdAt: at,
    updatedAt: at,
  });
}

function assertBindingMatchesAccount(
  binding: UserChannelBinding,
  account: ChannelAccount,
): void {
  if (
    binding.tenantId !== account.tenantId ||
    binding.channelAccountId !== account.channelAccountId ||
    binding.channel !== account.channel
  ) {
    throw new Error("Channel binding does not belong to the supplied account");
  }
}

export function activateChannelBinding(
  input: ActivateChannelBindingInput,
): UserChannelBinding {
  assertBindingMatchesAccount(input.binding, input.account);
  if (input.account.state !== "active") {
    throw new Error("Channel account is not active");
  }
  if (revision(input.expectedRevision) !== input.binding.revision) {
    throw new Error("Channel binding revision is stale");
  }
  if (input.binding.state !== "pending-proof") {
    throw new Error("Only a pending channel binding can be activated");
  }
  const proof = normalizeChannelBindingProof(input.proof);
  const activatedAt = toInstant(input.activatedAt);
  if (Date.parse(proof.verifiedAt) > Date.parse(activatedAt)) {
    throw new Error("Channel binding proof cannot be verified in the future");
  }

  return Object.freeze({
    ...input.binding,
    state: "active",
    proof,
    revision: input.binding.revision + 1,
    updatedAt: activatedAt,
  });
}

export function revokeChannelBinding(input: {
  readonly binding: UserChannelBinding;
  readonly expectedRevision: number;
  readonly revokedAt: Instant;
}): UserChannelBinding {
  if (revision(input.expectedRevision) !== input.binding.revision) {
    throw new Error("Channel binding revision is stale");
  }
  if (input.binding.state === "revoked") return input.binding;

  return Object.freeze({
    ...input.binding,
    state: "revoked",
    revision: input.binding.revision + 1,
    updatedAt: toInstant(input.revokedAt),
  });
}

export function assertChannelBindingUsable(input: {
  readonly account: ChannelAccount;
  readonly binding: UserChannelBinding;
  readonly tenantId: TenantId;
  readonly externalSubjectId: string;
}): void {
  assertBindingMatchesAccount(input.binding, input.account);
  if (input.account.tenantId !== input.tenantId) {
    throw new Error("Channel account belongs to a different tenant");
  }
  if (input.account.state !== "active") {
    throw new Error("Channel account is not active");
  }
  if (input.binding.state !== "active" || input.binding.proof === null) {
    throw new Error("Channel binding is not active and proof-backed");
  }
  if (
    input.binding.externalSubjectId !==
    boundedText(input.externalSubjectId, "externalSubjectId", 1, 512)
  ) {
    throw new Error("Channel subject does not match the active binding");
  }
}
