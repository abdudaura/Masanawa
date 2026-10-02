import {
  isCanonicalId,
  type CredentialRefId,
  type OperationId,
  type ProviderId,
  type TenantId,
} from "@masanawa/contracts";

export interface CredentialResolutionRequest {
  readonly tenantId: TenantId;
  readonly credentialRefId: CredentialRefId;
  readonly providerId: ProviderId;
  readonly operationId: OperationId;
  readonly slotKey: string;
}

export interface CredentialMaterialSource {
  resolve(
    request: CredentialResolutionRequest,
  ): Promise<CredentialSecret | null>;
}

function boundedSlotKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > 128 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)
  ) {
    throw new TypeError("credential slotKey is invalid");
  }
  return normalized;
}

export function normalizeCredentialResolutionRequest(
  input: CredentialResolutionRequest,
): CredentialResolutionRequest {
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("credential tenantId is invalid");
  }
  if (!isCanonicalId("credential-ref", input.credentialRefId)) {
    throw new TypeError("credentialRefId is invalid");
  }
  if (!isCanonicalId("provider", input.providerId)) {
    throw new TypeError("credential providerId is invalid");
  }
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("credential operationId is invalid");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    credentialRefId: input.credentialRefId,
    providerId: input.providerId,
    operationId: input.operationId,
    slotKey: boundedSlotKey(input.slotKey),
  });
}

export class CredentialSecret {
  #value: string;

  private constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  static fromString(value: string): CredentialSecret {
    if (typeof value !== "string" || value.length < 1) {
      throw new TypeError("credential secret material is empty");
    }
    return new CredentialSecret(value);
  }

  use<T>(callback: (value: string) => T): T {
    return callback(this.#value);
  }

  toJSON(): string {
    return "[REDACTED]";
  }

  toString(): string {
    return "[REDACTED]";
  }
}

export async function resolveCredentialSecret(
  source: CredentialMaterialSource,
  input: CredentialResolutionRequest,
): Promise<CredentialSecret> {
  const request = normalizeCredentialResolutionRequest(input);
  const secret = await source.resolve(request);
  if (secret === null) {
    throw new Error("credential reference is unavailable for requested scope");
  }
  return secret;
}
