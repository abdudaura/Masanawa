import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { PaidVoiceService } from "./paid_voice.js";
import { registerPaidVoiceRoutes } from "./paid_voice_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("paid voice routes", () => {
  it("passes quote request through without minting a live token", async () => {
    let seen = false;
    const service: PaidVoiceService = {
      async quote(input) {
        seen = input.expectedSeconds === 300;
        return {
          quoteId: "voice-quote-123",
          characterId: input.characterId as never,
          policyRevision: 1,
          trialPolicyRevision: 1,
          chargeMode: "trial",
          trialDurationDays: 7,
          trialStartsAt: "2026-10-05T09:00:00Z",
          trialExpiresAt: "2026-10-12T09:00:00Z",
          estimatedSeconds: 300,
          estimatedPriceCredits: 0,
          spendCapCredits: 0,
          ownerShareBasisPoints: 2000,
          quoteExpiresAt: "2026-10-05T09:05:00Z",
        };
      },
      async start() {
        throw new Error("not used");
      },
    };
    const app = Fastify();
    apps.push(app);
    registerPaidVoiceRoutes(app, service);
    const response = await app.inject({
      method: "POST",
      url: "/agent/twin/voice/quote",
      payload: {
        characterId: "character_00000000-0000-4000-8000-000000000003",
        expectedSeconds: 300,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(seen).toBe(true);
    expect(response.json().trialDurationDays).toBe(7);
  });
});
