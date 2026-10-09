import {describe,it,expect} from "vitest";
import Fastify from "fastify";
import {createHumanDmSearchService} from "./search.js";
import {registerHumanDmSearchRoutes} from "./routes.js";

describe("U11 Gateway authentication and privacy envelope",()=>{
  it("returns 401 with no cache and no backing query for unsigned request",async()=>{
    const app=Fastify();
    let calls=0;
    registerHumanDmSearchRoutes(app,createHumanDmSearchService({
      cursorSecret:new Uint8Array(32).fill(4),
      authenticate:async()=>null,
      admit:async()=>true,
      repository:{search:async()=>{calls++;return [];}},
    }));
    const result=await app.inject({url:"/v1/human/messages/search?text=hello"});
    expect(result.statusCode).toBe(401);
    expect(result.headers["cache-control"]).toBe("private, no-store");
    expect(calls).toBe(0);
    await app.close();
  });
  it("uses only authenticated actor IDs and refuses missing distributed quota",async()=>{
    const app=Fastify();
    let scope:unknown;
    registerHumanDmSearchRoutes(app,createHumanDmSearchService({
      cursorSecret:new Uint8Array(32).fill(3),
      authenticate:async(header)=>header==="Bearer session-a"?
        {tenantId:"t-a",userId:"u-a"}:null,
      admit:async()=>true,
      repository:{search:async(request)=>{scope=request;return [];}},
    }));
    const result=await app.inject({url:"/v1/human/messages/search?text=hello",
      headers:{authorization:"Bearer session-a"}});
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({hits:[],next:null});
    expect(scope).toMatchObject({tenantId:"t-a",userId:"u-a"});
    await app.close();
  });
  it("returns 429 when the shared quota refuses a query",async()=>{
    const app=Fastify();
    registerHumanDmSearchRoutes(app,createHumanDmSearchService({
      cursorSecret:new Uint8Array(32).fill(5),
      authenticate:async()=>({tenantId:"t",userId:"u"}),
      admit:async()=>false,repository:{search:async()=>[]},
    }));
    const result=await app.inject({url:"/v1/human/messages/search?text=hello"});
    expect(result.statusCode).toBe(429);
    expect(result.json()).toMatchObject({error:{code:"rate_limited"}});
    await app.close();
  });
});
