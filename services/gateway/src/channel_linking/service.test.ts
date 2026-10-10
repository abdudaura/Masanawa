import { describe, expect, it, vi } from "vitest";
import { createLinkingService, LinkError, parseLinkChannel, type LinkIdentity, type LinkRepository, type LinkState } from "./service.js";

const alice = { tenantId: "tenant-A", userId: "user-A" };
const bob = { tenantId: "tenant-A", userId: "user-B" };
function fixture() {
  let challenge: { hash: string; owner: LinkIdentity; expiresAt: Date; channel: string } | null = null;
  let bound: { owner: LinkIdentity; sender: string; channel: string } | null = null;
  let preferred = false;
  const repository: LinkRepository = {
    async list(owner) {
      const linked = bound?.owner.userId === owner.userId;
      return [{
        channel: "whatsapp", linked: !!linked, preferred: linked && preferred,
        linkedAt: null, pendingUntil: null,
      }] as readonly LinkState[];
    },
    async begin({ owner, codeHash, expiresAt, channel }) {
      challenge = { hash: codeHash, owner, expiresAt, channel };
    },
    async resolveChallengeOwner(channel, hash, at) {
      return challenge && challenge.channel === channel && challenge.hash === hash &&
        challenge.expiresAt > at ? challenge.owner : null;
    },
    async confirm({ channel, codeHash, externalUserId }) {
      if (!challenge || challenge.hash !== codeHash || challenge.channel !== channel) return false;
      if (bound && bound.sender === externalUserId && bound.owner.userId !== challenge.owner.userId)
        throw new LinkError("LINK_CONFLICT", 409);
      bound = { owner: challenge.owner, sender: externalUserId, channel };
      challenge = null;
      return true;
    },
    async unlink(owner, channel) {
      if (bound?.owner.userId === owner.userId && bound.channel === channel) bound = null;
      challenge = null;
      preferred = false;
    },
    async setPreferred(owner, channel) {
      if (bound?.owner.userId !== owner.userId || bound.channel !== channel)
        throw new LinkError("LINK_NOT_FOUND", 409);
      preferred = true;
    },
  };
  return {
    repository,
    peek: () => ({ challenge, bound }),
  };
}
const sender = (text: string) => ({
  channel: "whatsapp" as const, externalUserId: "+2347000000100",
  chatId: "2347000000100", messageId: "provider-msg-1", text,
});

describe("U26 provider-verified channel links", () => {
  it("never accepts unknown channels or unapproved destinations", async () => {
    expect(() => parseLinkChannel("human-dm")).toThrow();
    const service = createLinkingService({
      repository: fixture().repository,
      destinations: { whatsapp: "https://evil.invalid/claim" },
      resolveDefaultCharacter: async () => "character-one",
    });
    await expect(service.begin(alice, "whatsapp")).rejects.toMatchObject({
      code: "CHANNEL_UNAVAILABLE", status: 503,
    });
  });

  it("issues a high-entropy code, stores only a digest and expires it", async () => {
    const store = fixture();
    let now = new Date("2026-10-08T17:00:00Z");
    const service = createLinkingService({
      repository: store.repository,
      destinations: { whatsapp: "https://wa.me/2347000000100" },
      resolveDefaultCharacter: async () => "character-one",
      now: () => now,
    });
    const proof = await service.begin(alice, "whatsapp");
    expect(proof.code).toMatch(/^MN-[0-9A-F]{24}$/u);
    expect(proof.destination).toBe("https://wa.me/2347000000100");
    expect(store.peek().challenge?.hash).not.toContain(proof.code);
    expect(store.peek().challenge?.hash).toHaveLength(64);
    now = new Date("2026-10-08T17:06:00Z");
    expect(await service.consumeVerifiedInbound(sender(proof.code))).toBe(false);
  });

  it("only links a code sent from verified provider ingress; does not replay or cross accounts", async () => {
    const store = fixture();
    const resolveDefaultCharacter = vi.fn(async (owner: LinkIdentity) =>
      owner.userId === alice.userId ? "character-one" : "character-two");
    const service = createLinkingService({
      repository: store.repository,
      destinations: { whatsapp: "https://wa.me/2347000000100" },
      resolveDefaultCharacter,
    });
    const proof = await service.begin(alice, "whatsapp");
    expect(await service.consumeVerifiedInbound(sender("hello Gwani"))).toBe(false);
    expect(await service.consumeVerifiedInbound(sender("MN-000000000000000000000000"))).toBe(false);
    expect(await service.consumeVerifiedInbound(sender(proof.code))).toBe(true);
    expect(await service.consumeVerifiedInbound(sender(proof.code))).toBe(false);
    expect(resolveDefaultCharacter).toHaveBeenCalledTimes(1);
    expect(store.peek().bound?.owner).toEqual(alice);
    await expect(service.prefer(bob, "whatsapp")).rejects.toMatchObject({
      code: "LINK_NOT_FOUND",
    });
    await service.prefer(alice, "whatsapp");
    expect((await service.status(alice))[0]?.preferred).toBe(true);
    expect((await service.status(bob))[0]?.linked).toBe(false);
    await service.unlink(bob, "whatsapp");
    expect((await service.status(alice))[0]?.linked).toBe(true);
    await service.unlink(alice, "whatsapp");
    expect((await service.status(alice))[0]?.linked).toBe(false);
  });

  it("rejects hostile provider IDs and never resolves an assistant for them", async () => {
    const defaultAgent = vi.fn(async () => "character-one");
    const store = fixture();
    const service = createLinkingService({
      repository: store.repository,
      destinations: { telegram: "https://t.me/MasanawaBot" },
      resolveDefaultCharacter: defaultAgent,
    });
    const proof = await service.begin(bob, "telegram");
    expect(await service.consumeVerifiedInbound({
      channel: "telegram", externalUserId: "2;DROP TABLE", chatId: "2",
      messageId: "12", text: proof.code,
    })).toBe(false);
    expect(defaultAgent).not.toHaveBeenCalled();
  });
});
