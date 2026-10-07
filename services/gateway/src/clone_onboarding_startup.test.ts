import { createServer } from "node:net";
import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import type { CloneSetup, CloneSetupRepository } from "@masanawa/identity";
import type { CharacterSkillAssignment, CharacterSkillAssignmentRepository } from "@masanawa/agents";
import { normalizeSkillGuide } from "@masanawa/skills";
import { skillVersion } from "../../../tests/support/skill-version.js";
import { startGatewayService, type ServiceProcess } from "./main.js";


async function fixture() {
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user") };
  const characterId = createCanonicalId("character");
  let saved: CloneSetup | null = null;
  let assignment: CharacterSkillAssignment | null = null;
  let qualified = false;
  const setups: CloneSetupRepository = {
    read: async () => saved,
    mutate: async (_, transition) => saved = transition(saved),
  };
  const assignments: CharacterSkillAssignmentRepository = {
    readForCharacter: async () => assignment,
    put: async input => assignment = input.assignment,
  };
  // Fixture-only certification; production composition never fabricates evidence.
  const teaching = skillVersion({ key: "core.teaching" });
  const guide = normalizeSkillGuide({ schemaVersion: 1, skillVersionId: teaching.skillVersionId,
    triggerDescription: "Teach on request", instructions: "Test fixture only", resources: [],
    discovery: { priority: 10, phrases: ["teach"], allOf: [], anyOf: [], noneOf: [], minScore: 1 } });
  const create = vi.fn(async () => ({ created: true, characterId,
    characterVersionId: createCanonicalId("character-version"), relationshipId: createCanonicalId("relationship"), displayName: "Amina" }));
  const authorizer = { authorize: vi.fn(async ({ authorizationHeader }: { authorizationHeader: string | undefined }) => {
    if (authorizationHeader !== "Bearer customer-session") throw new Error("denied");
    return scope;
  }) };
  const processRef: ServiceProcess = Object.assign(new EventEmitter(), {
    exitCode: undefined as number | undefined,
    exit: (): never => { throw new Error("unexpected exit"); },
  });
  const reservation = createServer();
  await new Promise<void>(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const runtime = await startGatewayService({
    env: { NODE_ENV: "test", MASANAWA_GATEWAY_HOST: "127.0.0.1", MASANAWA_GATEWAY_PORT: String(port) },
    processRef, creatorCloneAuthorizer: authorizer,
    logger: { info: () => undefined, error: () => undefined },
    appOptions: { creatorClone: { create }, agentDirectory: {
      list: async () => [], setDefaultPlatformAgent: async input => ({ characterId: input.characterId as typeof characterId }),
    } },
    databaseFactory: () => ({
      readinessCheck: { name: "database", check: async () => ({ ready: true }) }, close: async () => undefined,
      cloneSetups: setups, characterSkillAssignments: assignments,
      personalClones: { getOrCreatePersonalClone: async () => { throw new Error("not used"); },
        readPersonalClone: async () => ({ ...scope, characterId, kind: "personal-clone", ownerUserId: scope.userId, createdAt: nowInstant() }) },
      skills: { registerBatch: async () => { throw new Error("must not seed"); }, putReadiness: async () => { throw new Error("must not certify"); },
        readSnapshot: async () => ({ skills: [{ skillId: teaching.skillId, key: teaching.key, createdAt: nowInstant() }], versions: [teaching],
          readiness: [{ revision: 1, readiness: { skillVersionId: teaching.skillVersionId, state: "ready", advertised: true, reasonCode: null, checkedAt: nowInstant() } }] }) },
      skillGuides: { readGuide: async () => guide, readGuides: async () => [guide], putGuide: async () => { throw new Error("must not author"); } },
      skillDistribution: { put: async () => { throw new Error("must not change policy"); }, read: async () => null,
        listForAudience: async () => qualified ? [{ schemaVersion: 1, skillVersionId: teaching.skillVersionId, audiences: ["personal-clone"], installMode: "automatic", category: "teaching", sortOrder: 1 }] : [] },
    }),
  });
  const request = async (path: string, method = "GET", body?: unknown, authorized = true) => {
    const response = await fetch(`${runtime.address}/creator/onboarding${path}`, {
      method, headers: { ...(authorized ? { authorization: "Bearer customer-session" } : {}), ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, cache: response.headers.get("cache-control"), json: await response.json() as any };
  };
  return { runtime, request, create, qualify: () => qualified = true, assignment: () => assignment };
}

it("normal startup mounts saved draft/review/confirm/recovery routes and exact Core custody", async () => {
  const f = await fixture();
  try {
    expect((await f.request("")).json.setup).toBeNull();
    const save = await f.request("/profile", "PUT", { expectedRevision: null, profile: { displayName: "Amina", languages: ["Hausa"] } });
    expect(save.status).toBe(200); expect(save.cache).toBe("private, no-store");
    expect((await f.request("/preview", "POST", { expectedRevision: 1 })).json.setup.state).toBe("preview");
    expect(f.create).not.toHaveBeenCalled();
    const confirmation = { expectedPreviewRevision: 2, requestId: createCanonicalId("request") };
    expect((await f.request("/confirm", "POST", confirmation)).status).toBe(409);
    const interrupted = await f.request("");
    expect(interrupted.json.setup.state).toBe("confirmed");
    expect(interrupted.json.setup.confirmationRequestId).toBe(confirmation.requestId);
    expect((await f.request("/confirm", "POST", { ...confirmation, requestId: createCanonicalId("request") })).status).toBe(409);
    f.qualify();
    const complete = await f.request("/confirm", "POST", confirmation);
    expect(complete.status).toBe(200); expect(complete.json.setup.state).toBe("ready");
    expect(complete.json.runtimeReadiness).toBe("not-verified");
    expect(f.assignment()?.skillVersionIds).toHaveLength(1);
    const replay = await f.request("/confirm", "POST", confirmation);
    expect(replay.json.setup.result).toEqual(complete.json.setup.result);
  } finally { await f.runtime.shutdown(); }
});

it("normal startup rejects unauthorized and forged-scope requests", async () => {
  const f = await fixture();
  try {
    expect((await f.request("", "GET", undefined, false)).status).toBe(403);
    expect((await f.request("/profile", "PUT", { expectedRevision: null, profile: {}, userId: createCanonicalId("user") })).status).toBe(400);
    expect(f.create).not.toHaveBeenCalled();
  } finally { await f.runtime.shutdown(); }
});
