import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerExternalVideoRoutes } from "./routes.js";
import type { ExternalVideo } from "./contract.js";

describe("J15 video HTTP authorization boundary", () => {
  it("rejects fan curation, keeps pending private and publishes only approved", async () => {
    const app = Fastify();
    const saved: ExternalVideo[] = [];
    registerExternalVideoRoutes(app, {
      // Test double only: production must use canonical verified session/RBAC authority.
      resolvePrincipal: async (request) => ({
        tenantId: "tenant-1", actorId: "actor-1",
        staffRoles: request.headers["x-test-staff"] === "yes" ? ["content_editor"] : [],
      }),
      store: {
        async submit(video) { saved.push(video); return video; },
        async review(input) {
          const index = saved.findIndex(v => v.tenantId === input.tenantId && v.id === input.id && v.reviewState === input.expectedState);
          if (index < 0) return null;
          const changed = {...saved[index]!, reviewState: input.state,
            verifiedAt: input.verificationReference ? new Date().toISOString() : null};
          saved[index] = changed;
          return changed;
        },
        async list(input) {
          return saved.filter(v => v.tenantId === input.tenantId &&
            (!input.publicOnly || v.reviewState === "approved")).slice(0, input.limit);
        },
      },
    });
    const item = { url: "https://youtu.be/abcDE12_-34", title: "Maths", channelName: "Teacher" };
    const denied = await app.inject({method:"POST",url:"/v1/admin/video-items",payload:item});
    expect(denied.statusCode).toBe(403);
    const accepted = await app.inject({method:"POST",url:"/v1/admin/video-items",headers:{"x-test-staff":"yes"},payload:item});
    expect(accepted.statusCode).toBe(201);
    const id = accepted.json().id as string;
    expect((await app.inject({method:"GET",url:"/v1/videos"})).json().items).toEqual([]);
    const unverified = await app.inject({method:"PATCH",url:`/v1/admin/video-items/${id}/review`,
      headers:{"x-test-staff":"yes"}, payload:{state:"approved",verificationReference:null}});
    expect(unverified.statusCode).toBe(400);
    const approved = await app.inject({method:"PATCH",url:`/v1/admin/video-items/${id}/review`,
      headers:{"x-test-staff":"yes"}, payload:{state:"approved",verificationReference:"verified-provider-player-123"}});
    expect(approved.statusCode).toBe(200);
    expect((await app.inject({method:"GET",url:"/v1/videos"})).json().items).toHaveLength(1);
    const hidden = await app.inject({method:"PATCH",url:`/v1/admin/video-items/${id}/review`,
      headers:{"x-test-staff":"yes"}, payload:{state:"hidden",verificationReference:null}});
    expect(hidden.statusCode).toBe(200);
    expect((await app.inject({method:"GET",url:"/v1/videos"})).json().items).toEqual([]);
    await app.close();
  });
});
