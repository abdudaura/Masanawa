import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerExternalVideoDomain } from "./feature.js";
import type { ExternalVideo } from "./contract.js";

const sample: ExternalVideo = {
  id: "00000000-0000-4000-a000-000000000001",
  tenantId: "tenant-a",
  provider: "youtube",
  providerVideoId: "abcDE12_-34",
  sourceUrl: "https://www.youtube.com/watch?v=abcDE12_-34",
  title: "Algebra", channelName: "Original educator",
  reviewState: "approved", verifiedAt: "2026-10-10T00:00:00Z",
  createdAt: "2026-10-10T00:00:00Z",
};

describe("J14/J15 single external-video registration boundary", () => {
  it("mounts public, staff and provider endpoints together; pause refuses all without touching stores", async () => {
    const app = Fastify();
    const listed = vi.fn(async () => [sample]);
    const sources = vi.fn(async () => []);
    const findWebhook = vi.fn(async () => null);
    let enabled = false;
    await registerExternalVideoDomain(app, {
      enabled: () => enabled,
      resolvePrincipal: async () => ({ tenantId: "tenant-a", actorId: "fan-a", staffRoles: [] }),
      videoStore: { list: listed, submit: async (video) => video, review: async () => null },
      sourceStore: { list: sources, create: async () => { throw Error("not used"); }, pause: async () => false },
      webhookStore: { findByCallbackToken: findWebhook, confirmVerifiedLease: async () => false,
        enqueueReconciliation: async () => false },
    });
    for (const options of [
      { method: "GET" as const, url: "/v1/videos" },
      { method: "GET" as const, url: "/v1/admin/video-sources" },
      { method: "POST" as const, url: "/v1/webhooks/youtube/" + "a".repeat(32), payload: "test",
        headers: { "content-type": "application/atom+xml" } },
    ]) {
      const result = await app.inject(options);
      expect(result.statusCode).toBe(503);
      expect(result.json()).toEqual({ code: "video_feature_disabled" });
    }
    expect(listed).not.toHaveBeenCalled();
    expect(sources).not.toHaveBeenCalled();
    expect(findWebhook).not.toHaveBeenCalled();
    enabled = true;
    const publicFeed = await app.inject({method: "GET", url: "/v1/videos"});
    expect(publicFeed.statusCode).toBe(200);
    expect(publicFeed.json().items[0]?.id).toBe(sample.id);
    // No client-supplied staff header can elevate the canonical resolver.
    const admin = await app.inject({method:"GET", url:"/v1/admin/video-sources",
      headers: {"x-role":"super_admin"}});
    expect(admin.statusCode).toBe(403);
    expect(sources).not.toHaveBeenCalled();
    const invalidHub = await app.inject({ method:"POST", url:"/v1/webhooks/youtube/"+"a".repeat(32),
      payload:"<feed>hello</feed>", headers:{"content-type":"application/atom+xml"} });
    expect(invalidHub.statusCode).toBe(404);
    await app.close();
  });
});
