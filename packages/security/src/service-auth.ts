import {
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import {
  PlatformError,
  isCanonicalId,
  toInstant,
  type CorrelationId,
  type Instant,
  type RequestId,
  type ServiceId,
  type TenantId,
} from "@masanawa/contracts";
import { canonicalJson } from "./canonical-json.js";
import type { Principal } from "./principal.js";

const TOKEN_PREFIX = "msw1";
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/u;
const DEFAULT_MAX_LIFETIME_MS = 5 * 60 * 1000;
const DEFAULT_CLOCK_SKEW_MS = 30_000;
const MAX_TOKEN_LENGTH = 16_384;

export interface ServiceCredentialClaims {
  readonly version: 1;
  readonly issuer: ServiceId;
  readonly audience: ServiceId;
  readonly capabilities: readonly string[];
  readonly credentialGeneration: number;
  readonly issuedAt: Instant;
  readonly expiresAt: Instant;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly tenantId?: TenantId;
}

export interface IssueServiceCredentialInput
  extends Omit<ServiceCredentialClaims, "version"> {
  readonly keyId: string;
  readonly privateKey: KeyObject | string | Buffer;
  readonly maxLifetimeMs?: number;
}

export interface ServiceCredentialVerificationKey {
  readonly publicKey: KeyObject | string | Buffer;
  readonly credentialGeneration: number;
  readonly active: boolean;
}

export interface ServiceCredentialKeySource {
  resolve(
    issuer: ServiceId,
    keyId: string,
  ):
    | ServiceCredentialVerificationKey
    | null
    | Promise<ServiceCredentialVerificationKey | null>;
}

export interface VerifyServiceCredentialInput {
  readonly expectedAudience: ServiceId;
  readonly requiredCapabilities?: readonly string[];
  readonly expectedTenantId?: TenantId;
  readonly keySource: ServiceCredentialKeySource;
  readonly at?: Instant;
  readonly maxLifetimeMs?: number;
  readonly clockSkewMs?: number;
}

export interface VerifiedServiceCredential {
  readonly principal: Extract<Principal, { readonly kind: "service" }>;
  readonly claims: ServiceCredentialClaims;
  readonly keyId: string;
}

interface TokenHeader {
  readonly alg: "EdDSA";
  readonly typ: "MSW";
  readonly kid: string;
}

function authenticationError(
  code: string,
  message: string,
): PlatformError {
  return new PlatformError({
    code,
    category: "authentication",
    message,
    retryable: false,
  });
}

function authorizationError(
  code: string,
  message: string,
): PlatformError {
  return new PlatformError({
    code,
    category: "authorization",
    message,
    retryable: false,
  });
}

function encode(value: string | Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decode(segment: string): Buffer {
  if (!segment || !SEGMENT_PATTERN.test(segment)) {
    throw authenticationError(
      "service-credential.malformed",
      "Service credential is malformed",
    );
  }
  return Buffer.from(segment, "base64url");
}

function parseJsonObject(
  segment: string,
  code: string,
): Readonly<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(decode(segment).toString("utf8")) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new TypeError("expected object");
    }
    return parsed as Readonly<Record<string, unknown>>;
  } catch (error) {
    if (error instanceof PlatformError) {
      throw error;
    }
    throw authenticationError(code, "Service credential is malformed");
  }
}

function requireCanonicalId<K extends "service" | "tenant" | "request" | "correlation">(
  kind: K,
  value: unknown,
): string {
  if (!isCanonicalId(kind, value)) {
    throw authenticationError(
      "service-credential.invalid_claims",
      "Service credential has invalid claims",
    );
  }
  return value;
}

function requireInstant(value: unknown): Instant {
  if (typeof value !== "string") {
    throw authenticationError(
      "service-credential.invalid_claims",
      "Service credential has invalid claims",
    );
  }
  try {
    return toInstant(value);
  } catch {
    throw authenticationError(
      "service-credential.invalid_claims",
      "Service credential has invalid claims",
    );
  }
}

function normalizeCapabilities(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw authenticationError(
      "service-credential.invalid_claims",
      "Service credential has invalid claims",
    );
  }
  const capabilities = value.map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw authenticationError(
        "service-credential.invalid_claims",
        "Service credential has invalid claims",
      );
    }
    return item.trim();
  });
  return Object.freeze([...new Set(capabilities)].sort());
}

function normalizeGeneration(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw authenticationError(
      "service-credential.invalid_claims",
      "Service credential has invalid claims",
    );
  }
  return value as number;
}

function parseHeader(segment: string): TokenHeader {
  const header = parseJsonObject(
    segment,
    "service-credential.invalid_header",
  );
  if (
    header.alg !== "EdDSA" ||
    header.typ !== "MSW" ||
    typeof header.kid !== "string" ||
    !header.kid.trim() ||
    header.kid.length > 128
  ) {
    throw authenticationError(
      "service-credential.invalid_header",
      "Service credential has invalid header",
    );
  }
  return Object.freeze({
    alg: "EdDSA",
    typ: "MSW",
    kid: header.kid,
  });
}

function parseClaims(segment: string): ServiceCredentialClaims {
  const claims = parseJsonObject(
    segment,
    "service-credential.invalid_claims",
  );
  if (claims.version !== 1) {
    throw authenticationError(
      "service-credential.invalid_claims",
      "Service credential has invalid claims",
    );
  }

  const tenantId =
    claims.tenantId === undefined
      ? undefined
      : (requireCanonicalId("tenant", claims.tenantId) as TenantId);

  return Object.freeze({
    version: 1 as const,
    issuer: requireCanonicalId("service", claims.issuer) as ServiceId,
    audience: requireCanonicalId("service", claims.audience) as ServiceId,
    capabilities: normalizeCapabilities(claims.capabilities),
    credentialGeneration: normalizeGeneration(claims.credentialGeneration),
    issuedAt: requireInstant(claims.issuedAt),
    expiresAt: requireInstant(claims.expiresAt),
    requestId: requireCanonicalId("request", claims.requestId) as RequestId,
    correlationId: requireCanonicalId(
      "correlation",
      claims.correlationId,
    ) as CorrelationId,
    ...(tenantId ? { tenantId } : {}),
  });
}

