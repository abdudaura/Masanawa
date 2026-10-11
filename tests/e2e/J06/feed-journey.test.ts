import {describe,expect,it,vi} from "vitest";
import Fastify from "fastify";
import {FeedService,type Repository,type Post} from "../../../packages/feed/src/index.js";
import {EditorialReviewService,type EditorialRepository,type EditorialPost} from "../../../packages/feed/src/review.js";
import {registerHomeFeedRoutes} from "../../../services/gateway/src/modules/home_feed/routes.js";
import {registerAdminFeedReviewRoutes} from "../../../services/gateway/src/modules/home_feed/admin_review_routes.js";

const published:Post={id:"381026c2-9d56-47b1-b73d-1784e24e41e2",tenantId:"tenant_test",
 authorMasanaId:"masana_one",kind:"text",body:"First lesson",media:[],transcript:null,
 publishedAt:"2026-10-10T10:00:00Z",likeCount:0,commentCount:0,viewerLiked:false,viewerSaved:false};
describe("J06 mock repo: auth → drafts → independent review → public feed",()=>{
 it("keeps direct staff publication and human authorship unreachable",async()=>{
  const db={list:vi.fn(async()=>[]),find:vi.fn(async()=>null),publish:vi.fn(async()=>published),
   setLike:vi.fn(async()=>true),setSave:vi.fn(async()=>true),
   comment:vi.fn(async()=>({id:"c",postId:published.id,body:"hi",state:"visible" as const,createdAt:"now"})),comments:vi.fn(async()=>[])} satisfies Repository;
  const app=Fastify(),service=new FeedService(db,async()=>true);
  let actor:{kind:"fan"|"staff";tenantId:string;id:string;permissions?:string[]}|null=
   {kind:"fan",tenantId:"tenant_test",id:"fan_one"};
  await registerHomeFeedRoutes(app,{service,principal:async()=>actor,
   tenant:()=>"tenant_test",isNewAccount:async()=>true,enabled:()=>true});
  const url="/v1/admin/feed/posts",headers={"idempotency-key":"direct-publish-req"};
  expect((await app.inject({method:"POST",url,headers,
   payload:{authorMasanaId:"masana_one",kind:"text",body:"fan bypass"}})).statusCode).toBe(403);
  actor={kind:"staff",tenantId:"tenant_test",id:"editor_one",permissions:["content_editor"]};
  const old=await app.inject({method:"POST",url,headers,
   payload:{authorMasanaId:"masana_one",kind:"text",body:"editor bypass"}});
  expect(old.statusCode).toBe(410);expect(old.json().code).toBe("use_editorial_review_workflow");
  expect(db.publish).not.toHaveBeenCalled();
  await app.close();
 });
 it("staff author cannot self-approve; independent editor publishes once, then fan sees post",async()=>{
  let state:EditorialPost={id:published.id,tenantId:"tenant_test",authorMasanaId:"masana_one",
   kind:"text",body:"First lesson",media:[],transcript:null,state:"draft",
   revision:0,createdBy:"editor_one",scheduledAt:null,updatedAt:"2026-10-11T09:00:00Z"};
  const editorialRepo={
   create:vi.fn(async()=>state),update:vi.fn(async()=>state),
   get:vi.fn(async()=>state),
   list:vi.fn(async()=>[state]),
   change:vi.fn(async(_tenant:string,_post:string,_actor:string,revision:number,action:string)=>{
    if(revision!==state.revision)throw Object.assign(new Error("editorial_stale_revision"),{status:409,code:"editorial_stale_revision"});
    state={...state,revision:revision+1,state:action==="submit"?"in_review":action==="approve"?"published":state.state};
    return state;
   })
  } satisfies EditorialRepository;
  const feedRepo={
   list:vi.fn(async()=>state.state==="published"?[published]:[]),
   find:vi.fn(async()=>state.state==="published"?published:null),
   publish:vi.fn(async()=>published),
   setLike:vi.fn(async()=>true),setSave:vi.fn(async()=>true),
   comment:vi.fn(async()=>({id:"c",postId:published.id,body:"ok",state:"pending" as const,createdAt:"now"})),comments:vi.fn(async()=>[])
  } satisfies Repository;
  const feed=new FeedService(feedRepo,async()=>true);
  const editorial=new EditorialReviewService(editorialRepo,async()=>true,async()=>true);
  let actor:{kind:"fan"|"staff";tenantId:string;id:string;permissions?:string[]}|null=
   {kind:"staff",tenantId:"tenant_test",id:"editor_one",permissions:["content_editor"]};
  const app=Fastify();
  await registerHomeFeedRoutes(app,{service:feed,principal:async()=>actor,
   tenant:()=>"tenant_test",isNewAccount:async()=>false,enabled:()=>true});
  await registerAdminFeedReviewRoutes(app,{service:editorial,principal:async()=>actor,
   tenant:()=>"tenant_test",enabled:()=>true});
  const request=async(url:string,action:string,key:string,expectedRevision:number)=>
   app.inject({method:"POST",url,headers:{"idempotency-key":key},
    payload:{action,expectedRevision}});
  const created=await app.inject({method:"POST",url:"/v1/admin/feed/drafts",
   headers:{"idempotency-key":"draft-client0001"},
   payload:{authorMasanaId:"masana_one",kind:"text",body:"First lesson"}});
  expect(created.statusCode).toBe(200);expect(created.json().state).toBe("draft");
  expect((await request(`/v1/admin/feed/posts/${published.id}/transition`,"submit","submit-client01",0)).statusCode).toBe(200);
  const self=await request(`/v1/admin/feed/posts/${published.id}/transition`,"approve","approve-client1",1);
  expect(self.statusCode).toBe(403);expect(editorialRepo.change).toHaveBeenCalledTimes(1);
  actor={kind:"fan",tenantId:"tenant_test",id:"fan_one"};
  expect((await app.inject({method:"GET",url:"/v1/feed"})).json().items).toEqual([]);
  actor={kind:"staff",tenantId:"tenant_test",id:"reviewer_two",permissions:["content_editor"]};
  expect((await request(`/v1/admin/feed/posts/${published.id}/transition`,"approve","approve-client2",1)).statusCode).toBe(200);
  actor={kind:"fan",tenantId:"tenant_test",id:"fan_one"};
  const visible=await app.inject({method:"GET",url:"/v1/feed"});
  expect(visible.statusCode).toBe(200);
  expect(visible.json().items).toEqual([published]);
  expect(feedRepo.publish).not.toHaveBeenCalled();
  await app.close();
 });
});
