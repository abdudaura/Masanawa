import { describe, expect, it } from "vitest";
import type { PlatformSessionRepository } from "@masanawa/security";
import { createPlatformCreditRecipientResolver } from "./credit_transfer_recipient.js";

function repository(resolve: PlatformSessionRepository["resolveProfile"]) {
  return {
    resolveProfile: resolve,
  } as unknown as PlatformSessionRepository;
}

describe("platform Credit recipient resolver", () => {
  it("resolves a normalized email through the canonical auth profile store", async () => {
    let seen = "";
    const resolver = createPlatformCreditRecipientResolver({
      sessions: repository(async (input) => {
        seen = `${input.channel}:${input.identifier}`;
        return {
          tenantId: input.tenantId,
          userId: "user_b" as never,
          name: "B",
          email: input.identifier,
          phone: null,
          locale: "en",
          createdAt: "2026-10-05T09:00:00Z",
        };
      }),
      now: () => "2026-10-05T10:00:00Z",
    });

    const result = await resolver.resolve({
      tenantId: "tenant_a",
      senderUserId: "user_a",
      recipient: " Friend@Example.COM ",
    });

    expect(seen).toBe("email:friend@example.com");
    expect(result.recipientUserId).toBe("user_b");
  });

  it("normalizes E.164-compatible phone input", async () => {
    let seen = "";
    const resolver = createPlatformCreditRecipientResolver({
      sessions: repository(async (input) => {
        seen = input.identifier;
        return {
          tenantId: input.tenantId,
          userId: "user_b" as never,
          name: "B",
          email: null,
          phone: input.identifier,
          locale: "en",
          createdAt: "2026-10-05T09:00:00Z",
        };
      }),
    });

    await resolver.resolve({
      tenantId: "tenant_a",
      senderUserId: "user_a",
      recipient: "+234 (801) 234-5678",
    });

    expect(seen).toBe("+2348012345678");
  });

  it("fails when the recipient has no Masanawa profile", async () => {
    const resolver = createPlatformCreditRecipientResolver({
      sessions: repository(async () => null),
    });

    await expect(
      resolver.resolve({
        tenantId: "tenant_a",
        senderUserId: "user_a",
        recipient: "nobody@example.com",
      }),
    ).rejects.toThrow("does not have a Masanawa account");
  });
});
