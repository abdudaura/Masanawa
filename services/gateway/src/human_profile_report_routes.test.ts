import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerTalkSafetyRoutes } from "./talk_safety_routes.js";
import type { TalkSafetyService } from "./talk_safety/service.js";

describe("R15 human profile report HTTP contract", () => {
  it("passes expected reporter identity through validated request, returning only 202 receipt", async () => {
    let observed: Parameters<TalkSafetyService["report"]>[0] | null = null;
    const server = Fastify();
    registerTalkSafetyRoutes(server, {
      async report(request: Parameters<TalkSafetyService["report"]>[0]) {
        observed = request;
        return {reportId:"confirmed-report",accepted:true};
      },
    } as unknown as TalkSafetyService);
    try {
      const response = await server.inject({
        method:"POST",url:"/safety/reports",
        headers:{authorization:"Bearer customer-a"},
        payload:{
          targetKind:"profile",targetId:"amina",reason:"impersonation",
          clientRequestId:"human-profile-id-123456",
          expectedReporterUserId:"user-a",
        },
      });
      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual({reportId:"confirmed-report",accepted:true});
      expect(observed).toMatchObject({
        authorizationHeader:"Bearer customer-a",
        expectedReporterUserId:"user-a",
        targetKind:"profile",
        targetId:"amina",
      });
    } finally {await server.close();}
  });

  it("rejects invalid expected reporter before service invocation", async () => {
    let count=0;
    const server=Fastify();
    registerTalkSafetyRoutes(server, {
      async report(){count++;return {reportId:"no",accepted:true};},
    } as unknown as TalkSafetyService);
    try {
      const response=await server.inject({
        method:"POST",url:"/safety/reports",
        headers:{authorization:"Bearer customer"},
        payload:{
          targetKind:"profile",targetId:"amina",reason:"spam",
          clientRequestId:"human-profile-id-123456",expectedReporterUserId:"",
        },
      });
      expect(response.statusCode).toBe(400);
      expect(count).toBe(0);
    } finally{await server.close();}
  });
});
