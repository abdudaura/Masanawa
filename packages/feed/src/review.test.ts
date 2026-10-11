import {describe,it,expect,vi} from "vitest";
import {EditorialReviewService,type EditorialPost,type EditorialRepository} from "./review.js";
const post:EditorialPost={id:"9b8c8884-7a31-49d9-aee5-521364b54aef",tenantId:"tenant",authorMasanaId:"masana",kind:"text",body:"Hello",media:[],transcript:null,state:"in_review",revision:1,createdBy:"author",scheduledAt:null,updatedAt:"2026-10-11T07:00:00Z"};
const staff=(id="reviewer")=>({kind:"staff" as const,tenantId:"tenant",id,permissions:["content_editor"]});
function deps(){
 const repo={create:vi.fn(async()=>post),get:vi.fn(async()=>post),list:vi.fn(async()=>[post]),change:vi.fn(async()=>({...post,state:"published" as const}))} satisfies EditorialRepository;
 return {repo,service:new EditorialReviewService(repo,async()=>true,async()=>true)};
}
describe("A05/A06 editorial admission and review",()=>{
 it("denies fans and unprivileged staff before database access",async()=>{
  const {service,repo}=deps();
  await expect(service.create({kind:"fan",tenantId:"tenant",id:"fan"},{authorMasanaId:"masana",kind:"text",body:"hi",idempotencyKey:"editorial-key01"})).rejects.toMatchObject({status:403});
  await expect(service.list({kind:"staff",tenantId:"tenant",id:"reader",permissions:[]})).rejects.toMatchObject({status:403});
  expect(repo.create).not.toHaveBeenCalled();expect(repo.list).not.toHaveBeenCalled();
 });
 it("admitted draft never requests published state",async()=>{
  const {service,repo}=deps();
  await service.create(staff("author"),{authorMasanaId:"masana",kind:"text",body:" Hello ",idempotencyKey:"editorial-key01"});
  expect(repo.create).toHaveBeenCalledWith("tenant","author",expect.objectContaining({body:"Hello",idempotencyKey:"editorial-key01"}));
 });
 it("requires independent reviewer and fresh revision",async()=>{
  const {service,repo}=deps();
  await expect(service.change(staff("author"),post.id,"approve",1,"approve-key01")).rejects.toMatchObject({code:"separate_reviewer_required"});
  await expect(service.change(staff(),post.id,"approve",-1,"approve-key01")).rejects.toMatchObject({code:"invalid_revision"});
  expect(repo.change).not.toHaveBeenCalled();
 });
 it("refuses unverified media and suspended authors at approval",async()=>{
  const {repo}=deps();
  const m={...post,media:["media_abcdefgh"]};
  repo.get.mockResolvedValue(m);
  const noAuthor=new EditorialReviewService(repo,async()=>false,async()=>true);
  await expect(noAuthor.change(staff(),post.id,"approve",1,"approve-key01")).rejects.toMatchObject({code:"masana_not_approved"});
  const noMedia=new EditorialReviewService(repo,async()=>true,async()=>false);
  await expect(noMedia.change(staff(),post.id,"approve",1,"approve-key01")).rejects.toMatchObject({code:"media_not_approved"});
  expect(repo.change).not.toHaveBeenCalled();
 });
 it("rejects expired scheduling and accepts a future reviewed schedule",async()=>{
  const {repo,service}=deps();
  await expect(service.change(staff(),post.id,"schedule",1,"schedule-key01",new Date(Date.now()-1000).toISOString())).rejects.toMatchObject({code:"invalid_schedule"});
  const future=new Date(Date.now()+120000).toISOString();
  await service.change(staff(),post.id,"schedule",1,"schedule-key01",future);
  expect(repo.change).toHaveBeenCalledWith("tenant",post.id,"reviewer",1,"schedule","schedule-key01",future);
 });
 it("rejects malformed post references and key replays",async()=>{
  const {service,repo}=deps();
  await expect(service.get(staff(),"../../wallet")).rejects.toMatchObject({code:"invalid_post_id"});
  await expect(service.change(staff(),post.id,"approve",1,"x")).rejects.toMatchObject({code:"invalid_idempotency_key"});
  expect(repo.get).not.toHaveBeenCalled();
 });
});
