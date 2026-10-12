import {describe,it,expect,vi} from "vitest";
import {PgStatusEligibility} from "./eligibility.js";
describe("Status existing canonical eligibility selectors",()=>{
 it("requires strict canonical approval and never trusts malformed truthy rows",async()=>{
  for(const approved of [false,undefined,null,"true",1]){
   const query=vi.fn(async()=>({rows:[{approved}]}));
   const r=new PgStatusEligibility({query} as never);
   expect(await r.author("tenant","masana")).toBe(false);
   expect(await r.media("tenant","masana","media_abcdefgh")).toBe(false);
  }
 });
 it("binds exact tenant/author/media and checks current identity plus cleared rights",async()=>{
  const query=vi.fn(async(_sql:string,_args:unknown[])=>({rows:[{approved:true}]}));
  const r=new PgStatusEligibility({query} as never);
  expect(await r.author("tenant","masana")).toBe(true);
  expect(await r.media("tenant","masana","media_abcdefgh")).toBe(true);
  expect(query.mock.calls[0]?.[1]).toEqual(["tenant","masana"]);
  expect(query.mock.calls[1]?.[1]).toEqual(["tenant","masana","media_abcdefgh"]);
  for(const [sql] of query.mock.calls){
   expect(sql).toContain("c.state='active'");
   expect(sql).toContain("o.kind='platform'");
   expect(sql).toContain("r.state='approved'");
  }
  expect(query.mock.calls[1]?.[0]).toContain("m.rights_note");
  expect(query.mock.calls[1]?.[0]).toContain("m.approved_by");
 });
 it("denies image references relabelled as audio before querying",async()=>{
  const query=vi.fn();const r=new PgStatusEligibility({query} as never);
  expect(await r.media("tenant","masana","media_abcdefgh","audio")).toBe(false);
  expect(query).not.toHaveBeenCalled();
 });
 it("propagates storage failure so the authenticated HTTP scope fails closed",async()=>{
  const r=new PgStatusEligibility({query:async()=>{throw Error("unavailable");}} as never);
  await expect(r.author("tenant","masana")).rejects.toThrow("unavailable");
 });
});
