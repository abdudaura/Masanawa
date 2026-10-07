import { describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { type CloneSetup, type CloneSetupRepository, type CloneSetupScope } from "@masanawa/identity";
import { createCloneOnboardingService } from "./clone_onboarding.js";
import { createCloneOnboardingShell, type CloneOnboardingShellBinding, type CloneOnboardingShellAction, type CloneOnboardingShellDocument } from "./clone_onboarding_shell.js";

function fixture() {
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user") };
  let setup: CloneSetup | null = null;
  const setups: CloneSetupRepository = { read: async () => setup, mutate: async (_scope, transition) => (setup = transition(setup)) };
  const authorizer = { authorize: vi.fn(async () => scope) };
  const supportId = createCanonicalId("character");
  const directory = { list: vi.fn(async () => [{ characterId: supportId, characterVersionId: createCanonicalId("character-version"), displayName: "Gwana", roleLabel: "Support", about: "Support", greeting: null, presence: "available" as const, activeWorkCount: 0 as const, supportAgent: true, defaultPlatformAgent: true, voiceProvider: "gemini", voiceName: "Sulafat" }]), setDefaultPlatformAgent: vi.fn(async () => ({ characterId: supportId })) };
  const result = { characterId: createCanonicalId("character"), characterVersionId: createCanonicalId("character-version"), relationshipId: createCanonicalId("relationship"), displayName: "Nasir", created: true };
  const clones = { create: vi.fn(async () => result) };
  const core = { ensure: vi.fn(async () => undefined) };
  const service = createCloneOnboardingService({ authorizer, setups, directory, clones, core });
  const bindings = new Map<string, CloneOnboardingShellBinding>();
  const clock = { value: Date.parse("2026-10-04T21:40:00Z") };
  const shell = createCloneOnboardingShell({ service, authorizer, now: () => clock.value, bindings: {
    issue: async binding => { const token = `opaque-private-token-${bindings.size}`; bindings.set(token, binding); return token; },
    resolve: async token => bindings.get(token) ?? null,
  } });
  const auth = { authorizationHeader: "Bearer test-only" };
  let revision = 0;
  const render = (mode: "profile" | "edit" | "support" = "profile") => shell.render(auth, { documentId: "clone-setup", revision: revision++, mode });
  function action(document: CloneOnboardingShellDocument, nodeId: string, values: Record<string, string> = {}): CloneOnboardingShellAction {
    const flattened = document.nodes.flatMap(n => [n, ...(n.children ?? [])]);
    const node = flattened.find(n => n.id === nodeId)!;
    return { documentId: document.id, revision: document.revision, nodeId, actionId: node.action!, token: node.token!, values };
  }
  const prepare = async () => {
    const first = await render();
    await shell.execute({ ...auth, action: action(first, "save", { displayName: "Nasir", languages: "Hausa, English" }) });
    const review = await render();
    await shell.execute({ ...auth, action: action(review, "preview") });
    return render();
  };
  return { scope, service, shell, auth, render, action, prepare, bindings, clock, authorizer, clones, core, directory, supportId, setup: () => setup };
}

describe("onboarding ShellDocument action bridge", () => {
  it("collects a profile without cloning and supplies a complete read-only review before confirmation", async () => {
    const f = fixture(); const document = await f.prepare();
    expect(f.setup()?.state).toBe("preview");
    expect(document.nodes.flatMap(n => n.children ?? []).some(n => n.text === "Languages: Hausa, English")).toBe(true);
    expect(document.nodes.some(n => n.type === "input")).toBe(false);
    expect(f.clones.create).not.toHaveBeenCalled();
    await f.shell.execute({ ...f.auth, action: f.action(document, "confirm") });
    expect(f.setup()?.state).toBe("ready");
  });
  it("preserves the same confirmation across an interrupted creation, fresh projection and exact old action replay", async () => {
    const f = fixture(); const document = await f.prepare(); const action = f.action(document, "confirm");
    const originalId = f.bindings.get(action.token)!.confirmationRequestId;
    f.core.ensure.mockRejectedValueOnce(new Error("not ready"));
    await expect(f.shell.execute({ ...f.auth, action })).rejects.toThrow();
    const recovery = await f.render();
    expect(f.bindings.get(f.action(recovery, "confirm").token)?.confirmationRequestId).toBe(originalId);
    await f.shell.execute({ ...f.auth, action });
    await f.shell.execute({ ...f.auth, action: f.action(recovery, "confirm") });
    expect(f.setup()?.confirmationRequestId).toBe(originalId);
    expect(f.clones.create).toHaveBeenCalledTimes(2);
  });
  it("edits only submitted fields, invalidates the preview and rejects its old confirmation", async () => {
    const f = fixture(); const document = await f.prepare(); const confirm = f.action(document, "confirm");
    const edit = await f.shell.execute({ ...f.auth, action: f.action(document, "edit") });
    expect(edit.mode).toBe("edit");
    expect(f.setup()?.state).toBe("preview");
    const form = await f.render(edit.mode);
    await f.shell.execute({ ...f.auth, action: f.action(form, "save", { displayName: "New name", languages: "" }) });
    expect(f.setup()?.profile.languages).toEqual(["Hausa", "English"]);
    expect(f.setup()?.state).toBe("editing");
    await expect(f.shell.execute({ ...f.auth, action: confirm })).rejects.toThrow();
    expect(f.clones.create).not.toHaveBeenCalled();
  });
  it("rejects forged tokens, cross-user and document/node/action substitutions", async () => {
    const f = fixture(); const document = await f.prepare(); const action = f.action(document, "confirm");
    for (const change of [{ token: "unknown-token" }, { documentId: "other" }, { revision: 999 }, { nodeId: "cancel" }, { actionId: "clone.onboarding.cancel" }]) {
      await expect(f.shell.execute({ ...f.auth, action: { ...action, ...change } })).rejects.toThrow();
    }
    f.authorizer.authorize.mockResolvedValueOnce({ ...f.scope, userId: createCanonicalId("user") });
    await expect(f.shell.execute({ ...f.auth, action })).rejects.toThrow();
    expect(f.clones.create).not.toHaveBeenCalled();
  });
  it("rejects expired actions and confirmation payload injection", async () => {
    const f = fixture(); const document = await f.prepare(); const action = f.action(document, "confirm");
    await expect(f.shell.execute({ ...f.auth, action: { ...action, values: { displayName: "Forged" } } })).rejects.toThrow();
    f.clock.value += 10 * 60_000;
    await expect(f.shell.execute({ ...f.auth, action })).rejects.toThrow();
    expect(f.clones.create).not.toHaveBeenCalled();
  });
  it("rejects technical fields and malformed language lists before saving", async () => {
    const f = fixture(); const document = await f.render();
    for (const values of [{ providerKey: "hidden" }, { displayName: "Nasir", languages: "Hausa,,English" }, { biography: "x".repeat(513) }, {}]) {
      await expect(f.shell.execute({ ...f.auth, action: f.action(document, "save", values) })).rejects.toThrow();
    }
    expect(f.setup()).toBeNull();
  });
  it("selects only the server-bound configured support identity", async () => {
    const f = fixture(); const document = await f.render("support");
    const action = f.action(document, `support-${f.supportId}`);
    await expect(f.shell.execute({ ...f.auth, action: { ...action, values: { characterId: createCanonicalId("character") } } })).rejects.toThrow();
    await f.shell.execute({ ...f.auth, action });
    expect(f.directory.setDefaultPlatformAgent).toHaveBeenCalledWith({ ...f.auth, characterId: f.supportId });
  });
  it("cancels an unconfirmed draft and emits no clone-creation action for a completed setup", async () => {
    const f = fixture(); const document = await f.prepare();
    await f.shell.execute({ ...f.auth, action: f.action(document, "cancel") });
    expect(f.setup()?.profile.displayName).toBeNull();
    const confirmed = await f.prepare();
    await f.shell.execute({ ...f.auth, action: f.action(confirmed, "confirm") });
    const completed = await f.render();
    expect(completed.nodes.flatMap(n => [n, ...(n.children ?? [])]).some(n => n.type === "button")).toBe(false);
  });
  it("bounds documents to the existing v1 parser and freezes nested presentation data", async () => {
    const f = fixture(); const document = await f.prepare();
    const primitives = new Set(["heading", "text", "card", "input", "button", "options", "notice"]);
    const flattened = document.nodes.flatMap(n => [n, ...(n.children ?? [])]);
    expect(flattened.every(n => primitives.has(n.type))).toBe(true);
    expect(new Set(flattened.filter(n => n.id).map(n => n.id)).size).toBe(flattened.filter(n => n.id).length);
    expect(flattened.length).toBeLessThanOrEqual(100);
    expect(Object.isFrozen(document.nodes)).toBe(true);
    expect(Object.isFrozen(document.nodes.find(n => n.type === "card")?.children)).toBe(true);
    await expect(f.shell.render(f.auth, { documentId: "invalid id", revision: 0 })).rejects.toThrow();
  });
});
