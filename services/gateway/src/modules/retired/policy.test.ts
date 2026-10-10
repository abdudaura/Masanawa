import { describe, expect, it } from "vitest";
import { isRetiredLegacyRequest } from "./policy.js";
import { createGatewayApp } from "../../app.js";

describe("R0 legacy route freeze", () => {
  it.each([
    ["GET", "/talks"],
    ["GET", "/agent/twins"],
    ["GET", "/creator/onboarding"],
    ["POST", "/creator/onboarding/confirm"],
    ["POST", "/whatsapp/webhook"],
    ["POST", "/telegram/webhook"],
    ["POST", "/v1/channels/telegram"],
    ["GET", "/v1/admin/commission-policy"],
    ["GET", "/v1/admin/linked-whatsapp"],
    ["POST", "/talks/new"],
    ["GET", "/talks/abc/live/media-token"],
    ["POST", "/v1/twins/abc/gifts"],
    ["POST", "/v1/creator/clones"],
    ["GET", "/v1/twin/owner-access/offering"],
    ["POST", "/admin/channels/whatsapp/reset"],
    ["POST", "/v1/customer-channels/link"],
    ["POST", "/v1/contacts/invite"],
    ["POST", "/v1/dms/abc/messages"],
    ["POST", "/v1/audio-posts"],
    ["POST", "/v1/rooms"],
    ["POST", "/v1/posts"],
    ["POST", "/v1/wallet/transfers"],
    ["POST", "/v1/wallet/gifts"],
    ["GET", "/talks%2Fabc%2Fpolls"],
  ])("retires legacy %s %s", (method, path) => {
    expect(isRetiredLegacyRequest(method, path)).toBe(true);
  });

  it.each([
    ["GET", "/healthz"],
    ["GET", "/v1/masana"],
    ["GET", "/v1/masana/a/social-links"],
    ["GET", "/v1/wallet/msn/quotes"],
    ["POST", "/v1/crypto/conversions/orders"],
    ["POST", "/v1/crypto/withdrawals/orders"],
    ["GET", "/v1/p2p/offers"],
    ["POST", "/v1/p2p/orders/id/mark-paid"],
    ["GET", "/v1/masana/a"],
    ["POST", "/v1/masana/a/follow"],
    ["POST", "/v1/chats/masana-id/messages"],
    ["POST", "/v1/rooms/a/questions"],
    ["POST", "/v1/rooms/a/join"],
    ["GET", "/v1/posts"],
    ["GET", "/v1/audio-posts"],
    ["GET", "/v1/wallet/transfers"],
    ["GET", "/v1/commerce/bills/quotes"],
    ["POST", "/v1/commerce/bills/quote"],
    ["GET", "/v1/financial/crypto/routes"],
    ["POST", "/v1/admin/masana/a/social-accounts"],
    ["POST", "/v1/gwani/messages"],
    ["POST", "/v1/p2p/orders"],
  ])("preserves canonical %s %s for its own authorization", (method, path) => {
    expect(isRetiredLegacyRequest(method, path)).toBe(false);
  });

  it("returns stable 410 before invoking an existing handler, but preserves health", async () => {
    const app = createGatewayApp();
    let invoked = false;
    app.get("/talks/r0-test", async () => {
      invoked = true;
      return { active: true };
    });
    try {
      const retired = await app.inject({ method: "GET", url: "/talks/r0-test" });
      expect(retired.statusCode).toBe(410);
      expect(retired.json()).toEqual({
        error: { code: "feature_retired", message: "This feature is no longer available" },
      });
      expect(invoked).toBe(false);
      const health = await app.inject({ method: "GET", url: "/healthz" });
      expect(health.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
