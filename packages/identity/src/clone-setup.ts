import { parseCanonicalId, type TenantId, type UserId, type RequestId } from "@masanawa/contracts";

export interface CloneSetupScope { readonly tenantId: TenantId; readonly userId: UserId }
export interface CloneSetupProfile {
  readonly displayName: string | null;
  readonly biography: string;
  readonly languages: readonly string[];
  readonly personality: readonly string[];
  readonly expertise: readonly string[];
}
export interface CloneSetupResult {
  readonly characterId: string;
  readonly characterVersionId: string;
  readonly relationshipId: string;
  readonly displayName: string;
  readonly created: boolean;
}
export interface CloneSetup extends CloneSetupScope {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly state: "editing" | "preview" | "confirmed" | "ready" | "cancelled";
  readonly profile: CloneSetupProfile;
  readonly confirmationRequestId: RequestId | null;
  readonly confirmationPreviewRevision: number | null;
  readonly result: CloneSetupResult | null;
}
export interface CloneSetupRepository {
  read(scope: CloneSetupScope): Promise<CloneSetup | null>;
  /** Serialize the pure transition with current active Tenant/User custody. */
  mutate(scope: CloneSetupScope, transition: (current: CloneSetup | null) => CloneSetup): Promise<CloneSetup>;
}
export class CloneSetupError extends Error {
  constructor(readonly code: "invalid" | "conflict" | "not-ready" | "confirmed") {
    super(`Clone setup ${code}`);
    this.name = "CloneSetupError";
  }
}
const fail = (code: CloneSetupError["code"]): never => { throw new CloneSetupError(code); };
function requestIdentity(value: string): RequestId {
  try { return parseCanonicalId("request", value); }
  catch { return fail("invalid"); }
}
const keys = ["displayName", "biography", "languages", "personality", "expertise"] as const;

