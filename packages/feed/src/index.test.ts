import {describe,it,expect,vi} from "vitest";
import {FeedService,type Repository,type Post} from "./index.js";
const post:Post={id:"381026c2-9d56-47b1-b73d-1784e24e41e2",tenantId:"tenant",authorMasanaId:"masana",kind:"text",body:"Hello",media:[],transcript:null,publishedAt:"2026-10-10T09:00:00Z",likeCount:0,commentCount:0,viewerLiked:false,viewerSaved:false};
function mock(){
 return {list:vi.fn(async()=>[post]),find:vi.fn(async(t:string)=>t==="tenant"?post:null),publish:vi.fn(async()=>post),setLike:vi.fn(async()=>true),setSave:vi.fn(async()=>true),comment:vi.fn(async()=>({id:"comment",postId:post.id,body:"ok",state:"pending" as const,createdAt:"now"})),comments:vi.fn(async()=>[])} satisfies Repository;
}
const fan={kind:"fan" as const,tenantId:"tenant",id:"fan"};
describe("J06 Masana-only Feed",()=>{
 it("rejects member post and never writes",async()=>{
  const db=mock(),service=new FeedService(db,async()=>true);
  await expect(service.publish(fan,{authorMasanaId:"masana",kind:"text",body:"No",idempotencyKey:"request-001"})).rejects.toMatchObject({status:403});
  expect(db.publish).not.toHaveBeenCalled();
 });
 it("guards staff roles, agent identity and approval",async()=>{
  const db=mock(),s=new FeedService(db,async()=>false);
  await expect(s.publish({kind:"staff",tenantId:"tenant",id:"staff",permissions:[]},{authorMasanaId:"masana",kind:"text",body:"no",idempotencyKey:"request-002"})).rejects.toMatchObject({status:403});
  await expect(s.publish({kind:"masana",tenantId:"tenant",id:"wrong",approved:true},{authorMasanaId:"masana",kind:"text",body:"no",idempotencyKey:"request-003"})).rejects.toMatchObject({status:403});
  await expect(s.publish({kind:"masana",tenantId:"tenant",id:"masana",approved:true},{authorMasanaId:"masana",kind:"text",body:"no",idempotencyKey:"request-004"})).rejects.toMatchObject({code:"masana_not_approved"});
 });
 it("rejects remote media injection and missing audio transcript",async()=>{
  const db=mock(),s=new FeedService(db,async()=>true),staff={kind:"staff" as const,tenantId:"tenant",id:"staff",permissions:["content_editor"]};
  await expect(s.publish(staff,{authorMasanaId:"masana",kind:"image",body:"photo",media:["https://evil.example/image"],idempotencyKey:"request-005"})).rejects.toMatchObject({code:"invalid_media_reference"});
  await expect(s.publish(staff,{authorMasanaId:"masana",kind:"audio",body:"clip",media:["media_abcdefgh"],idempotencyKey:"request-006"})).rejects.toMatchObject({code:"audio_transcript_required"});
 });
 it("requires auth on following and rejects malformed cursors",async()=>{
  const s=new FeedService(mock(),async()=>true);
  await expect(s.list("tenant",null,"following")).rejects.toMatchObject({status:401});
  await expect(s.list("tenant",null,"for_you","%%%")).rejects.toMatchObject({code:"invalid_cursor"});
 });
 it("tenant fences reaction and saves; premoderates new fan comments",async()=>{
  const db=mock(),s=new FeedService(db,async()=>true);
  expect(await s.like(fan,post.id,true)).toBe(true);expect(await s.save(fan,post.id,false)).toBe(true);
  await expect(s.save({...fan,tenantId:"other"},post.id,true)).rejects.toMatchObject({status:404});
  await s.comment(fan,post.id," question ","client-key-001",true);
  expect(db.comment).toHaveBeenCalledWith("tenant","fan",post.id,"question","client-key-001",true);
 });
 it("allows approved editor with stable idempotency",async()=>{
  const db=mock(),s=new FeedService(db,async()=>true);
  await s.publish({kind:"staff",tenantId:"tenant",id:"editor",permissions:["content_editor"]},{authorMasanaId:"masana",kind:"text",body:"Welcome",idempotencyKey:"request-007"});
  expect(db.publish).toHaveBeenCalledTimes(1);
 });
});
