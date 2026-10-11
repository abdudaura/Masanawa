import {describe,it,expect,vi} from "vitest";
import {makeScheduledFeedPublisher} from "./publish_scheduled.js";
const now=new Date("2026-10-12T10:00:00Z");
const item={id:"p",tenantId:"tenant",authorMasanaId:"masana",media:["media_abcdefgh"],
 revision:3,scheduledAt:"2026-10-12T09:00:00Z",state:"scheduled"};
function fixture(){
 const repo={due:vi.fn(async()=>[item]),releaseScheduled:vi.fn(async()=>true)};
 const verifier={verifiedAuthor:vi.fn(async()=>true),verifiedMedia:vi.fn(async()=>true)};
 return {repo,verifier};
}
describe("J06 scheduled release",()=>{
 it("defaults off and never reads database",async()=>{
  const {repo,verifier}=fixture(),run=makeScheduledFeedPublisher(repo,verifier);
  expect(await run("tenant",now)).toEqual({published:0,deferred:0});expect(repo.due).not.toHaveBeenCalled();
 });
 it("uses canonical state/revision CAS, only on verified live eligibility",async()=>{
  const {repo,verifier}=fixture(),run=makeScheduledFeedPublisher(repo,verifier,()=>true);
  expect(await run("tenant",now)).toEqual({published:1,deferred:0});
  expect(repo.releaseScheduled).toHaveBeenCalledWith("tenant","p",3,now);
 });
 it("denies revoked media without attempting a publish",async()=>{
  const {repo,verifier}=fixture();verifier.verifiedMedia.mockResolvedValue(false);
  expect(await makeScheduledFeedPublisher(repo,verifier,()=>true)("tenant",now)).toEqual({published:0,deferred:1});
  expect(repo.releaseScheduled).not.toHaveBeenCalled();
 });
 it("does not trust a cross-tenant due item or future schedule",async()=>{
  const {repo,verifier}=fixture();
  repo.due.mockResolvedValue([{...item,tenantId:"other"},{...item,scheduledAt:"2026-10-12T12:00:00Z"}]);
  expect(await makeScheduledFeedPublisher(repo,verifier,()=>true)("tenant",now)).toEqual({published:0,deferred:2});
  expect(repo.releaseScheduled).not.toHaveBeenCalled();
 });
 it("lost concurrent approval revision is not counted as published",async()=>{
  const {repo,verifier}=fixture();repo.releaseScheduled.mockResolvedValue(false);
  expect(await makeScheduledFeedPublisher(repo,verifier,()=>true)("tenant",now)).toEqual({published:0,deferred:1});
 });
});
