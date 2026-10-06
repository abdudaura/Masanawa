import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerProviderValuationAdminRoutes } from "./provider_valuation_admin_routes.js";

describe("provider valuation admin routes", () => {
  it("keeps an unconfigured valuation explicitly null", async () => {
    const app = Fastify();
    registerProviderValuationAdminRoutes(app, {
      async read(input) {
        expect(input.valuationKey).toBe("flutterwave:NGN:kobo");
        expect(input.eventType).toBe("external-funding");
        return null;
      },
      async update() {
        throw new Error("not used");
      },
    });

    const response = await app.inject({
      method: "GET",
      url:
        "/v1/admin/monetization/valuation" +
        "?valuationKey=flutterwave%3ANGN%3Akobo" +
        "&eventType=external-funding",
      headers: { authorization: "Bearer admin" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
    await app.close();
  });

  it("passes an explicit rational mapping to the admin service", async () => {
    const app = Fastify();
    registerProviderValuationAdminRoutes(app, {
      async read() {
        return null;
      },
      async update(input) {
        expect(input).toMatchObject({
          valuationKey: "flutterwave:NGN:kobo",
          eventType: "external-funding",
          enabled: false,
          sourceUnit: "NGN_KOBO",
          sourceUnitsPerStep: 1000,
          creditUnitsPerStep: 1,
          minimumSourceUnits: 1000,
          maximumBaseCredits: 500,
        });
        return {
          valuationKey: input.valuationKey,
          eventType: input.eventType,
          revision: 1,
          enabled: input.enabled,
          sourceUnit: input.sourceUnit,
          sourceUnitsPerStep: input.sourceUnitsPerStep,
          creditUnitsPerStep: input.creditUnitsPerStep,
          minimumSourceUnits: input.minimumSourceUnits,
          maximumBaseCredits: input.maximumBaseCredits,
          effectiveAt: input.effectiveAt,
        };
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/admin/monetization/valuation",
      headers: { authorization: "Bearer admin" },
      payload: {
        valuationKey: "flutterwave:NGN:kobo",
        eventType: "external-funding",
        enabled: false,
        sourceUnit: "NGN_KOBO",
        sourceUnitsPerStep: 1000,
        creditUnitsPerStep: 1,
        minimumSourceUnits: 1000,
        maximumBaseCredits: 500,
        effectiveAt: "2026-10-06T00:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      revision: 1,
      enabled: false,
      valuationKey: "flutterwave:NGN:kobo",
    });
    await app.close();
  });
});
