import {
  parseCanonicalId,
  type TenantId,
} from "@masanawa/contracts";

export type PublicProjectionLeakKind =
  | "forbidden-field"
  | "secret-value"
  | "credential-url"
  | "invalid-structure"
  | "traversal-limit";

export interface PublicProjectionLeak {
  readonly path: string;
  readonly kind: PublicProjectionLeakKind;
  readonly reason: string;
}

export interface PublicProjectionAuditOptions {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

const forbiddenFieldNames = new Set([
  "password",
  "passwd",
  "apikey",
  "accesskey",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "bearertoken",
  "authorization",
  "cookie",
  "setcookie",
  "privatekey",
  "privatekeypem",
  "clientsecret",
  "credentialciphertext",
  "credentialplaintext",
  "rawcredential",
  "signingsecret",
  "webhooksecret",
  "ipnsecret",
]);

const safeCredentialMetadataSuffixes = [
  "id",
  "ref",
  "reference",
  "fingerprint",
  "hash",
  "last4",
  "status",
  "kind",
  "provider",
  "version",
  "rotatedat",
  "expiresat",
];

function normalizedFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function isForbiddenField(value: string): boolean {
  const normalized = normalizedFieldName(value);
  if (forbiddenFieldNames.has(normalized)) return true;

  if (
    normalized.includes("credential") ||
    normalized.includes("secret") ||
    normalized.includes("token")
  ) {
    if (
      safeCredentialMetadataSuffixes.some((suffix) =>
        normalized.endsWith(suffix),
      )
    ) {
      return false;
    }
    if (
      normalized === "tokencount" ||
      normalized === "inputtokens" ||
      normalized === "outputtokens" ||
      normalized === "maxtokens"
    ) {
      return false;
    }
    return true;
  }

  return false;
}

function credentialBearingUrl(value: string): boolean {
  if (!/^https?:\/\//iu.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.username !== "" || parsed.password !== "";
  } catch {
    return false;
  }
}

function highConfidenceSecret(value: string): string | null {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(value)) {
    return "private-key material";
  }
  if (/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/iu.test(value)) {
    return "bearer token material";
  }
  if (/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/u.test(value)) {
    return "GitHub token material";
  }
  if (/\bgithub_pat_[A-Za-z0-9_]{30,}\b/u.test(value)) {
    return "GitHub fine-grained token material";
  }
  if (/\bAKIA[0-9A-Z]{16}\b/u.test(value)) {
    return "AWS access-key material";
  }
  if (/\bsk-[A-Za-z0-9_-]{20,}\b/u.test(value)) {
    return "provider API-key material";
  }
  if (
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u.test(
      value,
    )
  ) {
    return "JWT-like token material";
  }
  return null;
}

function pathChild(parent: string, key: string | number): string {
  return typeof key === "number"
    ? `${parent}[${key}]`
    : parent === "$"
      ? `$.${key}`
      : `${parent}.${key}`;
}

export function auditPublicProjection(
  value: unknown,
  options: PublicProjectionAuditOptions = {},
): readonly PublicProjectionLeak[] {
  const maxDepth = options.maxDepth ?? 12;
  const maxNodes = options.maxNodes ?? 5000;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 64) {
    throw new RangeError("maxDepth must be between 1 and 64");
  }
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > 100_000) {
    throw new RangeError("maxNodes must be between 1 and 100000");
  }

  const leaks: PublicProjectionLeak[] = [];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let traversalLimitReported = false;

  function report(
    path: string,
    kind: PublicProjectionLeakKind,
    reason: string,
  ): void {
    leaks.push(Object.freeze({ path, kind, reason }));
  }

  function visit(current: unknown, path: string, depth: number): void {
    nodes += 1;
    if (nodes > maxNodes) {
      if (!traversalLimitReported) {
        traversalLimitReported = true;
        report(path, "traversal-limit", "public projection exceeds node bound");
      }
      return;
    }
    if (depth > maxDepth) {
      report(path, "traversal-limit", "public projection exceeds depth bound");
      return;
    }

    if (
      current === null ||
      typeof current === "boolean" ||
      typeof current === "number"
    ) {
      if (typeof current === "number" && !Number.isFinite(current)) {
        report(path, "invalid-structure", "public projection contains non-finite number");
      }
      return;
    }

    if (typeof current === "string") {
      if (credentialBearingUrl(current)) {
        report(path, "credential-url", "URL contains embedded credentials");
      }
      const secretReason = highConfidenceSecret(current);
      if (secretReason !== null) {
        report(path, "secret-value", secretReason);
      }
      return;
    }

    if (
      typeof current === "undefined" ||
      typeof current === "bigint" ||
      typeof current === "symbol" ||
      typeof current === "function"
    ) {
      report(
        path,
        "invalid-structure",
        `public projection contains non-JSON ${typeof current}`,
      );
      return;
    }

    if (typeof current !== "object") {
      report(path, "invalid-structure", "public projection contains unsupported value");
      return;
    }

    if (seen.has(current)) {
      report(path, "invalid-structure", "public projection contains a cycle");
      return;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        visit(current[index], pathChild(path, index), depth + 1);
        if (nodes > maxNodes) break;
      }
      return;
    }

    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) {
      report(path, "invalid-structure", "public projection object must be plain JSON");
      return;
    }

    for (const [key, child] of Object.entries(current)) {
      const childPath = pathChild(path, key);
      if (isForbiddenField(key)) {
        report(
          childPath,
          "forbidden-field",
          "credential-bearing field name is not allowed in public projection",
        );
      }
      visit(child, childPath, depth + 1);
      if (nodes > maxNodes) break;
    }
  }

  visit(value, "$", 0);
  return Object.freeze(leaks);
}

export function assertPublicProjectionSafe(
  value: unknown,
  options?: PublicProjectionAuditOptions,
): void {
  const leaks = auditPublicProjection(value, options);
  if (leaks.length > 0) {
    const first = leaks[0]!;
    throw new Error(
      `Public projection security audit failed at ${first.path}: ${first.reason}`,
    );
  }
}

export function assertTenantScopedPublicRecords<T extends { readonly tenantId: TenantId }>(
  expectedTenantId: TenantId,
  records: readonly T[],
): readonly T[] {
  const tenantId = parseCanonicalId("tenant", expectedTenantId);
  if (!Array.isArray(records) || records.length > 100_000) {
    throw new RangeError("public record batch is invalid");
  }
  for (const record of records) {
    const recordTenantId = parseCanonicalId("tenant", record.tenantId);
    if (recordTenantId !== tenantId) {
      throw new Error("Cross-tenant public projection detected");
    }
  }
  return records;
}
