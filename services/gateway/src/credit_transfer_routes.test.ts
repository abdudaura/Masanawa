import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { CreditTransferService } from "./credit_transfer.js";
import type { GiftService } from "./gifts.js";
import {
  registerCreditTransferRoutes,
  registerGiftRoutes,
} from "./credit_transfer_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Credit transfer and gift routes", () => {
  it("forwards only transfer intent to the service", async () => {
    let seenRecipient = "";
    const transfer: CreditTransferService = {
      async transfer(input) {
        seenRecipient = input.recipient;
        return {
          transferId: "transfer-1",
          recipientUserId: "user-b",
          amountCredits: input.amountCredits,
          status: "completed",
          commissionEligible: false,
          completedAt: "2026-10-05T09:30:00Z",
        };
      },
    };
    const app = Fastify();
    apps.push(app);
    registerCreditTransferRoutes(app, transfer);

    const response = await app.inject({
      method: "POST",
      url: "/v1/wallet/transfers",
      payload: {
        requestId: "request-transfer-001",
        recipient: "@friend",
        amountCredits: 25,
        senderUserId: "malicious-client-value",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(seenRecipient).toBe("@friend");
    expect(response.json().commissionEligible).toBe(false);
  });

  it("takes gift destination from the twin route, not a client-selected owner id", async () => {
    let seenCharacter = "";
    const gift: GiftService = {
      async gift(input) {
        seenCharacter = input.characterId;
        return {
          giftId: "gift-1",
          recipientUserId: "user-owner",
          characterId: input.characterId,
          amountCredits: input.amountCredits,
          status: "completed",
          acquisitionCommissionEligible: false,
          completedAt: "2026-10-05T09:31:00Z",
        };
      },
    };
    const app = Fastify();
    apps.push(app);
    registerGiftRoutes(app, gift);

    const response = await app.inject({
      method: "POST",
      url: "/v1/twins/character-owner/gifts",
      payload: {
        requestId: "request-gift-001",
        amountCredits: 50,
        recipientUserId: "malicious-client-value",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(seenCharacter).toBe("character-owner");
    expect(response.json().acquisitionCommissionEligible).toBe(false);
  });
});
