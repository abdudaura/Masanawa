import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerYouTubeSourceAdminRoutes } from "./source_admin_routes.js";
import type { AdminYouTubeSource } from "./source_admin.js";

describe("A13 YouTube source HTTP → authorization → store", () => {
  it("keeps tenant sources private and never accepts client-controlled automation", async () => {
    const app = Fastify();
    const sources = new Map<string, AdminYouTubeSource & { tenantId: string }>();
    const calls: Array<{tenantId: string; action: string}> = [];
    registerYouTubeSourceAdminRoutes(app, {
      // Test identity only. Production must inject the canonical platform
      // session and staff-role resolver, NOT a client-controlled role header.
      resolvePrincipal: async (request) => ({
        tenantId: request.headers["x-test-tenant"] === "other" ? "tenant-b" : "tenant-a",
        actorId: "staff-1",
        staffRoles: request.headers["x-test-staff"] === "yes" ? ["content_editor"] : [],
      }),
      store: {
        async list(tenantId) {
          calls.push({tenantId,action:"list"});
          return [...sources.values()].filter(s=>s.tenantId===tenantId);
        },
        async create(input) {
          calls.push({tenantId:input.tenantId,action:"create"});
          const item = {
            id:input.id,tenantId:input.tenantId,channelId:input.channelId,
            channelName:input.channelName,targetRegion:input.targetRegion,
            enabled:false,syncMode:"manual" as const,
          };
          sources.set(item.id,item);
          return item;
        },
        async pause(input) {
          calls.push({tenantId:input.tenantId,action:"pause"});
          const source = sources.get(input.id);
          if(!source || source.tenantId!==input.tenantId)return false;
          sources.set(source.id,{...source,enabled:false});
          return true;
        },
      },
    });
    const headers = {"x-test-staff":"yes"};
    const source = {channelId:"UC"+"X".repeat(22),channelName:"Teaching",targetRegion:"NG"};

    const fanRead=await app.inject({method:"GET",url:"/v1/admin/video-sources"});
    expect(fanRead.statusCode).toBe(403);
    const fanCreate=await app.inject({method:"POST",url:"/v1/admin/video-sources",payload:source});
    expect(fanCreate.statusCode).toBe(403);
    expect(calls).toEqual([]);

    const spoof=await app.inject({method:"POST",url:"/v1/admin/video-sources",
      headers,payload:{...source,authorized_api:true}});
    expect(spoof.statusCode).toBe(422);
    expect(calls).toEqual([]);

    const created=await app.inject({method:"POST",url:"/v1/admin/video-sources",
      headers,payload:source});
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({enabled:false,syncMode:"manual"});
    const id=created.json().id as string;

    const wrongList=await app.inject({method:"GET",url:"/v1/admin/video-sources",
      headers:{...headers,"x-test-tenant":"other"}});
    expect(wrongList.statusCode).toBe(200);
    expect(wrongList.json().items).toEqual([]);

    const deniedPause=await app.inject({method:"PATCH",
      url:`/v1/admin/video-sources/${id}/pause`});
    expect(deniedPause.statusCode).toBe(403);
    const crossTenantPause=await app.inject({method:"PATCH",
      url:`/v1/admin/video-sources/${id}/pause`,
      headers:{...headers,"x-test-tenant":"other"}});
    expect(crossTenantPause.statusCode).toBe(404);
    const ownerPause=await app.inject({method:"PATCH",
      url:`/v1/admin/video-sources/${id}/pause`,headers});
    expect(ownerPause.statusCode).toBe(200);
    expect(ownerPause.json()).toEqual({paused:true});
    const ownerList=await app.inject({method:"GET",url:"/v1/admin/video-sources",headers});
    expect(ownerList.json().items).toHaveLength(1);
    expect(ownerList.json().items[0]).toMatchObject({enabled:false});
    expect(calls.filter(x=>x.action==="create")).toEqual([{tenantId:"tenant-a",action:"create"}]);
    await app.close();
  });
});
