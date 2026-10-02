import {
  PlatformError,
  isCanonicalId,
  toInstant,
  type AuthorityContextId,
  type CorrelationId,
  type CredentialRefId,
  type Instant,
  type OperationId,
  type ProviderId,
  type TenantId,
} from "@masanawa/contracts";

export const credentialRefStates = ["active", "revoked"] as const;
export type CredentialRefState = (typeof credentialRefStates)[number];

export interface CredentialRefRecord {
  readonly credentialRefId: CredentialRefId;
  readonly tenantId: TenantId;
  readonly providerId: ProviderId;
  readonly slotKey: string;
  readonly purpose: string;
  readonly destinationKey: string;
  readonly vaultLocator: string;
  readonly generation: number;
  readonly state: CredentialRefState;
  readonly createdAt: Instant;
  readonly revokedAt: Instant | null;
}

export interface CredentialRefMetadataSource {
  load(
    tenantId: TenantId,
    credentialRefId: CredentialRefId,
  ): Promise<CredentialRefRecord | null>;
}

export interface CredentialRefRepository
  extends CredentialRefMetadataSource {
  create(record: CredentialRefRecord): Promise<{
    readonly record: CredentialRefRecord;
    readonly reused: boolean;
  }>;
  revoke(
    tenantId: TenantId,
    credentialRefId: CredentialRefId,
    revokedAt: Instant,
  ): Promise<CredentialRefRecord>;
}

export interface CredentialSecretLease {
  withSecret<T>(
    use: (secret: string) => T | Promise<T>,
  ): Promise<T>;
  close(): void | Promise<void>;
}

export interface CredentialSecretVault {
  open(input: {
    readonly vaultLocator: string;
    readonly generation: number;
  }): Promise<CredentialSecretLease | null>;
}

export const credentialAccessOutcomes = [
  "granted",
  "denied",
  "unavailable",
] as const;
export type CredentialAccessOutcome =
  (typeof credentialAccessOutcomes)[number];

export interface CredentialAccessAuditRecord {
  readonly tenantId: TenantId;
  readonly credentialRefId: CredentialRefId;
  readonly providerId: ProviderId;
  readonly slotKey: string;
  readonly purpose: string;
  readonly destinationKey: string;
  readonly operationId: OperationId;
  readonly authorityContextId: AuthorityContextId;
  readonly correlationId: CorrelationId;
  readonly principalKey: string;
  readonly outcome: CredentialAccessOutcome;
  readonly reasonCode: string;
}

export interface CredentialAccessAuditSink {
  record(entry: CredentialAccessAuditRecord): Promise<void>;
}

export interface CredentialAccessRequest {
  readonly tenantId: TenantId;
  readonly credentialRefId: CredentialRefId;
  readonly providerId: ProviderId;
  readonly slotKey: string;
  readonly purpose: string;
  readonly destinationKey: string;
  readonly operationId: OperationId;
  readonly authorityContextId: AuthorityContextId;
  readonly correlationId: CorrelationId;
  readonly principalKey: string;
}

export interface CredentialAccessDependencies {
  readonly refs: CredentialRefMetadataSource;
  readonly vault: CredentialSecretVault;
  readonly audit: CredentialAccessAuditSink;
}

const tokenPattern = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;

function normalizedToken(
  value: string,
  name: string,
  maxLength = 200,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > maxLength ||
    !tokenPattern.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function normalizedLocator(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("credential vaultLocator must be a string");
  }
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 1000 ||
    /[\r\n\0\s?#]/u.test(normalized)
  ) {
    throw new TypeError("credential vaultLocator is invalid");
  }
  return normalized;
}

export function normalizeCredentialRefRecord(
  input: CredentialRefRecord,
): CredentialRefRecord {
  if (!isCanonicalId("credential-ref", input.credentialRefId)) {
    throw new TypeError("credentialRefId is invalid");
  }
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("credential tenantId is invalid");
  }
  if (!isCanonicalId("provider", input.providerId)) {
    throw new TypeError("credential providerId is invalid");
  }
  if (
    !Number.isSafeInteger(input.generation) ||
    input.generation < 1
  ) {
    throw new RangeError("credential generation must be positive");
  }
  if (
    input.state !== "active" &&
    input.state !== "revoked"
  ) {
    throw new TypeError("credential state is invalid");
  }
  if (
    input.state === "active" &&
    input.revokedAt !== null
  ) {
    throw new TypeError("active credential cannot have revokedAt");
  }
  if (
    input.state === "revoked" &&
    input.revokedAt === null
  ) {
    throw new TypeError("revoked credential requires revokedAt");
  }

  const createdAt = toInstant(input.createdAt);
  const revokedAt =
    input.revokedAt === null ? null : toInstant(input.revokedAt);
  if (revokedAt !== null && revokedAt < createdAt) {
    throw new TypeError("credential revokedAt cannot precede createdAt");
  }

  return Object.freeze({
    credentialRefId: input.credentialRefId,
    tenantId: input.tenantId,
    providerId: input.providerId,
    slotKey: normalizedToken(input.slotKey, "credential slotKey", 128),
    purpose: normalizedToken(input.purpose, "credential purpose"),
    destinationKey: normalizedToken(
      input.destinationKey,
      "credential destinationKey",
    ),
    vaultLocator: normalizedLocator(input.vaultLocator),
    generation: input.generation,
    state: input.state,
    createdAt,
    revokedAt,
  });
}

