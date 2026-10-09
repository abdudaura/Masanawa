import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const { createHumanDmPreferenceService }=require("./service.js");
const {validateChange,hintForEvent,DmPreferenceError}=require("./policy.js");
const id="a0000000-0000-4000-8000-000000000001";
const mid="a0000000-0000-4000-8000-000000000002";
const event={eventId:"12",conversationId:id,messageId:mid,recipientUserId:"B",actorUserId:"A"};
const off={conversationId:id,version:0,muteMode:"off",mutedUntil:null,preview:"hidden"};
function harness({state=off,canNotify=true}={}){
 const calls=[];let count=0;
 return {calls, service:createHumanDmPreferenceService({
  now:()=>new Date("2026-10-09T00:30:00Z"),
  authorizer:{async authorize(){count++;return {tenantId:"T",userId:"B"};}},
  repository:{
   async get(s){calls.push(s);return state;},
   async set(s){calls.push(s);return {...state,version:s.change.expectedVersion+1,muteMode:s.change.muteMode,mutedUntil:s.change.mutedUntil??null,preview:s.change.preview};},
   async unreadCount(s){calls.push(s);return "3";},
   async eligibleEvent(s){calls.push(s);return state;},
   async reserveHint(s){calls.push(s);return canNotify;}
  }
 })};
}
test("deny hostile mute input, stale/future expiry and invalid preview",()=>{
 const date=new Date("2026-10-09T00:30:00Z");
 for(const change of [
  {expectedVersion:-1,muteMode:"off",preview:"hidden"},
  {expectedVersion:0,muteMode:"until",mutedUntil:"2020-01-01T00:00:00Z",preview:"hidden"},
  {expectedVersion:0,muteMode:"until",mutedUntil:"2029-01-01T00:00:00Z",preview:"hidden"},
  {expectedVersion:0,muteMode:"off",mutedUntil:"2026-10-10T00:00:00Z",preview:"hidden"},
  {expectedVersion:0,muteMode:"off",preview:"plaintext"}
 ])assert.throws(()=>validateChange(change,date),DmPreferenceError);
});
test("push has no sender, message ID, recipient or private content",()=>{
 const hint=hintForEvent(event);
 assert.deepEqual(Object.keys(hint.data).sort(),["conversationId","eventId","kind"]);
 assert.equal(JSON.stringify(hint).includes(mid),false);
 assert.equal(JSON.stringify(hint).includes("recipientUserId"),false);
 assert.throws(()=>hintForEvent({...event,eventId:"9999999999999999999999"}));
});
test("suppress self, wrong recipient, muted and unclaimed hints",async()=>{
 const a=harness();
 assert.equal(await a.service.pushHint({recipient:{tenantId:"T",userId:"B"},event:{...event,actorUserId:"B"}}),null);
 assert.equal(await a.service.pushHint({recipient:{tenantId:"T",userId:"C"},event}),null);
 assert.equal(a.calls.length,0);
 for(const state of [{...off,muteMode:"forever"},{...off,muteMode:"until",mutedUntil:"2026-10-09T04:00:00Z"}]){
  assert.equal(await harness({state}).service.pushHint({recipient:{tenantId:"T",userId:"B"},event}),null);
 }
 assert.equal(await harness({canNotify:false}).service.pushHint({recipient:{tenantId:"T",userId:"B"},event}),null);
 assert.equal((await a.service.pushHint({recipient:{tenantId:"T",userId:"B"},event})).title,"New message");
});
test("read, CAS write, unread and notification link use authorized scope",async()=>{
 const h=harness();
 assert.equal((await h.service.get({conversationId:id})).version,0);
 assert.equal((await h.service.set({conversationId:id,change:{expectedVersion:0,muteMode:"forever",preview:"generic"}})).version,1);
 assert.deepEqual(await h.service.unread({}),{unreadCount:"3"});
 assert.deepEqual(await h.service.resolveTarget({conversationId:id}),{conversationId:id});
 assert.equal(h.calls.every(c=>c.tenantId==="T"&&c.userId==="B"),true);
});
test("account switches during await are not accepted",async()=>{
 let n=0;
 const svc=createHumanDmPreferenceService({authorizer:{async authorize(){return {tenantId:"T",userId:++n===1?"B":"C"};}},
  repository:{get:async()=>off,set:async()=>off,unreadCount:async()=> "0",eligibleEvent:async()=>off,reserveHint:async()=>true}});
 await assert.rejects(svc.get({conversationId:id}),e=>e.code==="messages.session_changed");
});
test("revoked or conflicting preference never reports saved",async()=>{
 for(const result of [null,"conflict"]){
  const svc=createHumanDmPreferenceService({authorizer:{async authorize(){return {tenantId:"T",userId:"B"};}},
   repository:{get:async()=>null,set:async()=>result,unreadCount:async()=>"0",eligibleEvent:async()=>null,reserveHint:async()=>false}});
  await assert.rejects(svc.set({conversationId:id,change:{expectedVersion:0,muteMode:"off",preview:"hidden"}}),
   e=>e.statusCode===(result===null?404:409));
 }
});
test("duplicate committed event produces at most one hint",async()=>{
 let claimed=false;
 const svc=createHumanDmPreferenceService({authorizer:{async authorize(){return {tenantId:"T",userId:"B"};}},
  repository:{get:async()=>off,set:async()=>off,unreadCount:async()=>"0",eligibleEvent:async()=>off,
    reserveHint:async()=>{if(claimed)return false;claimed=true;return true;}}});
 assert.notEqual(await svc.pushHint({recipient:{tenantId:"T",userId:"B"},event}),null);
 assert.equal(await svc.pushHint({recipient:{tenantId:"T",userId:"B"},event}),null);
});
