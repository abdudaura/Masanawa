import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { cancelCloneSetup, completeCloneSetup, confirmCloneSetup, newCloneSetup, patchCloneSetupProfile, previewCloneSetup, reviseCloneSetup, type CloneSetup } from "./clone-setup.js";
const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user") };
const request = createCanonicalId("request");
const profile = { displayName: "Nasir", languages: ["Hausa", "English"] };
const editing = () => reviseCloneSetup(scope, null, null, profile);
const preview = () => previewCloneSetup(scope, editing(), 1);
const confirmed = () => confirmCloneSetup(scope, preview(), 2, request);
const result = { characterId: createCanonicalId("character"), characterVersionId: createCanonicalId("character-version"), relationshipId: createCanonicalId("relationship"), displayName: "Nasir", created: true };
describe("resumable clone setup", () => {
  it("starts privately with no invented language/name or character identity", () => {
    const draft = newCloneSetup(scope);
    expect(draft.profile.displayName).toBeNull();
    expect(draft.profile.languages).toEqual([]);
    expect(draft.result).toBeNull();
    expect(Object.isFrozen(draft.profile.languages)).toBe(true);
  });
  it("supports a short partial sequence with server defaults", () => {
    const name = reviseCloneSetup(scope, null, null, { displayName: " Nasir " });
    const language = reviseCloneSetup(scope, name, 1, { languages: ["Hausa"] });
    expect(language.profile).toMatchObject({ displayName: "Nasir", languages: ["Hausa"], personality: ["Friendly", "Clear"] });
  });
  it("rejects incomplete previews", () => expect(() => previewCloneSetup(scope, newCloneSetup(scope), 1)).toThrow());
  it("rejects hidden technical or public-disclosure fields", () => {
    for (const patch of [{ model: "fake" }, { apiKey: "secret" }, { discoverable: true }, { prompt: "override" }, []]) expect(() => patchCloneSetupProfile(newCloneSetup(scope).profile, patch)).toThrow();
  });
  it("rejects duplicate languages, excessive lists and control characters", () => {
    for (const patch of [{ languages: ["Hausa", "hausa"] }, { languages: Array.from({ length: 17 }, (_, i) => String(i)) }, { displayName: "bad\u0000name" }, { expertise: [] }]) expect(() => reviseCloneSetup(scope, null, null, patch)).toThrow();
  });
  it("requires current revision on edits and creation", () => {
    expect(() => reviseCloneSetup(scope, editing(), null, profile)).toThrow();
    expect(() => reviseCloneSetup(scope, editing(), 2, profile)).toThrow();
    expect(() => reviseCloneSetup(scope, null, 1, profile)).toThrow();
  });
  it("invalidates the old preview after an edit", () => {
    const edited = reviseCloneSetup(scope, preview(), 2, { displayName: "New name" });
    expect(edited.state).toBe("editing");
    expect(() => confirmCloneSetup(scope, edited, 2, request)).toThrow();
    expect(() => confirmCloneSetup(scope, edited, 3, request)).toThrow();
  });
  it("does not admit confirmation before a preview", () => expect(() => confirmCloneSetup(scope, editing(), 1, request)).toThrow());
  it("pins confirmation and converges exact replay", () => {
    const draft = confirmed();
    expect(draft.confirmationPreviewRevision).toBe(2);
    expect(confirmCloneSetup(scope, draft, 2, request)).toBe(draft);
    expect(() => confirmCloneSetup(scope, draft, 3, request)).toThrow();
    expect(() => confirmCloneSetup(scope, draft, 2, createCanonicalId("request"))).toThrow();
  });
  it("cannot edit or cancel a confirmed profile", () => {
    expect(() => reviseCloneSetup(scope, confirmed(), 3, { displayName: "changed" })).toThrow();
    expect(() => cancelCloneSetup(scope, confirmed(), 3)).toThrow();
  });
  it("retains the pinned confirmation through serialized recovery", () => {
    const recovered = JSON.parse(JSON.stringify(confirmed())) as CloneSetup;
    expect(confirmCloneSetup(scope, recovered, 2, request)).toBe(recovered);
  });
  it("completes only the same confirmation and rejects result rebinding", () => {
    const ready = completeCloneSetup(scope, confirmed(), request, result);
    expect(ready.state).toBe("ready");
    expect(completeCloneSetup(scope, ready, request, { ...result, created: false })).toBe(ready);
    expect(() => completeCloneSetup(scope, ready, request, { ...result, characterId: createCanonicalId("character") })).toThrow();
    expect(() => completeCloneSetup(scope, confirmed(), createCanonicalId("request"), result)).toThrow();
  });
  it("enforces Tenant and User isolation on every transition", () => {
    for (const foreign of [{ ...scope, userId: createCanonicalId("user") }, { ...scope, tenantId: createCanonicalId("tenant") }]) {
      expect(() => previewCloneSetup(foreign, editing(), 1)).toThrow();
      expect(() => reviseCloneSetup(foreign, editing(), 1, profile)).toThrow();
      expect(() => confirmCloneSetup(foreign, preview(), 2, request)).toThrow();
      expect(() => completeCloneSetup(foreign, confirmed(), request, result)).toThrow();
    }
  });
  it("cancellation clears personal profile data and allows an explicit fresh draft", () => {
    const cancelled = cancelCloneSetup(scope, preview(), 2);
    expect(cancelled.profile.displayName).toBeNull();
    const restarted = reviseCloneSetup(scope, cancelled, 3, { displayName: "Another name" });
    expect(restarted.profile.languages).toEqual([]);
    expect(restarted.state).toBe("editing");
  });
  it("copies mutable input lists", () => {
    const languages = ["Hausa"];
    const draft = reviseCloneSetup(scope, null, null, { ...profile, languages });
    languages.push("English");
    expect(draft.profile.languages).toEqual(["Hausa"]);
  });
});
