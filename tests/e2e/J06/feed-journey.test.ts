import {describe,expect,it,vi} from "vitest";
import Fastify from "fastify";
import {FeedService,type Repository,type Post} from "../../../packages/feed/src/index.js";
import {registerHomeFeedRoutes} from "../../../services/gateway/src/modules/home_feed/routes.js";
const published:Post={id:"381026c2-9d56-47b1-b73d-1784e24e41e2",tenantId:"tenant_test",
 authorMasanaId:"masana_one",kind:"text",body:"First lesson",media:[],transcript:null,
 publishedAt:"2026-10-10T10:00:00Z",likeCount:0,commentCount:0,viewerLiked:false,viewerSaved:false};
function fixture(){
 const db={list:vi.fn(async()=>[published]),find:vi.fn(async()=>published),
  publish:vi.fn(async()=>published),setLike:vi.fn(async()=>true),setSave:vi.fn(async()=>true),
  comment:vi.fn(async()=>({id:"comment",postId:published.id,body:"thanks",state:"pending" as const,createdAt:"now"})),comments:vi.fn(async()=>[])} satisfies Repository;
 const service=new FeedService(db,async(_tenant,id)=>id==="masana_one");
 return {service,db};
}
describe("J06 client HTTP → authorization → domain → persisted response (mock repository)",()=>{
 it("guest sees original post, fan cannot publish, editor can",async()=>{
  const {service,db}=fixture(),app=Fastify();
  let session:{kind:"fan"|"staff";tenantId:string;id:string;permissions?:string[]}|null=null;
  await registerHomeFeedRoutes(app,{service,principal:async()=>session,tenant:()=>"tenant_test",isNewAccount:async()=>true,enabled:()=>true});
  expect((await app.inject({method:"GET",url:"/v1/feed"})).statusCode).toBe(200);
  session={kind:"fan",tenantId:"tenant_test",id:"fan_one"};
  const denied=await app.inject({method:"POST",url:"/v1/admin/feed/posts",headers:{"idempotency-key":"request-accepted-001"},payload:{authorMasanaId:"masana_one",kind:"text",body:"human post"}});
  expect(denied.statusCode).toBe(403);expect(db.publish).not.toHaveBeenCalled();
  session={kind:"staff",tenantId:"tenant_test",id:"editor_one",permissions:["content_editor"]};
  const admitted=await app.inject({method:"POST",url:"/v1/admin/feed/posts",headers:{"idempotency-key":"request-accepted-002"},payload:{authorMasanaId:"masana_one",kind:"text",body:"approved lesson"}});
  expect(admitted.statusCode).toBe(200);expect(db.publish).toHaveBeenCalledTimes(1);
  await app.close();
 });
});
