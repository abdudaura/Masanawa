import Fastify from "fastify";
import {describe,it,expect,vi} from "vitest";
import {registerMasanaCallHistoryRoutes} from "./routes.js";
const valid={schemaVersion:1 as const,items:[],nextCursor:null};
function testApp(enabled=true){
 const app=Fastify();
 const resolveFan=vi.fn(async()=>({tenantId:"tenant-A",fanUserId:"fan-A"}));
 const list=vi.fn(async()=>valid);
 registerMasanaCallHistoryRoutes(app,{resolveFan,store:{list},enabled:async()=>enabled});
 return {app,resolveFan,list};
}
describe("C18 HTTP fan-only privacy and fail-closed availability",()=>{
 it("rejects anonymous and forged fan/tenant query without calling store",async()=>{
  const {app,resolveFan,list}=testApp();
  try{
   const a=await app.inject({method:"GET",url:"/v1/calls/history"});
   const b=await app.inject({method:"GET",url:"/v1/calls/history?fanUserId=somebody",
    headers:{authorization:"Bearer test-token"}});
   expect(a.statusCode).toBe(401);
   expect(b.statusCode).toBe(422);
   expect(list).not.toHaveBeenCalled();
   expect(resolveFan).toHaveBeenCalledTimes(1);
  }finally{await app.close();}
 });
 it("uses server actor and fixed pagination cap",async()=>{
  const {app,list}=testApp();
  try{
   const r=await app.inject({method:"GET",url:"/v1/calls/history?limit=30",
    headers:{authorization:"Bearer test-token"}});
   expect(r.statusCode).toBe(200);
   expect(r.json()).toEqual(valid);
   expect(list).toHaveBeenCalledWith({tenantId:"tenant-A",fanUserId:"fan-A"},
    {limit:30,cursor:null});
  }finally{await app.close();}
 });
 it("preserves authoritative revoked-session 401 rather than reporting service outage",async()=>{
  const app=Fastify();
  const list=vi.fn(async()=>valid);
  registerMasanaCallHistoryRoutes(app,{resolveFan:async()=>{
    throw Object.assign(new Error("session_revoked"),{status:401});
  },store:{list},enabled:async()=>true});
  try{
   const r=await app.inject({method:"GET",url:"/v1/calls/history",
    headers:{authorization:"Bearer test-token"}});
   expect(r.statusCode).toBe(401);
   expect(list).not.toHaveBeenCalled();
  }finally{await app.close();}
 });
 it("denies feature-off and malformed pagination without leaking SQL/provider detail",async()=>{
  const h=testApp(false);
  try{
   const r=await h.app.inject({method:"GET",url:"/v1/calls/history",
    headers:{authorization:"Bearer test-token"}});
   expect(r.statusCode).toBe(410);
   expect(h.list).not.toHaveBeenCalled();
  }finally{await h.app.close();}
  const x=testApp();
  try{
   const r=await x.app.inject({method:"GET",url:"/v1/calls/history?limit=999",
    headers:{authorization:"Bearer test-token"}});
   expect(r.statusCode).toBe(422);
   expect(x.list).not.toHaveBeenCalled();
  }finally{await x.app.close();}
 });
});
