import { describe, expect, it } from "vitest";
import { createTwinProductionRuntime } from "./twin_production_runtime.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const ownerUserId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

const profile = Object.freeze({
  tenantId,
  ownerUserId,
  characterId,
  publicId: "amina-bello",
  displayName: "Amina Bello",
  bio: "Teacher and storyteller",
  interests: Object.freeze(["learning"]),
  languages: Object.freeze(["English", "Hausa"]),
  avatarUrl: null,
  discoverable: true,
  revision: 1,
  updatedAt: "2026-10-05T16:00:00.000Z" as never,
});

function harness() {
  const runtime = createTwinProductionRuntime({
    sessions: {
      async authorize() {
        return {
          tenantId,
          userId: ownerUserId,
          profile: {
            userId: ownerUserId,
            name: "Amina Bello",
            email: "amina@example.com",
            phone: null,
            locale: "en",
            createdAt: "2026-10-05T15:00:00.000Z",
          },
        } as never;
      },
    },
    profiles: {
      async ensureForOwner() {
        return profile;
      },
      async update() {
        return profile;
      },
      async searchPublic() {
        return [profile];
      },
      async readPublicById() {
        return profile;
      },
    } as never,
    economy: {
      async isTwinBlocked() {
        return false;
      },
      async readOwnerAccessOffering() {
        return null;
      },
      async listCreditOperationsForUser() {
        return [];
      },
    } as never,
    events: {
      async append() {
        return "event-1";
      },
      async listForCharacter() {
        return [];
      },
      async listForUser() {
        return [];
      },
    },
    commerce: {
      async readBalance() {
        return 1200;
      },
      async readCreatorCommercialSnapshot() {
        return {
          agentFloatCredits: 9999,
          pendingEarningsCredits: 30,
          availableEarningsCredits: 70,
        };
      },
    } as never,
    personalClones: {
      async readPersonalClone() {
        return {
          characterId,
          characterVersionId:
            "character-version_00000000-0000-4000-8000-000000000004",
          relationshipId:
            "relationship_00000000-0000-4000-8000-000000000005",
        };
      },
    } as never,
    publicTwinBaseUrl: "https://masanawa.com/twin",
    adminPrincipals: new Set<string>(),
    voice: {
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 7000,
    },
    ownerAccess: {
      platformFeeBasisPoints: 1000,
      acceptWithinMinutes: 60,
      startGraceMinutes: 15,
    },
  });

  return runtime;
}

describe("Twin production runtime composition", () => {
  it("exposes the complete canonical Twin production surface as one frozen runtime", () => {
    const runtime = harness();

    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.keys(runtime).sort()).toEqual([
      "commissionAdmin",
      "creditTransfer",
      "gifts",
      "monetization",
      "myTwin",
      "ownerAccess",
      "ownerAccessOffering",
      "paidFeatureTrialAdmin",
      "paidVoice",
      "twinActivity",
      "twinAttribution",
      "twinDirectory",
      "twinProfile",
      "twinSafety",
      "voiceAdmissionGate",
      "wallet",
    ].sort());
  });

  it("wires authenticated public discovery, My Twin and Wallet projections through canonical sources", async () => {
    const runtime = harness();

    const discovered = await runtime.twinDirectory.search({
      authorizationHeader: "Bearer owner",
      query: "amina",
    });
    expect(discovered).toEqual([
      expect.objectContaining({
        characterId,
        publicId: "amina-bello",
        representationLabel: "AI twin",
        textChatMode: "free",
      }),
    ]);

    const mine = await runtime.myTwin.read({
      authorizationHeader: "Bearer owner",
    });
    expect(mine).toEqual(expect.objectContaining({
      hasTwin: true,
      characterId,
      displayName: "Amina Bello",
      publicUrl: "https://masanawa.com/twin/amina-bello",
      discoverable: true,
      voiceEnabled: true,
      ownerAccessEnabled: false,
    }));

    const wallet = await runtime.wallet.read({
      authorizationHeader: "Bearer owner",
    });
    expect(wallet).toEqual({
      spendableCredits: 1200,
      pendingEarningsCredits: 30,
      availableEarningsCredits: 70,
      entries: [],
    });
    expect(JSON.stringify(wallet)).not.toContain("9999");
  });
});
