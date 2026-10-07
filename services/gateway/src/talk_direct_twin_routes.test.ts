import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerDirectTwinRoutes } from "./talk_direct_twin_routes.js";
import { createDirectTwinService, type DirectTwinRepository } from "./talk_direct_twin/service.js";

function app() {
  const server = Fastify();
  let record:any = null;
  const repository:DirectTwinRepository = {
    async readSeat() {
      return {
        tenantId:"tenant-1",talkId:"talk-1",seatId:"seat-1",personaId:"twin-1",
        kind:"twin",ownerUserId:"owner-1",admitted:true,removed:false,
      };
    },
    async listOwnedTwinSeats() {
      return [{
        tenantId:"tenant-1",talkId:"talk-1",seatId:"seat-1",personaId:"twin-1",
        kind:"twin",ownerUserId:"owner-1",admitted:true,removed:false,
      }];
    },
    async readInstruction() { return record; },
    async writeInstruction(input) {
      const revision=(record?.revision ?? 0)+1;
      record={...input,revision};
      return record;
    },
  };
  const service=createDirectTwinService({
    repository,
    authorizer:{
      async authorize({authorizationHeader}) {
        if(authorizationHeader!=="Bearer owner") {
          throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
        }
        return {
          tenantId:"tenant-1" as never,
          userId:"owner-1" as never,
          profile:{
            tenantId:"tenant-1" as never,
            userId:"owner-1" as never,
            name:"Owner",email:null,phone:null,locale:"en",
            createdAt:"2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
    now:()=>new Date("2026-10-07T10:00:00Z"),
    ttlMs:60_000,
  });
  registerDirectTwinRoutes(server,service);
  return server;
}

describe("Direct Twin HTTP API",()=>{
  it("projects owned active Twin Seats without exposing instructions",async()=>{
    const response=await app().inject({
      method:"GET",
      url:"/talks/talk-1/twin-seats/mine",
      headers:{authorization:"Bearer owner"},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{seatId:"seat-1",personaId:"twin-1"}]);
  });

  it("requires authenticated Twin owner and supports read/set/clear",async()=>{
    const server=app();
    const denied=await server.inject({
      method:"PUT",
      url:"/talks/talk-1/twin-seats/seat-1/direct",
      payload:{expectedRevision:null,instruction:"Focus on costs"},
    });
    expect(denied.statusCode).toBe(401);

    const set=await server.inject({
      method:"PUT",
      url:"/talks/talk-1/twin-seats/seat-1/direct",
      headers:{authorization:"Bearer owner"},
      payload:{expectedRevision:null,instruction:"Focus on costs"},
    });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toMatchObject({
      revision:1,
      instruction:"Focus on costs",
      expiresAt:"2026-10-07T10:01:00.000Z",
    });

    const read=await server.inject({
      method:"GET",
      url:"/talks/talk-1/twin-seats/seat-1/direct",
      headers:{authorization:"Bearer owner"},
    });
    expect(read.json()).toMatchObject({revision:1,instruction:"Focus on costs"});

    const cleared=await server.inject({
      method:"DELETE",
      url:"/talks/talk-1/twin-seats/seat-1/direct?expectedRevision=1",
      headers:{authorization:"Bearer owner"},
    });
    expect(cleared.json()).toEqual({revision:2,instruction:null,expiresAt:null});
  });

  it("rejects malformed direct instructions at the route boundary",async()=>{
    const response=await app().inject({
      method:"PUT",
      url:"/talks/talk-1/twin-seats/seat-1/direct",
      headers:{authorization:"Bearer owner"},
      payload:{expectedRevision:null,instruction:""},
    });
    expect(response.statusCode).toBe(400);
  });
});