function instantMs(value: Instant): number {
  return new Date(value).getTime();
}

function assertLifetime(
  claims: ServiceCredentialClaims,
  maxLifetimeMs: number,
): void {
  const issuedAt = instantMs(claims.issuedAt);
  const expiresAt = instantMs(claims.expiresAt);
  if (
    !Number.isSafeInteger(maxLifetimeMs) ||
    maxLifetimeMs <= 0 ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > maxLifetimeMs
  ) {
    throw authenticationError(
      "service-credential.invalid_lifetime",
      "Service credential lifetime is invalid",
    );
  }
}

export function issueServiceCredential(
  input: IssueServiceCredentialInput,
): string {
  const keyId = input.keyId.trim();
  if (!keyId || keyId.length > 128) {
    throw new TypeError("keyId is required and must be at most 128 characters");
  }

  const claims: ServiceCredentialClaims = Object.freeze({
    version: 1,
    issuer: input.issuer,
    audience: input.audience,
    capabilities: Object.freeze(
      [...new Set(input.capabilities.map((item) => item.trim()))]
        .filter(Boolean)
        .sort(),
    ),
    credentialGeneration: input.credentialGeneration,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    requestId: input.requestId,
    correlationId: input.correlationId,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  });

  if (claims.capabilities.length === 0) {
    throw new TypeError("At least one service capability is required");
  }
  if (!Number.isInteger(claims.credentialGeneration) || claims.credentialGeneration < 1) {
    throw new RangeError("credentialGeneration must be a positive integer");
  }

  assertLifetime(
    claims,
    input.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS,
  );

  const header: TokenHeader = Object.freeze({
    alg: "EdDSA",
    typ: "MSW",
    kid: keyId,
  });
  const headerSegment = encode(canonicalJson(header));
  const claimsSegment = encode(canonicalJson(claims));
  const signingInput = `${TOKEN_PREFIX}.${headerSegment}.${claimsSegment}`;
  const signature = sign(
    null,
    Buffer.from(signingInput, "utf8"),
    input.privateKey,
  );

  return `${signingInput}.${encode(signature)}`;
}

export async function verifyServiceCredential(
  token: string,
  input: VerifyServiceCredentialInput,
): Promise<VerifiedServiceCredential> {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    throw authenticationError(
      "service-credential.malformed",
      "Service credential is malformed",
    );
  }

  const segments = token.split(".");
  if (segments.length !== 4 || segments[0] !== TOKEN_PREFIX) {
    throw authenticationError(
      "service-credential.malformed",
      "Service credential is malformed",
    );
  }

  const [, headerSegment, claimsSegment, signatureSegment] = segments;
  if (!headerSegment || !claimsSegment || !signatureSegment) {
    throw authenticationError(
      "service-credential.malformed",
      "Service credential is malformed",
    );
  }

  const header = parseHeader(headerSegment);
  const claims = parseClaims(claimsSegment);
  const key = await input.keySource.resolve(claims.issuer, header.kid);
  if (!key || !key.active) {
    throw authenticationError(
      "service-credential.unknown_key",
      "Service credential key is unavailable",
    );
  }

  const signingInput = `${TOKEN_PREFIX}.${headerSegment}.${claimsSegment}`;
  const signature = decode(signatureSegment);
  const validSignature = verify(
    null,
    Buffer.from(signingInput, "utf8"),
    key.publicKey,
    signature,
  );
  if (!validSignature) {
    throw authenticationError(
      "service-credential.invalid_signature",
      "Service credential signature is invalid",
    );
  }

  if (key.credentialGeneration !== claims.credentialGeneration) {
    throw authenticationError(
      "service-credential.stale_generation",
      "Service credential has been rotated or revoked",
    );
  }

  const maxLifetimeMs =
    input.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS;
  assertLifetime(claims, maxLifetimeMs);

  const now = instantMs(input.at ?? toInstant(new Date()));
  const skewMs = input.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  if (!Number.isSafeInteger(skewMs) || skewMs < 0 || skewMs > 300_000) {
    throw new RangeError("clockSkewMs must be between 0 and 300000");
  }
  if (instantMs(claims.issuedAt) > now + skewMs) {
    throw authenticationError(
      "service-credential.not_yet_valid",
      "Service credential is not yet valid",
    );
  }
  if (instantMs(claims.expiresAt) <= now - skewMs) {
    throw authenticationError(
      "service-credential.expired",
      "Service credential has expired",
    );
  }

  if (claims.audience !== input.expectedAudience) {
    throw authorizationError(
      "service-credential.wrong_audience",
      "Service credential is not valid for this service",
    );
  }

  if (
    input.expectedTenantId !== undefined &&
    claims.tenantId !== input.expectedTenantId
  ) {
    throw authorizationError(
      "service-credential.wrong_tenant",
      "Service credential is not valid for this tenant",
    );
  }

  const granted = new Set(claims.capabilities);
  const missing = (input.requiredCapabilities ?? []).filter(
    (capability) => !granted.has(capability),
  );
  if (missing.length > 0) {
    throw authorizationError(
      "service-credential.insufficient_capability",
      "Service credential lacks a required capability",
    );
  }

  return Object.freeze({
    principal: Object.freeze({
      kind: "service" as const,
      serviceId: claims.issuer,
    }),
    claims,
    keyId: header.kid,
  });
}
