import {
  PlatformError,
  getCanonicalIdKind,
  type CanonicalIdKind,
} from "@masanawa/contracts";
import type { JsonObject, JsonValue } from "./model.js";

const privateReferenceKinds = new Set<CanonicalIdKind>([
  "user",
  "relationship",
  "memory-record",
  "memory-revision",
  "character-session",
  "channel-session",
  "presence-session",
  "credential-ref",
  "channel-account",
  "device",
  "device-credential",
]);

const privateFieldNames = new Set([
  "userid",
  "userids",
  "relationshipid",
  "relationshipids",
  "memoryid",
  "memoryids",
  "memoryrecordid",
  "memoryrecordids",
  "memoryrevisionid",
  "memoryrevisionids",
  "privatememory",
  "privatememoryid",
  "privatecontext",
  "relationshipmemory",
  "charactersessionid",
  "channelsessionid",
  "presencesessionid",
  "credentialref",
  "credentialrefid",
  "channelaccountid",
  "devicecredentialid",
]);

function normalizedFieldName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/gu, "").toLowerCase();
}

function privateReferenceError(
  path: string,
  reason: string,
): PlatformError {
  return new PlatformError({
    code: "world.private_reference_forbidden",
    category: "validation",
    message: "Private relationship/user/memory references cannot enter shared World state",
    retryable: false,
    details: {
      path,
      reason,
    },
  });
}

export function assertWorldTextHasNoPrivateReference(
  value: string,
  path = "$",
): void {
  const kind = getCanonicalIdKind(value);
  if (kind !== null && privateReferenceKinds.has(kind)) {
    throw privateReferenceError(path, `canonical-id:${kind}`);
  }
}

function assertJsonValueShareable(
  value: JsonValue,
  path: string,
  depth: number,
): void {
  if (depth > 64) {
    throw new PlatformError({
      code: "world.payload_too_deep",
      category: "validation",
      message: "World payload nesting exceeds the supported depth",
      retryable: false,
      details: { path },
    });
  }

  if (typeof value === "string") {
    assertWorldTextHasNoPrivateReference(value, path);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertJsonValueShareable(entry, `${path}[${index}]`, depth + 1),
    );
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (privateFieldNames.has(normalizedFieldName(key))) {
      throw privateReferenceError(childPath, "reserved-private-field");
    }
    assertJsonValueShareable(entry as JsonValue, childPath, depth + 1);
  }
}

export function assertWorldPayloadHasNoPrivateReferences(
  payload: JsonObject,
): void {
  assertJsonValueShareable(payload, "$", 0);
}

export function assertWorldTextsHaveNoPrivateReferences(
  values: Readonly<Record<string, string | null>>,
): void {
  for (const [name, value] of Object.entries(values)) {
    if (value !== null) {
      assertWorldTextHasNoPrivateReference(value, `$.${name}`);
    }
  }
}
