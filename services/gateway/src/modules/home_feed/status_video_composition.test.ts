import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayApp } from "../../app.js";
import { VideoAdmissionError, type VideoStore } from "../external_videos/service.js";

const video = {
  id: "ca275ec3-1811-4d2e-b8d2-f0219639777a",
  tenantId: "tenant_a", provider: "youtube" as const,
  providerVideoId: "abcdefgh123",
  sourceUrl: "https://www.youtube.com/watch?v=abcdefgh123",
  title: "Approved lesson", channelName: "Masana Tutor",
  reviewState: "approved" as const,
  verifiedAt: "2026-10-13T00:00:00Z",
  createdAt: "2026-10-13T00:00:00Z",
};
const apps: ReturnType<typeof createGatewayApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe("authenticated Status and official Video Gateway registration", () => {
  it("serves only approved videos from the authoritative store; fan cannot review", async () => {
    const list = vi.fn(async () => [video]);
    const store = {
      list,
      isApproved: async ({tenantId,id}:{tenantId:string;id:string}) => tenantId === "tenant_a" && id === video.id,
    } as unknown as VideoStore;
    const app = createGatewayApp({ videos: {
      store,
      resolvePrincipal: async request => {
        if (request.headers.authorization !== "Bearer permitted") {
          throw new VideoAdmissionError(401, "authentication_required", "Sign in");
        }
        return {tenantId:"tenant_a",actorId:"fan_a",staffRoles:[]};
      },
    }});
    apps.push(app);
    await app.ready();
    expect((await app.inject({url:"/v1/videos"})).statusCode).toBe(401);
    const response = await app.inject({url:"/v1/videos",headers:{authorization:"Bearer permitted"}});
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({tenantId:"tenant_a",publicOnly:true}));
    const availability = await app.inject({
      url:"/v1/videos/" + video.id + "/availability",
      headers:{authorization:"Bearer permitted"},
    });
    expect(availability.json()).toEqual({available:true});
    const denied = await app.inject({
      method:"POST",url:"/v1/admin/video-items",
      headers:{authorization:"Bearer permitted"},
      payload:{title:"Forgery",channelName:"Other",url:video.sourceUrl},
    });
    expect(denied.statusCode).toBe(403);
  });
  it("binds Status to the authenticated tenant and user", async () => {
    const list = vi.fn(async () => ({items:[],nextCursor:null}));
    const app = createGatewayApp({status:{
      sessions:{authorize:async ({authorizationHeader}) => {
        if (authorizationHeader !== "Bearer permitted") {
          throw Object.assign(new Error("authentication_required"),{status:401,code:"authentication_required"});
        }
        return {tenantId:"tenant_a",userId:"fan_a"};
      }},
      feed:{list} as never,
      editorial:{} as never,
    }});
    apps.push(app);
    await app.ready();
    expect((await app.inject({url:"/v1/feed"})).statusCode).toBe(401);
    const response = await app.inject({url:"/v1/feed",headers:{authorization:"Bearer permitted"}});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({items:[],nextCursor:null});
    expect(list).toHaveBeenCalledWith("tenant_a","fan_a","for_you",undefined);
  });
});