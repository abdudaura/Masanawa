import { describe, expect, it } from "vitest";
import { createGatewayApp } from "../app.js";
import { createHumanContactService } from "./service.js";
import type { HumanContactRepository } from "./model.js";

/** Proves contact routes are actually installed in the canonical Gateway factory. */
describe("C01 composed Gateway human-contact routes", () => {
  it("keeps the API unavailable without a configured real contact authority", async () => {
    const app = createGatewayApp();
    const response = await app.inject({
      method: "GET", url: "/messages/contacts/preferences",
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("admits only the canonical authenticated owner and returns privacy-safe errors", async () => {
    const repo: HumanContactRepository = {
      async lookup({ handle }) {
        if (handle !== "bob") return null;
        return { userId: "user_bo", handle: "bob", displayName: "Bob", avatarUrl: null, canMessage: false, status: "none", requestRevision: null };
      },
      async getOwnPreferences() { return { policy: "requests", discoverableByHandle: true }; },
      async setOwnPreferences({ policy, discoverableByHandle }) {
        return { policy: policy ?? "requests", discoverableByHandle: discoverableByHandle ?? true };
      },
      async request() { return "pending"; },
      async respond() { return false; },
      async list() { return []; },
      async revoke() { return false; },
    };
    const service = createHumanContactService({
      repository: repo,
      authorizer: {
        async authorize({ authorizationHeader }) {
          if (authorizationHeader !== "Bearer valid") {
            throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
          }
          return { tenantId: "tenant_1", userId: "user_al" } as never;
        },
      },
    });
    const app = createGatewayApp({ humanContacts: service });
    const hidden = await app.inject({
      method: "GET", url: "/messages/contacts/lookup/unknown",
      headers: { authorization: "Bearer valid" },
    });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.json()).toMatchObject({
      error: { code: "messages.contact_unavailable", message: "Contact unavailable" },
    });

    const unauthenticated = await app.inject({
      method: "GET", url: "/messages/contacts/preferences",
    });
    expect(unauthenticated.statusCode).toBe(401);

    const own = await app.inject({
      method: "GET", url: "/messages/contacts/preferences",
      headers: { authorization: "Bearer valid" },
    });
    expect(own.statusCode).toBe(200);
    expect(own.json()).toEqual({ policy: "requests", discoverableByHandle: true });
    await app.close();
  });
});
