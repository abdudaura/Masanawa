import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createProofResolvedChannelRouter,
  type ChannelIdentityResolverPort,
  type DeterministicChannelRouterPort,
} from "./channel_resolved_routing.js";

function fixture() {
  return {
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
    channelAccountId: createCanonicalId("channel-account"),
    characterId: createCanonicalId("character"),
    relationshipId: createCanonicalId("relationship"),
  };
}

describe("proof-resolved deterministic channel routing", () => {
  it("routes only after proof-backed User resolution and preserves evidence", async () => {
    const f = fixture();
    let routedUser = "";
    const identities: ChannelIdentityResolverPort = {
      async resolve() {
        return {
          status: "resolved",
          identity: {
            tenantId: f.tenantId,
            channelAccountId: f.channelAccountId,
            channel: "whatsapp",
            userId: f.userId,
            externalSubjectId: "wa:+2348012345678",
            bindingRevision: 4,
            proof: {
              purpose: "account-link",
              method: "channel-possession-challenge",
              evidenceRef: "channel-link:request-123",
              verifiedAt: toInstant("2026-10-06T16:00:00.000Z"),
            },
          },
        };
      },
    };
    const router: DeterministicChannelRouterPort = {
      async resolve(input) {
        routedUser = input.userId;
        return {
          tenantId: input.tenantId,
          userId: input.userId,
          characterId: f.characterId,
          relationshipId: f.relationshipId,
          source: "tenant-default",
        };
      },
    };

    const result = await createProofResolvedChannelRouter({
      identities,
      router,
    }).resolve({
      tenantId: f.tenantId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "wa:+2348012345678",
      observedAt: toInstant("2026-10-06T16:01:00.000Z"),
    });

    expect(routedUser).toBe(f.userId);
    expect(result).toEqual({
      tenantId: f.tenantId,
      userId: f.userId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "wa:+2348012345678",
      bindingRevision: 4,
      proofMethod: "channel-possession-challenge",
      proofEvidenceRef: "channel-link:request-123",
      proofVerifiedAt: "2026-10-06T16:00:00.000Z",
      characterId: f.characterId,
      relationshipId: f.relationshipId,
      source: "tenant-default",
    });
  });

  it("fails before Character selection when subject is unlinked", async () => {
    const f = fixture();
    let routed = false;
    const identities: ChannelIdentityResolverPort = {
      async resolve() {
        return {
          status: "unlinked",
          reason: "binding-not-found",
        };
      },
    };
    const router: DeterministicChannelRouterPort = {
      async resolve() {
        routed = true;
        throw new Error("must not route");
      },
    };

    await expect(
      createProofResolvedChannelRouter({ identities, router }).resolve({
        tenantId: f.tenantId,
        channelAccountId: f.channelAccountId,
        channel: "telegram",
        externalSubjectId: "tg:123456789",
        observedAt: toInstant("2026-10-06T16:01:00.000Z"),
      }),
    ).rejects.toThrow("not proof-linked");

    expect(routed).toBe(false);
  });

  it("rejects a resolver that substitutes Tenant or channel subject scope", async () => {
    const f = fixture();
    let routed = false;
    const identities: ChannelIdentityResolverPort = {
      async resolve() {
        return {
          status: "resolved",
          identity: {
            tenantId: createCanonicalId("tenant"),
            channelAccountId: f.channelAccountId,
            channel: "whatsapp",
            userId: f.userId,
            externalSubjectId: "wa:+2348012345678",
            bindingRevision: 2,
            proof: {
              purpose: "account-link",
              method: "channel-possession-challenge",
              evidenceRef: "channel-link:request-foreign",
              verifiedAt: toInstant("2026-10-06T16:00:00.000Z"),
            },
          },
        };
      },
    };
    const router: DeterministicChannelRouterPort = {
      async resolve() {
        routed = true;
        throw new Error("must not route");
      },
    };

    await expect(
      createProofResolvedChannelRouter({ identities, router }).resolve({
        tenantId: f.tenantId,
        channelAccountId: f.channelAccountId,
        channel: "whatsapp",
        externalSubjectId: "wa:+2348012345678",
        observedAt: toInstant("2026-10-06T16:01:00.000Z"),
      }),
    ).rejects.toThrow("does not match routing request");

    expect(routed).toBe(false);
  });

  it("rejects a deterministic router that changes the resolved User scope", async () => {
    const f = fixture();
    const identities: ChannelIdentityResolverPort = {
      async resolve() {
        return {
          status: "resolved",
          identity: {
            tenantId: f.tenantId,
            channelAccountId: f.channelAccountId,
            channel: "telegram",
            userId: f.userId,
            externalSubjectId: "tg:123456789",
            bindingRevision: 2,
            proof: {
              purpose: "account-link",
              method: "authenticated-cross-channel-confirmation",
              evidenceRef: "channel-link:cross-channel",
              verifiedAt: toInstant("2026-10-06T16:00:00.000Z"),
            },
          },
        };
      },
    };
    const router: DeterministicChannelRouterPort = {
      async resolve(input) {
        return {
          tenantId: input.tenantId,
          userId: createCanonicalId("user"),
          characterId: f.characterId,
          relationshipId: f.relationshipId,
          source: "user-preference",
        };
      },
    };

    await expect(
      createProofResolvedChannelRouter({ identities, router }).resolve({
        tenantId: f.tenantId,
        channelAccountId: f.channelAccountId,
        channel: "telegram",
        externalSubjectId: "tg:123456789",
        observedAt: toInstant("2026-10-06T16:01:00.000Z"),
      }),
    ).rejects.toThrow("changed resolved identity scope");
  });
});