function bounded(value: unknown, maximum: number): string {
  if (typeof value !== "string") return fail("invalid");
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(trimmed)) return fail("invalid");
  return trimmed;
}
function list(value: unknown, maximum: number, allowEmpty = false): readonly string[] {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) return fail("invalid");
  const values = value.map(item => bounded(item, 120));
  if (new Set(values.map(item => item.toLowerCase())).size !== values.length) return fail("invalid");
  return Object.freeze(values);
}
function scopeOf(scope: CloneSetupScope): CloneSetupScope {
  return { tenantId: parseCanonicalId("tenant", scope.tenantId), userId: parseCanonicalId("user", scope.userId) };
}
export function emptyCloneSetupProfile(): CloneSetupProfile {
  return Object.freeze({ displayName: null, biography: "A personal Masanawa clone.", languages: Object.freeze([]), personality: Object.freeze(["Friendly", "Clear"]), expertise: Object.freeze(["Everyday conversation"]) });
}
export function patchCloneSetupProfile(profile: CloneSetupProfile, patch: unknown): CloneSetupProfile {
  if (!patch || typeof patch !== "object" || Array.isArray(patch) || Object.keys(patch).some(key => !(keys as readonly string[]).includes(key))) return fail("invalid");
  if (Object.getPrototypeOf(patch) !== Object.prototype && Object.getPrototypeOf(patch) !== null) return fail("invalid");
  const values = patch as Record<string, unknown>;
  const has = (key: string) => Object.hasOwn(values, key);
  return Object.freeze({
    displayName: has("displayName") ? (values.displayName === null ? null : bounded(values.displayName, 120)) : profile.displayName,
    biography: has("biography") ? bounded(values.biography, 1000) : profile.biography,
    languages: has("languages") ? list(values.languages, 16, true) : Object.freeze([...profile.languages]),
    personality: has("personality") ? list(values.personality, 24) : Object.freeze([...profile.personality]),
    expertise: has("expertise") ? list(values.expertise, 32) : Object.freeze([...profile.expertise]),
  });
}
export function newCloneSetup(scope: CloneSetupScope): CloneSetup {
  return Object.freeze({ ...scopeOf(scope), schemaVersion: 1, revision: 1, state: "editing", profile: emptyCloneSetupProfile(), confirmationRequestId: null, confirmationPreviewRevision: null, result: null });
}
function sameScope(scope: CloneSetupScope, draft: CloneSetup): void {
  scopeOf(scope);
  if (scope.tenantId !== draft.tenantId || scope.userId !== draft.userId) fail("invalid");
}
function revision(draft: CloneSetup, expected: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1 || expected !== draft.revision || draft.revision >= Number.MAX_SAFE_INTEGER) fail("conflict");
}
export function reviseCloneSetup(scope: CloneSetupScope, current: CloneSetup | null, expected: number | null, patch: unknown): CloneSetup {
  if (!current) {
    if (expected !== null) return fail("conflict");
    const draft = newCloneSetup(scope);
    return Object.freeze({ ...draft, profile: patchCloneSetupProfile(draft.profile, patch) });
  }
  sameScope(scope, current);
  if (expected === null) return fail("conflict");
  revision(current, expected);
  if (current.state === "confirmed" || current.state === "ready") return fail("confirmed");
  return Object.freeze({ ...current, revision: current.revision + 1, state: "editing", profile: patchCloneSetupProfile(current.state === "cancelled" ? emptyCloneSetupProfile() : current.profile, patch) });
}
export function previewCloneSetup(scope: CloneSetupScope, draft: CloneSetup | null, expected: number): CloneSetup {
  if (!draft) return fail("not-ready");
  sameScope(scope, draft);
  revision(draft, expected);
  if (draft.state !== "editing" && draft.state !== "preview") return fail("confirmed");
  if (!draft.profile.displayName || draft.profile.languages.length === 0) return fail("not-ready");
  if (draft.state === "preview") return draft;
  return Object.freeze({ ...draft, revision: draft.revision + 1, state: "preview" });
}
export function confirmCloneSetup(scope: CloneSetupScope, draft: CloneSetup | null, expected: number, requestId: string): CloneSetup {
  const id = requestIdentity(requestId);
  if (!draft) return fail("not-ready");
  sameScope(scope, draft);
  if (draft.state === "confirmed" || draft.state === "ready") {
    if (draft.confirmationRequestId !== id || draft.confirmationPreviewRevision !== expected) return fail("conflict");
    return draft;
  }
  revision(draft, expected);
  if (draft.state !== "preview") return fail("not-ready");
  return Object.freeze({ ...draft, revision: draft.revision + 1, state: "confirmed", confirmationRequestId: id, confirmationPreviewRevision: expected });
}
export function completeCloneSetup(scope: CloneSetupScope, draft: CloneSetup | null, requestId: string, value: CloneSetupResult): CloneSetup {
  if (!draft) return fail("not-ready");
  sameScope(scope, draft);
  if (draft.confirmationRequestId !== requestIdentity(requestId)) return fail("conflict");
  const result = Object.freeze({ characterId: parseCanonicalId("character", value.characterId), characterVersionId: parseCanonicalId("character-version", value.characterVersionId), relationshipId: parseCanonicalId("relationship", value.relationshipId), displayName: bounded(value.displayName, 120), created: value.created });
  if (typeof result.created !== "boolean") return fail("invalid");
  if (draft.state === "ready") {
    if (draft.result?.characterId !== result.characterId || draft.result.characterVersionId !== result.characterVersionId || draft.result.relationshipId !== result.relationshipId || draft.result.displayName !== result.displayName) return fail("conflict");
    return draft;
  }
  if (draft.state !== "confirmed") return fail("not-ready");
  return Object.freeze({ ...draft, revision: draft.revision + 1, state: "ready", result });
}
export function cancelCloneSetup(scope: CloneSetupScope, draft: CloneSetup | null, expected: number): CloneSetup {
  if (!draft) return fail("not-ready");
  sameScope(scope, draft);
  revision(draft, expected);
  if (draft.state === "confirmed" || draft.state === "ready") return fail("confirmed");
  if (draft.state === "cancelled") return draft;
  return Object.freeze({ ...draft, revision: draft.revision + 1, state: "cancelled", profile: emptyCloneSetupProfile() });
}
