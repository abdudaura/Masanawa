import test from "node:test";
import assert from "node:assert/strict";
import { createTwinQualityService } from "./quality.ts";
const bearer = "Bearer authorized-test";
const event = (id,kind="purchase",status="completed") => ({
  eventId:id, kind,status, referenceId:"private-customer-ref",
  occurredAt:"2026-10-08T10:00:00Z", amountCredits:77,
  title:"arbitrary",detail:"private-text",
});
function create({clone="character_abc",rows=[],economyExtra={},activityExtra={}}={}) {
  const economy={hasClone:clone!==null, characterId:clone,customerCredits:5,
    agentFloatCredits:clone?9:0,pendingEarningsCredits:clone?4:0,
    availableEarningsCredits:clone?11:0,...economyExtra};
  const activity={hasTwin:clone!==null,characterId:clone,
    summary:{visitors:0,conversations:0,earningsCredits:0,pendingOwnerRequests:0},
    items:rows,...activityExtra};
  const seen=[];
  const service=createTwinQualityService({
    economy:{async read(req){seen.push(req.authorizationHeader);if(req.authorizationHeader!==bearer) throw Error("Unauthorized");return economy;}},
    activity:{async read(req){seen.push(req.authorizationHeader);if(req.authorizationHeader!==bearer) throw Error("Unauthorized");return activity;}},
  });
  return {service,seen};
}
test("only canonical ledger determines earnings, no untrusted narrative/customer reference",async()=>{
  const f=create({rows:[event("one"),event("two","earning")]});
  const v=await f.service.read({authorizationHeader:bearer});
  assert.deepEqual([v.earnings.pendingCredits,v.earnings.availableCredits],[4,11]);
  assert.equal(v.earnings.payoutGuaranteed,false);
  assert.equal(v.evidence.completed,1);
  assert.equal(v.evidence.totalResultsKnown,false);
  assert.equal(JSON.stringify(v).includes("private-customer-ref"),false);
  assert.equal(JSON.stringify(v).includes("private-text"),false);
  assert.equal(v.float.providerCostCredits,null);
  assert.deepEqual(f.seen,[bearer,bearer]);
});
test("replayed events are not counted twice and conflicting duplicates are refused",async()=>{
  assert.equal((await create({rows:[event("a"),event("a")]}).service.read({authorizationHeader:bearer})).evidence.completed,1);
  await assert.rejects(create({rows:[event("a"),event("a","purchase","failed")]}).service.read({authorizationHeader:bearer}),/Conflicting/);
});
test("refunded, failed and pending activities never inflate success",async()=>{
  const v=await create({rows:[event("a","voice","failed"),event("b","purchase","refunded"),event("c","purchase","pending")]}).service.read({authorizationHeader:bearer});
  assert.equal(v.evidence.completed,0);
  assert.equal(v.evidence.unsuccessful,2);
  assert.equal(v.earnings.availableCredits,11);
});
test("zero Float does not invent costs, quotas or completed reroutes",async()=>{
  const v=await create({economyExtra:{agentFloatCredits:0}}).service.read({authorizationHeader:bearer});
  assert.equal(v.float.exhausted,true);
  assert.equal(v.float.taskQuotaRemaining,null);
});
test("no Twin shows no earnings, evidence or activity",async()=>{
  const v=await create({clone:null}).service.read({authorizationHeader:bearer});
  assert.equal(v.hasTwin,false);
  assert.equal(v.evidence,null);
  assert.deepEqual(v.recent,[]);
});
test("account mismatch, fabricated balances, oversized source and wrong bearer fail closed",async()=>{
  for(const cfg of [
    {activityExtra:{characterId:"character_other"}},
    {economyExtra:{availableEarningsCredits:-1}},
    {economyExtra:{availableEarningsCredits:0.5}},
    {rows:Array.from({length:51},(_,n)=>event("e"+n))},
  ]) await assert.rejects(create(cfg).service.read({authorizationHeader:bearer}),Error);
  await assert.rejects(create().service.read({authorizationHeader:"Bearer other"}),/Unauthorized/);
});
test("invalid limits and event corruption fail closed",async()=>{
  await assert.rejects(create({rows:[{...event("bad"),amountCredits:Infinity}]}).service.read({authorizationHeader:bearer}),/Unqualified/);
  for(const limit of [0,-1,101,1.5,NaN]) {
    await assert.rejects(create().service.read({authorizationHeader:bearer,limit}),/limit/);
  }
});
