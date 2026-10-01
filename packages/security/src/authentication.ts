import {
  PlatformError,
  nowInstant,
  type ExternalSubjectRef,
  type Instant,
} from "@masanawa/contracts";

export const authenticationMethods = [
  "platform-session",
  "oauth",
  "channel-transport",
  "operator-session",
  "device-key",
  "service-credential",
] as const;

export type AuthenticationMethod = (typeof authenticationMethods)[number];

export type AuthenticationStrength =
  | "unverified"
  | "transport-verified"
  | "linked"
  | "strong";

export interface AuthenticationEvidence {
  readonly method: AuthenticationMethod;
  readonly issuer: string;
  readonly subject: string;
  readonly strength: AuthenticationStrength;
  readonly authenticatedAt: Instant;
  readonly expiresAt?: Instant;
  readonly externalSubject?: ExternalSubjectRef;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface CreateAuthenticationEvidenceInput
  extends Omit<AuthenticationEvidence, "issuer" | "subject" | "metadata"> {
  readonly issuer: string;
  readonly subject: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

function requireBoundedText(
  value: string,
  field: string,
  maxLength = 512,
): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${field} is required`);
  }
  if (
    normalized.length > maxLength ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return normalized;
}

export function createAuthenticationEvidence(
  input: CreateAuthenticationEvidenceInput,
): AuthenticationEvidence {
  if (input.expiresAt && input.expiresAt <= input.authenticatedAt) {
    throw new RangeError("Authentication evidence expiry must be after authentication time");
  }

  const metadata = input.metadata
    ? Object.freeze(
        Object.fromEntries(
          Object.entries(input.metadata).map(([key, value]) => [
            requireBoundedText(key, "metadata key", 128),
            requireBoundedText(value, "metadata value", 1024),
          ]),
        ),
      )
    : undefined;

  return Object.freeze({
    method: input.method,
    issuer: requireBoundedText(input.issuer, "issuer"),
    subject: requireBoundedText(input.subject, "subject"),
    strength: input.strength,
    authenticatedAt: input.authenticatedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    ...(input.externalSubject
      ? { externalSubject: Object.freeze({ ...input.externalSubject }) }
      : {}),
    ...(metadata ? { metadata } : {}),
  });
}

export function assertAuthenticationEvidenceCurrent(
  evidence: AuthenticationEvidence,
  at: Instant = nowInstant(),
): void {
  if (evidence.strength === "unverified") {
    throw new PlatformError({
      code: "authentication.unverified",
      category: "authentication",
      message: "Authentication evidence is not verified",
      retryable: false,
    });
  }
  if (evidence.expiresAt && evidence.expiresAt <= at) {
    throw new PlatformError({
      code: "authentication.expired",
      category: "authentication",
      message: "Authentication evidence has expired",
      retryable: false,
    });
  }
}

export function authenticationEvidenceCanResolveIdentity(
  evidence: AuthenticationEvidence,
): boolean {
  return evidence.strength === "linked" || evidence.strength === "strong";
}
