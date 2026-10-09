import {describe,it,expect} from "vitest";
import {createHumanDmSearchService,HumanSearchError} from "./search.js";
import type {SearchHit,SearchScope} from "./search.js";

const accountA: SearchScope = {tenantId:"tenant-a",userId:"user-a"};
const hit: SearchHit = {
  messageId:"11111111-1111-4111-8111-111111111111",
  conversationId:"22222222-2222-4222-8222-222222222222",
  senderUserId:"user-b",sequence:"34",body:"Sannu ☺ test",
  createdAtUs:"2026-10-08T20:00:00.123456Z",editedAt:null,
};
const secret = new Uint8Array(32).fill(7);
function fixture() {
  let identity: SearchScope|null = accountA;
  let admitted = true, calls = 0, previous: unknown;
  let records: SearchHit[] = [];
  const service = createHumanDmSearchService({
    cursorSecret:secret,clock:()=>1_780_000_000_000,
    authenticate:async()=>identity,
    admit:async()=>admitted,
    repository:{search:async request=>{calls++;previous=request;return records;}},
  });
  return {service,setIdentity:(value:SearchScope|null)=>identity=value,
    setAdmitted:(value:boolean)=>admitted=value,
    setRecords:(value:SearchHit[])=>records=value,
    get calls(){return calls;},get previous(){return previous;}};
}
async function rejects(p:Promise<unknown>,code:string) {
  await expect(p).rejects.toMatchObject({code});
}
describe("U11 authenticated private human search",()=>{
  it("never searches before an active session resolves",async()=>{
    const f=fixture(); f.setIdentity(null);
    await rejects(f.service.search({text:"Sannu"}),"unauthorized");
    expect(f.calls).toBe(0);
  });
  it("rejects one-letter, control, huge, forged conversation filters and impossible limits",async()=>{
    const f=fixture();
    for(const args of [
      {text:"a"},{text:"\u0001hello"},{text:"x".repeat(129)},
      {text:"valid",conversationId:"agent-persona"}, {text:"valid",limit:31},
      {text:"valid",limit:-2},
    ]) await rejects(f.service.search(args),"invalid_query");
    expect(f.calls).toBe(0);
  });
  it("enforces a caller-supplied shared quota before touching message bodies",async()=>{
    const f=fixture(); f.setAdmitted(false);
    await rejects(f.service.search({text:"sannu"}),"rate_limited");
    expect(f.calls).toBe(0);
  });
  it("signs a query/account-bound short lived cursor, preserves microseconds",async()=>{
    const f=fixture();f.setRecords([hit, {...hit,messageId:"33333333-3333-4333-8333-333333333333"}]);
    const first=await f.service.search({text:"Sannu",limit:1});
    expect(first.hits).toHaveLength(1);
    expect(first.next).toBeTruthy();
    f.setRecords([hit]);
    await f.service.search({text:"Sannu",limit:1,after:first.next!});
    expect(f.previous).toMatchObject({before:{
      createdAtUs:"2026-10-08T20:00:00.123456Z",messageId:hit.messageId,
    }});
    await rejects(f.service.search({text:"Other",after:first.next!}),"invalid_cursor");
    f.setIdentity({tenantId:"tenant-b",userId:"user-a"});
    await rejects(f.service.search({text:"Sannu",after:first.next!}),"invalid_cursor");
    await rejects(f.service.search({text:"Sannu",after:first.next!.slice(0,-2)+"AA"}),"invalid_cursor");
  });
  it("bounds the response even if its repository returns too many messages",async()=>{
    const f=fixture();
    f.setRecords(Array.from({length:35},(_,i)=>({...hit,messageId:
      String(i).padStart(8,"0")+"-1111-4111-8111-111111111111"})));
    const result=await f.service.search({text:"hello",limit:20});
    expect(result.hits).toHaveLength(20);
    expect(result.next).toBeTruthy();
    expect(f.previous).toMatchObject({limit:21,tenantId:"tenant-a",userId:"user-a"});
  });
  it("returns a uniform unavailable error rather than leaking SQL or conversation existence",async()=>{
    const service=createHumanDmSearchService({
      cursorSecret:secret,authenticate:async()=>accountA,admit:async()=>true,
      repository:{search:async()=>{throw Error("SECRET database connection password");}},
    });
    await expect(service.search({text:"hello"})).rejects.toEqual(
      expect.objectContaining({code:"unavailable",status:503}));
  });
  it("rejects short cursor secrets during startup",()=>{
    expect(()=>createHumanDmSearchService({
      cursorSecret:new Uint8Array(4),authenticate:async()=>accountA,
      admit:async()=>true,repository:{search:async()=>[]},
    })).toThrow();
    expect(new HumanSearchError("invalid_query",400).status).toBe(400);
  });
});