function credentialError(
  code: string,
  category:
    | "authorization"
    | "not-found"
    | "unavailable",
  message: string,
  operationId: OperationId,
): PlatformError {
  return new PlatformError({
    code,
    category,
    message,
    retryable: false,
    operationId,
  });
}

function normalizeRequest(
  input: CredentialAccessRequest,
): CredentialAccessRequest {
  if (!isCanonicalId("credential-ref", input.credentialRefId)) {
    throw new TypeError("credential access credentialRefId is invalid");
  }
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("credential access tenantId is invalid");
  }
  if (!isCanonicalId("provider", input.providerId)) {
    throw new TypeError("credential access providerId is invalid");
  }
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("credential access operationId is invalid");
  }
  if (!isCanonicalId("authority-context", input.authorityContextId)) {
    throw new TypeError(
      "credential access authorityContextId is invalid",
    );
  }
  if (!isCanonicalId("correlation", input.correlationId)) {
    throw new TypeError("credential access correlationId is invalid");
  }

  return Object.freeze({
    ...input,
    slotKey: normalizedToken(input.slotKey, "credential access slotKey", 128),
    purpose: normalizedToken(input.purpose, "credential access purpose"),
    destinationKey: normalizedToken(
      input.destinationKey,
      "credential access destinationKey",
    ),
    principalKey: normalizedToken(
      input.principalKey,
      "credential access principalKey",
      300,
    ),
  });
}

async function audit(
  sink: CredentialAccessAuditSink,
  request: CredentialAccessRequest,
  outcome: CredentialAccessOutcome,
  reasonCode: string,
): Promise<void> {
  await sink.record(
    Object.freeze({
      ...request,
      outcome,
      reasonCode: normalizedToken(
        reasonCode,
        "credential access reasonCode",
      ),
    }),
  );
}

export async function withCredentialSecret<T>(
  dependencies: CredentialAccessDependencies,
  requestInput: CredentialAccessRequest,
  use: (secret: string) => T | Promise<T>,
): Promise<T> {
  const request = normalizeRequest(requestInput);
  const metadata = await dependencies.refs.load(
    request.tenantId,
    request.credentialRefId,
  );

  if (metadata === null) {
    await audit(
      dependencies.audit,
      request,
      "denied",
      "credential-ref-not-found",
    );
    throw credentialError(
      "credential-ref.not_found",
      "not-found",
      "Credential reference is unavailable",
      request.operationId,
    );
  }

  const ref = normalizeCredentialRefRecord(metadata);
  const mismatch =
    ref.tenantId !== request.tenantId ||
    ref.providerId !== request.providerId ||
    ref.slotKey !== request.slotKey ||
    ref.purpose !== request.purpose ||
    ref.destinationKey !== request.destinationKey;

  if (mismatch) {
    await audit(
      dependencies.audit,
      request,
      "denied",
      "credential-scope-mismatch",
    );
    throw credentialError(
      "credential-ref.scope_mismatch",
      "authorization",
      "Credential reference is not authorized for this destination",
      request.operationId,
    );
  }

  if (ref.state !== "active") {
    await audit(
      dependencies.audit,
      request,
      "denied",
      "credential-revoked",
    );
    throw credentialError(
      "credential-ref.revoked",
      "authorization",
      "Credential reference is revoked",
      request.operationId,
    );
  }

  let lease: CredentialSecretLease | null = null;
  try {
    lease = await dependencies.vault.open({
      vaultLocator: ref.vaultLocator,
      generation: ref.generation,
    });
  } catch {
    await audit(
      dependencies.audit,
      request,
      "unavailable",
      "credential-vault-unavailable",
    );
    throw credentialError(
      "credential-ref.vault_unavailable",
      "unavailable",
      "Credential vault is unavailable",
      request.operationId,
    );
  }

  if (lease === null) {
    await audit(
      dependencies.audit,
      request,
      "unavailable",
      "credential-secret-unresolved",
    );
    throw credentialError(
      "credential-ref.secret_unresolved",
      "unavailable",
      "Credential secret could not be resolved",
      request.operationId,
    );
  }

  try {
    // Audit must be durable before secret material crosses the adapter edge.
    await audit(
      dependencies.audit,
      request,
      "granted",
      "credential-access-granted",
    );
    return await lease.withSecret(use);
  } finally {
    await lease.close();
  }
}
