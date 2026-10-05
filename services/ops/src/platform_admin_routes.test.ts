import { afterEach, describe, expect, it } from "vitest";
import type { PlatformAdminService } from "./platform_admin.js";
import { createOpsApp } from "./app.js";

const apps: Array<ReturnType<typeof createOpsApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Ops platform admin routes", () => {
  it("forwards bounded user filters without losing authorization", async () => {
    const calls: unknown[] = [];
    const service = {
      async listUsers(input: unknown) {
        calls.push(input);
        return [];
      },
    } as unknown as PlatformAdminService;
    const app = createOpsApp({ platformAdmin: service });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/users?state=disabled&limit=25",
      headers: { authorization: "Bearer operator" },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      authorizationHeader: "Bearer operator",
      state: "disabled",
      limit: 25,
    }]);
  });

  it("rejects out-of-bounds admin list limits before service execution", async () => {
    let calls = 0;
    const service = {
      async listUsers() {
        calls += 1;
        return [];
      },
    } as unknown as PlatformAdminService;
    const app = createOpsApp({ platformAdmin: service });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/users?limit=501",
      headers: { authorization: "Bearer operator" },
    });

    expect(response.statusCode).toBe(400);
    expect(calls).toBe(0);
  });

  it("forwards canonical User relationship drill-downs", async () => {
    const calls: unknown[] = [];
    const service = {
      async listUserRelationships(input: unknown) {
        calls.push(input);
        return [];
      },
    } as unknown as PlatformAdminService;
    const app = createOpsApp({ platformAdmin: service });
    apps.push(app);
    const userId = "user_00000000-0000-4000-8000-000000000012";

    const response = await app.inject({
      method: "GET",
      url: `/v1/admin/users/${userId}/relationships`,
      headers: { authorization: "Bearer operator" },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      authorizationHeader: "Bearer operator",
      userId,
    }]);
  });

  it("forwards canonical Offer creation payloads", async () => {
    const calls: unknown[] = [];
    const service = {
      async saveOfferRevision(input: unknown) {
        calls.push(input);
        return {};
      },
    } as unknown as PlatformAdminService;
    const app = createOpsApp({ platformAdmin: service });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: { authorization: "Bearer operator" },
      payload: {
        key: "airtime.ng",
        title: "Airtime",
        description: "Buy airtime",
        skillVersionId:
          "skill-version_00000000-0000-4000-8000-000000000011",
        priceCredits: 100,
        fulfillmentReserveCredits: 70,
        creatorCommissionCredits: 20,
        fallbackCommissionCredits: 10,
        platformMarginCredits: 10,
        regions: ["NG"],
        enabled: true,
        expectedRevision: null,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      authorizationHeader: "Bearer operator",
      offerId: null,
      expectedRevision: null,
      key: "airtime.ng",
      title: "Airtime",
      description: "Buy airtime",
      skillVersionId:
        "skill-version_00000000-0000-4000-8000-000000000011",
      priceCredits: 100,
      fulfillmentReserveCredits: 70,
      creatorCommissionCredits: 20,
      fallbackCommissionCredits: 10,
      platformMarginCredits: 10,
      regions: ["NG"],
      enabled: true,
    }]);
  });

  it("forwards canonical Operation receipt drill-downs", async () => {
    const calls: unknown[] = [];
    const service = {
      async listOperationReceipts(input: unknown) {
        calls.push(input);
        return [];
      },
    } as unknown as PlatformAdminService;
    const app = createOpsApp({ platformAdmin: service });
    apps.push(app);
    const operationId =
      "operation_00000000-0000-4000-8000-000000000009";

    const response = await app.inject({
      method: "GET",
      url: `/v1/admin/operations/${operationId}/receipts`,
      headers: { authorization: "Bearer operator" },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      authorizationHeader: "Bearer operator",
      operationId,
    }]);
  });
});
