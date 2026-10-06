import { describe, expect, it } from "vitest";
import {
  InMemorySocialRepository,
  createSocialAccountBinding,
  createSocialContent,
  socialAccountKey,
  transitionSocialAccountBinding,
  transitionSocialContentState,
} from "../../packages/social/src/index.js";

const tenantId = "tenant_018f6b2e-7c00-7001-8000-000000000001" as never;
const characterA =
  "character_018f6b2e-7c00-7002-8000-000000000002" as never;
const characterB =
  "character_018f6b2e-7c00-7003-8000-000000000003" as never;
const versionA =
  "character-version_018f6b2e-7c00-7004-8000-000000000004" as never;
const contentId =
  "social-content_018f6b2e-7c00-7005-8000-000000000005" as never;

function accountInput(input?: {
  readonly characterId?: typeof characterA | typeof characterB;
  readonly providerKey?: string;
  readonly accountValue?: string;
  readonly displayName?: string;
}) {
  return {
    tenantId,
    characterId: input?.characterId ?? characterA,
    providerKey: input?.providerKey ?? "instagram",
    externalAccount: {
      system: "meta",
      namespace: "instagram-account",
      value: input?.accountValue ?? "17841400000000001",
      observedAt: "2026-10-06T12:00:00.000Z" as never,
      provenance: { source: "oauth-account-introspection" },
    },
    displayName: input?.displayName ?? "Amina Bello",
    handle: "@amina",
    createdAt: "2026-10-06T12:00:00.000Z" as never,
  };
}

describe("Task 131 canonical Social account identity", () => {
  it("derives a stable account key without storing provider credentials", () => {
    const input = accountInput();
    const binding = createSocialAccountBinding(input);

    expect(binding).toMatchObject({
      tenantId,
      characterId: characterA,
      providerKey: "instagram",
      state: "active",
      revision: 1,
    });
    expect(binding.accountKey).toBe(
      socialAccountKey({
        providerKey: input.providerKey,
        externalAccount: input.externalAccount,
      }),
    );

    const serialized = JSON.stringify(binding);
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("refreshToken");
    expect(serialized).not.toContain("clientSecret");
  });

  it("reuses an exact account binding and rejects identity rebinding", async () => {
    const repository = new InMemorySocialRepository();
    const first = await repository.createAccount(accountInput());
    const replay = await repository.createAccount(accountInput());

    expect(first.reused).toBe(false);
    expect(replay.reused).toBe(true);
    expect(replay.record).toEqual(first.record);

    await expect(
      repository.createAccount(
        accountInput({
          characterId: characterB,
          displayName: "Different Character",
        }),
      ),
    ).rejects.toThrow("different binding");
  });

  it("uses optimistic account revisions with terminal revocation", () => {
    const active = createSocialAccountBinding(accountInput());
    const suspended = transitionSocialAccountBinding({
      current: active,
      expectedRevision: 1,
      nextState: "suspended",
      updatedAt: "2026-10-06T12:01:00.000Z" as never,
    });
    expect(suspended.revision).toBe(2);

    expect(() =>
      transitionSocialAccountBinding({
        current: suspended,
        expectedRevision: 1,
        nextState: "active",
        updatedAt: "2026-10-06T12:02:00.000Z" as never,
      }),
    ).toThrow("revision is stale");

    const revoked = transitionSocialAccountBinding({
      current: suspended,
      expectedRevision: 2,
      nextState: "revoked",
      updatedAt: "2026-10-06T12:02:00.000Z" as never,
    });
    expect(revoked.state).toBe("revoked");

    expect(() =>
      transitionSocialAccountBinding({
        current: revoked,
        expectedRevision: 3,
        nextState: "active",
        updatedAt: "2026-10-06T12:03:00.000Z" as never,
      }),
    ).toThrow("Invalid social account transition");
  });
});

