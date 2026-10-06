import { describe, expect, it } from "vitest";
import {
  completeCloneSetup,
  confirmCloneSetup,
  previewCloneSetup,
  projectPublicTwinProfile,
  reviseCloneSetup,
  type CloneSetupScope,
  type TwinPublicProfile,
} from "@masanawa/identity";
import {
  createCanonicalId,
  type Instant,
} from "@masanawa/contracts";
import {
  admitTwinInteraction,
} from "../../services/gateway/src/twin_chat_admission.js";

function readyTwinFixture() {
  const scope: CloneSetupScope = {
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
  };
  const requestId = createCanonicalId("request");

  const editing = reviseCloneSetup(
    scope,
    null,
    null,
    {
      displayName: "Nasir Twin",
      biography: "A personal Masanawa twin.",
      languages: ["Hausa", "English"],
      personality: ["Helpful", "Clear"],
      expertise: ["Everyday conversation"],
    },
  );
  const preview = previewCloneSetup(scope, editing, editing.revision);
  const confirmed = confirmCloneSetup(
    scope,
    preview,
    preview.revision,
    requestId,
  );

  const result = {
    characterId: createCanonicalId("character"),
    characterVersionId: createCanonicalId("character-version"),
    relationshipId: createCanonicalId("relationship"),
    displayName: "Nasir Twin",
    created: true,
  };
  const ready = completeCloneSetup(scope, confirmed, requestId, result);

  return { scope, requestId, preview, confirmed, ready, result };
}

function publicProfile(input: ReturnType<typeof readyTwinFixture>): TwinPublicProfile {
  const at = "2026-10-06T12:00:00.000Z" as Instant;
  return {
    tenantId: input.scope.tenantId,
    characterId: input.result.characterId as never,
    ownerUserId: input.scope.userId,
    publicId: "nasir-twin",
    displayName: input.result.displayName,
    bio: "Public AI representation",
    interests: ["Technology"],
    languages: ["Hausa", "English"],
    avatarUrl: null,
    discoverable: true,
    revision: 1,
    createdAt: at,
    updatedAt: at,
  };
}

describe("TWIN-100 create -> share -> free public text acceptance", () => {
  it("creates one canonical personal Twin and exact replay preserves the same identity", () => {
    const fixture = readyTwinFixture();

    expect(fixture.ready.state).toBe("ready");
    expect(fixture.ready.result).toEqual(fixture.result);

    const replayedConfirmation = confirmCloneSetup(
      fixture.scope,
      fixture.confirmed,
      fixture.preview.revision,
      fixture.requestId,
    );
    expect(replayedConfirmation).toEqual(fixture.confirmed);

    const replayedCompletion = completeCloneSetup(
      fixture.scope,
      fixture.ready,
      fixture.requestId,
      fixture.result,
    );
    expect(replayedCompletion).toEqual(fixture.ready);
    expect(replayedCompletion.result?.characterId).toBe(
      fixture.result.characterId,
    );
  });

  it("shares only the exact created Character through the public AI projection", () => {
    const fixture = readyTwinFixture();
    const projection = projectPublicTwinProfile(publicProfile(fixture));

    expect(projection).not.toBeNull();
    expect(projection).toMatchObject({
      characterId: fixture.result.characterId,
      publicId: "nasir-twin",
      representationLabel: "AI twin",
      ownerPresence: "not-present",
    });
    expect(projection).not.toHaveProperty("ownerUserId");
  });

  it("does not expose a hidden Twin through the public share projection", () => {
    const fixture = readyTwinFixture();
    expect(
      projectPublicTwinProfile({
        ...publicProfile(fixture),
        discoverable: false,
      }),
    ).toBeNull();
  });

  it("keeps public text interaction free even when paid voice evidence exists", () => {
    const fixture = readyTwinFixture();
    const admission = admitTwinInteraction({
      interaction: "text-message",
      userId: createCanonicalId("user"),
      characterId: fixture.result.characterId,
      now: "2026-10-06T12:05:00.000Z",
      paidAdmission: {
        admissionId: "voice-admission-should-not-be-used",
        characterId: fixture.result.characterId,
        userId: createCanonicalId("user"),
        chargeMode: "paid",
        admittedAt: "2026-10-06T12:00:00.000Z",
        expiresAt: "2026-10-06T13:00:00.000Z",
      },
    });

    expect(admission).toEqual({
      interaction: "text-message",
      chargeMode: "free",
      chargeCredits: 0,
      paidAdmissionId: null,
    });
  });

  it("requires a separate valid paid admission for voice instead of upgrading text chat", () => {
    const fixture = readyTwinFixture();

    expect(() =>
      admitTwinInteraction({
        interaction: "live-voice",
        userId: createCanonicalId("user"),
        characterId: fixture.result.characterId,
        now: "2026-10-06T12:05:00.000Z",
      }),
    ).toThrow("requires a valid admission");
  });

  it("cannot replay confirmation under a different request identity", () => {
    const fixture = readyTwinFixture();

    expect(() =>
      confirmCloneSetup(
        fixture.scope,
        fixture.confirmed,
        fixture.preview.revision,
        createCanonicalId("request"),
      ),
    ).toThrow();
  });
});
