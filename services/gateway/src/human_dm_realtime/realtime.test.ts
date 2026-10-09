import { describe,expect,it } from "vitest";
import Fastify from "fastify";
import { createHumanDmRealtimeService,validCursor } from "./service.js";
import { createPostgresHumanDmRealtimeRepository } from "./postgres_repository.js";
import { registerHumanDmRealtimeRoutes } from "./routes.js";
import type { HumanDmRealtimeRepository,SyncPage } from "./postgres_repository.js";

function harness(repository:HumanDmRealtimeRepository) {
  const log: { tenantId:string;userId:string;after:string;limit:number }[] = [];
  const service=createHumanDmRealtimeService({
    repository: { async sync(input) {
      log.push(input); return repository.sync(input);
    } },
    authorizer: {
      async authorize({authorizationHeader}) {
        if (authorizationHeader!=="Bearer good") {
          throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
        }
        return {tenantId:"tenant_a",userId:"user_al"} as never;
      },
    },
  });
  const app=Fastify();
  registerHumanDmRealtimeRoutes(app,service);
  return {app,log};
}
const empty:SyncPage={
  events:[],nextCursor:"0",hasMore:false,resetRequired:false,
};

describe("C03 human DM realtime",()=>{
  it("rejects malformed, negative, overflow and non-decimal cursors",()=>{
    for(const value of ["-1","01","1e3","9223372036854775808",
       "123456789012345678901","abc","1;DROP TABLE events"]) {
      expect(()=>validCursor(value)).toThrow();
    }
    expect(validCursor("0")).toBe("0");
    expect(validCursor("9223372036854775807")).toBe("9223372036854775807");
  });

  it("never accesses PostgreSQL for a missing or invalid bearer",async()=>{
    const {app,log}=harness({async sync(){return empty;}});
    const result=await app.inject({method:"GET",url:"/messages/sync?cursor=0"});
    expect(result.statusCode).toBe(401);
    expect(log).toHaveLength(0);
    await app.close();
  });

  it("requires an initial full C02 snapshot only when no cursor exists",async()=>{
    const {app,log}=harness({async sync(){return empty;}});
    const first=await app.inject({
      method:"GET",url:"/messages/sync",
      headers:{authorization:"Bearer good"},
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({resetRequired:true,nextCursor:"0",events:[]});
    const next=await app.inject({
      method:"GET",url:"/messages/sync?cursor=0&limit=40&waitMs=0",
      headers:{authorization:"Bearer good"},
    });
    expect(next.json()).toMatchObject({resetRequired:false});
    expect(log).toEqual([
      {tenantId:"tenant_a",userId:"user_al",after:"0",limit:50},
      {tenantId:"tenant_a",userId:"user_al",after:"0",limit:40},
    ]);
    expect(next.headers["cache-control"]).toBe("private, no-store");
    await app.close();
  });

  it("bounds wait and page size before polling with a real session",async()=>{
    const {app,log}=harness({async sync(){return empty;}});
    for(const url of [
      "/messages/sync?limit=101","/messages/sync?waitMs=15001",
      "/messages/sync?cursor=-1","/messages/sync?cursor=00",
      "/messages/sync?unexpected=1",
    ]) {
      const denied=await app.inject({
        method:"GET",url,headers:{authorization:"Bearer good"},
      });
      expect(denied.statusCode).toBe(400);
    }
    expect(log).toHaveLength(0);
    await app.close();
  });

  it("does not expose body or bypass reciprocal block in SQL",async()=>{
    let sql="";let params:readonly unknown[]=[];
    const repo=createPostgresHumanDmRealtimeRepository({
      async query(query,values) {
        sql=query;params=values??[];
        return { rows:[{
          event_id:"12",conversation_id:"c",kind:"message_added",
          actor_user_id:"user_bo",message_id:"m",message_sequence:"9",
        }] as never,rowCount:1 };
      },
    });
    const page=await repo.sync({
      tenantId:"tenant_a",userId:"user_al",after:"11",limit:50,
    });
    expect(params).toEqual(["tenant_a","user_al","11",51]);
    expect(sql).toContain("me.state='active'");
    expect(sql).toContain("sp.blocked=true");
    expect(sql).toContain("e.recipient_user_id=$2");
    expect(sql).toContain("revoked.status='declined'");
    expect(sql).toContain("e.kind='access_changed'");
    expect(sql).not.toContain("m.body");
    expect(page).toEqual({
      events:[{
        eventId:"12",conversationId:"c",kind:"message_added",
        actorUserId:"user_bo",messageId:"m",messageSequence:"9",
      }],
      nextCursor:"12",hasMore:false,resetRequired:false,
    });
  });

  it("pages ordered events without acknowledging unseen event IDs",async()=>{
    const repo=createPostgresHumanDmRealtimeRepository({
      async query() {
        return {rows:[10,12,13].map((id)=>({
          event_id:String(id),conversation_id:"c",kind:"access_changed",
          actor_user_id:"user_bo",message_id:null,message_sequence:null,
        })) as never,rowCount:3};
      },
    });
    const page=await repo.sync({tenantId:"t",userId:"u",after:"9",limit:2});
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("12");
    expect(page.events).toHaveLength(2);
    expect(JSON.stringify(page)).not.toContain("private message");
  });

  it("uses bounded long poll and ends upon new authorized events",async()=>{
    let calls=0;let sleeps=0;
    const service=createHumanDmRealtimeService({
      repository:{async sync(){
        calls++;
        if(calls<2)return {...empty,nextCursor:"7"};
        return {...empty,nextCursor:"8",events:[{
          eventId:"8",conversationId:"c",kind:"read_changed",
          actorUserId:"user_bo",messageId:null,messageSequence:null,
        }]};
      }},
      authorizer:{async authorize(){return {tenantId:"t",userId:"u"} as never;}},
      sleep:async()=>{sleeps++;},
    });
    const response=await service.sync({cursor:"7",waitMs:1000});
    expect(response.events).toHaveLength(1);
    expect(calls).toBe(2);
    expect(sleeps).toBe(1);
  });
  it("revalidates a long-poll token after an idle wait",async()=>{
    let attempts=0;
    const service=createHumanDmRealtimeService({
      repository:{async sync(){return {...empty,nextCursor:"8"};}},
      authorizer:{async authorize(){
        attempts++;
        if(attempts>1) {
          throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
        }
        return {tenantId:"t",userId:"u"} as never;
      }},
      sleep:async()=>{},
    });
    await expect(service.sync({cursor:"8",waitMs:1000})).rejects.toMatchObject({
      statusCode:401,
    });
    expect(attempts).toBe(2);
  });

  it("requires C02 resnapshot for pruned cursors without replaying a partial page",async()=>{
    const repo=createPostgresHumanDmRealtimeRepository({
      async query() {
        return {rows:[{
          trimmed_through:"30",event_id:null,conversation_id:null,
          kind:null,actor_user_id:null,message_id:null,message_sequence:null,
        }] as never,rowCount:1};
      },
    });
    expect(await repo.sync({tenantId:"t",userId:"u",after:"12",limit:50})).toEqual({
      events:[],nextCursor:"30",hasMore:false,resetRequired:true,
    });
    const page=await repo.sync({tenantId:"t",userId:"u",after:"30",limit:50});
    expect(page).toMatchObject({events:[],nextCursor:"30",resetRequired:false});
  });

  it("preserves DB-triggered resetRequired through the Gateway service",async()=>{
    const {app}=harness({async sync(){return {
      events:[],nextCursor:"99",hasMore:false,resetRequired:true,
    };}});
    const response=await app.inject({
      method:"GET",url:"/messages/sync?cursor=10",
      headers:{authorization:"Bearer good"},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      resetRequired:true,nextCursor:"99",events:[],
    });
    await app.close();
  });

  it("refuses private event metadata if session revoked while SQL was in flight",async()=>{
    let called=0;
    const service=createHumanDmRealtimeService({
      repository:{async sync(){return {
        events:[{eventId:"1",conversationId:"c",kind:"access_changed",
          actorUserId:"u",messageId:null,messageSequence:null}],
        nextCursor:"1",hasMore:false,resetRequired:false,
      };}},
      authorizer:{async authorize(){
        called++;
        if(called>1)throw Object.assign(new Error("expired"),{statusCode:401});
        return {tenantId:"t",userId:"u"} as never;
      }},
    });
    await expect(service.sync({cursor:"0"})).rejects.toMatchObject({statusCode:401});
    expect(called).toBe(2);
  });

});