describe("Task 131 canonical Social content state", () => {
  it("creates immutable content revisions targeting active accounts bound to the same Character", async () => {
    const repository = new InMemorySocialRepository();
    const instagram = (
      await repository.createAccount(accountInput())
    ).record;
    const linkedin = (
      await repository.createAccount(
        accountInput({
          providerKey: "linkedin",
          accountValue: "urn:li:person:abc123",
        }),
      )
    ).record;

    const created = await repository.createContent({
      tenantId,
      socialContentId: contentId,
      characterId: characterA,
      characterVersionId: versionA,
      body: "Launch update",
      language: "en",
      media: [
        {
          reference: {
            system: "masanawa-artifacts",
            namespace: "image",
            value: "artifact/social-image-001",
            observedAt: "2026-10-06T12:01:00.000Z" as never,
          },
          altText: "Product screenshot",
        },
      ],
      targetAccountKeys: [linkedin.accountKey, instagram.accountKey],
      createdAt: "2026-10-06T12:01:00.000Z" as never,
    });

    expect(created.reused).toBe(false);
    expect(created.snapshot.content).toMatchObject({
      socialContentId: contentId,
      characterId: characterA,
      characterVersionId: versionA,
      state: "draft",
      lifecycleRevision: 1,
      currentRevisionNumber: 1,
    });
    expect(created.snapshot.currentRevision.targetAccountKeys).toEqual(
      [...created.snapshot.currentRevision.targetAccountKeys].sort(),
    );

    const revised = await repository.appendContentRevision({
      tenantId,
      socialContentId: contentId,
      expectedRevisionNumber: 1,
      body: "Launch update — revised",
      language: "en",
      targetAccountKeys: [instagram.accountKey],
      createdAt: "2026-10-06T12:02:00.000Z" as never,
    });

    expect(revised.content.currentRevisionNumber).toBe(2);
    expect(revised.currentRevision.body).toBe("Launch update — revised");
    const revisions = await repository.listContentRevisions({
      tenantId,
      socialContentId: contentId,
    });
    expect(revisions.map((item) => item.revisionNumber)).toEqual([1, 2]);
    expect(revisions[0]?.body).toBe("Launch update");
  });

  it("rejects cross-Character and inactive account targets", async () => {
    const repository = new InMemorySocialRepository();
    const ownedByB = (
      await repository.createAccount(
        accountInput({
          characterId: characterB,
          accountValue: "17841400000000999",
        }),
      )
    ).record;

    await expect(
      repository.createContent({
        tenantId,
        socialContentId: contentId,
        characterId: characterA,
        characterVersionId: versionA,
        body: "Must not impersonate B",
        targetAccountKeys: [ownedByB.accountKey],
        createdAt: "2026-10-06T12:01:00.000Z" as never,
      }),
    ).rejects.toThrow("another Character");

    const ownedByA = (
      await repository.createAccount(accountInput())
    ).record;
    await repository.transitionAccount({
      tenantId,
      accountKey: ownedByA.accountKey,
      expectedRevision: 1,
      nextState: "suspended",
      updatedAt: "2026-10-06T12:01:30.000Z" as never,
    });

    await expect(
      repository.createContent({
        tenantId,
        socialContentId: contentId,
        characterId: characterA,
        characterVersionId: versionA,
        body: "Cannot target suspended account",
        targetAccountKeys: [ownedByA.accountKey],
        createdAt: "2026-10-06T12:02:00.000Z" as never,
      }),
    ).rejects.toThrow("not active");
  });

  it("uses replay-safe content identity and rejects stale draft revisions", async () => {
    const repository = new InMemorySocialRepository();
    const account = (await repository.createAccount(accountInput())).record;
    const input = {
      tenantId,
      socialContentId: contentId,
      characterId: characterA,
      characterVersionId: versionA,
      body: "Same draft",
      targetAccountKeys: [account.accountKey],
      createdAt: "2026-10-06T12:01:00.000Z" as never,
    };

    const first = await repository.createContent(input);
    const replay = await repository.createContent(input);
    expect(first.reused).toBe(false);
    expect(replay.reused).toBe(true);

    await expect(
      repository.createContent({ ...input, body: "Changed under same id" }),
    ).rejects.toThrow("different content");

    await repository.appendContentRevision({
      tenantId,
      socialContentId: contentId,
      expectedRevisionNumber: 1,
      body: "Revision two",
      targetAccountKeys: [account.accountKey],
      createdAt: "2026-10-06T12:02:00.000Z" as never,
    });

    await expect(
      repository.appendContentRevision({
        tenantId,
        socialContentId: contentId,
        expectedRevisionNumber: 1,
        body: "Stale write",
        targetAccountKeys: [account.accountKey],
        createdAt: "2026-10-06T12:03:00.000Z" as never,
      }),
    ).rejects.toThrow("revision is stale");
  });

  it("enforces legal content lifecycle transitions and rechecks targets before publication", async () => {
    const repository = new InMemorySocialRepository();
    const account = (await repository.createAccount(accountInput())).record;
    await repository.createContent({
      tenantId,
      socialContentId: contentId,
      characterId: characterA,
      characterVersionId: versionA,
      body: "Approval-bound content",
      targetAccountKeys: [account.accountKey],
      createdAt: "2026-10-06T12:01:00.000Z" as never,
    });

    let snapshot = await repository.transitionContent({
      tenantId,
      socialContentId: contentId,
      expectedLifecycleRevision: 1,
      nextState: "approval-required",
      updatedAt: "2026-10-06T12:02:00.000Z" as never,
    });
    snapshot = await repository.transitionContent({
      tenantId,
      socialContentId: contentId,
      expectedLifecycleRevision: snapshot.content.lifecycleRevision,
      nextState: "approved",
      updatedAt: "2026-10-06T12:03:00.000Z" as never,
    });

    await repository.transitionAccount({
      tenantId,
      accountKey: account.accountKey,
      expectedRevision: 1,
      nextState: "suspended",
      updatedAt: "2026-10-06T12:03:30.000Z" as never,
    });

    await expect(
      repository.transitionContent({
        tenantId,
        socialContentId: contentId,
        expectedLifecycleRevision: snapshot.content.lifecycleRevision,
        nextState: "publication-pending",
        updatedAt: "2026-10-06T12:04:00.000Z" as never,
      }),
    ).rejects.toThrow("not active");

    const standalone = createSocialContent({
      tenantId,
      socialContentId:
        "social-content_018f6b2e-7c00-7006-8000-000000000006" as never,
      characterId: characterA,
      characterVersionId: versionA,
      body: "Draft",
      targetAccountKeys: [account.accountKey],
      createdAt: "2026-10-06T12:05:00.000Z" as never,
    });
    expect(() =>
      transitionSocialContentState({
        current: standalone.content,
        expectedLifecycleRevision: 1,
        nextState: "published",
        updatedAt: "2026-10-06T12:06:00.000Z" as never,
      }),
    ).toThrow("Invalid social content transition");
  });
});
