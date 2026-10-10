import { describe, expect, it } from "vitest";
import { isRetiredLegacySurface } from "./retired_surface.js";

describe("R0 retired product boundary", () => {
  it.each([
    "/talks",
    "/talks/talk_123/seat",
    "/v1/talks",
    "/v1/twins",
    "/agent/twins",
    "/creator/onboarding/confirm",
    "/v1/owner-access",
    "/v1/human-dm/messages",
    "/contacts",
    "/v1/wallet/transfers",
    "/v1/twins/a/gifts",
    "/v1/admin/commission-policy",
    "/v1/admin/linked-whatsapp",
    "/v1/channels/telegram",
    "/whatsapp/webhook",
    "/telegram/webhook",
  ])("retires old source endpoint %s", path => {
    expect(isRetiredLegacySurface(path)).toBe(true);
    expect(isRetiredLegacySurface(path + "?owner=administrator")).toBe(true);
  });

  it.each([
    "/healthz",
    "/readyz",
    "/auth/capabilities",
    "/v1/masana/m_gwani",
    "/v1/masana/m_gwani/social-links",
    "/v1/admin/masana/m_gwani/social-accounts",
    "/v1/feed",
    "/v1/rooms",
    "/v1/crypto/conversions/quotes",
    "/v1/crypto/withdrawals/orders",
    "/v1/wallet/msn/quotes",
    "/v1/p2p/offers",
    "/v1/p2p/orders/order_1/mark-paid",
    "/v1/commerce/bills/quotes",
    "/v1/wallet/activity",
    "/v1/financial/crypto/routes",
  ])("does not retire target surface %s", path => {
    expect(isRetiredLegacySurface(path)).toBe(false);
  });

  it("honors route boundaries, not permissive substring search", () => {
    expect(isRetiredLegacySurface("/talkshows")).toBe(false);
    expect(isRetiredLegacySurface("/v1/creator-studio")).toBe(false);
    expect(isRetiredLegacySurface("/v1/masana/twins-specialist")).toBe(false);
  });
});
