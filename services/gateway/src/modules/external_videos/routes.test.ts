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
    const reopen = await app.inject({method:"PATCH",url:`/v1/admin/video-items/${id}/review`,
      headers:{"x-test-staff":"yes"},payload:{state:"pending",expectedState:"hidden",verificationReference:null}});
    expect(reopen.statusCode).toBe(200);
    expect(reopen.json().reviewState).toBe("pending");
    expect((await app.inject({method:"GET",url:"/v1/videos"})).json().items).toEqual([]);
    const stale = await app.inject({method:"PATCH",url:`/v1/admin/video-items/${id}/review`,
      headers:{"x-test-staff":"yes"},payload:{state:"pending",expectedState:"hidden",verificationReference:null}});
    expect(stale.statusCode).toBe(409);
    await app.close();
  });
  it("pages all staff review states without leaking them to fans or looping on the cursor", async () => {
    const app = Fastify();
    const saved: ExternalVideo[] = Array.from({length: 23}, (_, i) => ({
      id: "00000000-0000-4000-a000-" + String(i + 1).padStart(12, "0"),
      tenantId: "tenant-1", provider: "youtube" as const,
      providerVideoId: String(i + 1), sourceUrl: "https://youtu.be/abcDE12_-34",
      title: "Lesson " + i, channelName: "Teacher", reviewState: "pending" as const,
      verifiedAt: null, createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString(),
    })).reverse();
    registerExternalVideoRoutes(app, {
      resolvePrincipal: async (request) => ({
        tenantId: "tenant-1", actorId: "staff-id",
        staffRoles: request.headers["x-test-staff"] === "yes" ? ["content_editor"] : [],
      }),
      store: {
        async submit(video) { return video; },
        async review() { return null; },
        async list(input) {
          const visible = saved.filter(v => !input.publicOnly || v.reviewState === "approved");
          const start = input.before ? visible.findIndex(v => v.id === input.before) + 1 : 0;
          if (input.before && start === 0) return [];
          return visible.slice(start, start + input.limit);
        },
      },
    });
    const first = await app.inject({method: "GET", url: "/v1/admin/video-items", headers: {"x-test-staff":"yes"}});
    expect(first.statusCode).toBe(200);
    expect(first.json().items).toHaveLength(20);
    const cursor = first.json().nextCursor as string;
    expect(cursor).toBe(saved[19]?.id);
    const next = await app.inject({method: "GET", url: "/v1/admin/video-items?before=" + cursor, headers: {"x-test-staff":"yes"}});
    expect(next.statusCode).toBe(200);
    expect(next.json().items).toHaveLength(3);
    expect(next.json().nextCursor).toBeNull();
    const allIds = [...first.json().items, ...next.json().items].map((x: ExternalVideo) => x.id);
    expect(new Set(allIds).size).toBe(23);
    expect((await app.inject({method: "GET", url: "/v1/videos"})).json().items).toEqual([]);
    expect((await app.inject({method: "GET", url: "/v1/admin/video-items"})).statusCode).toBe(403);
    expect((await app.inject({method: "GET", url: "/v1/admin/video-items?before=bad", headers: {"x-test-staff":"yes"}})).statusCode).toBe(400);
    await app.close();
  });
});
