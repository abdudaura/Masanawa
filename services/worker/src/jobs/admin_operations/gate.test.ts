import { describe, it, expect, vi } from "vitest";
import { admitAdminJob } from "./gate.js";
describe("R1/J19 agent job activation gate",()=>{
 it("defaults closed when unwired or tenant missing",async()=>{
  expect(await admitAdminJob(undefined,"tenant-1","posting")).toMatchObject({admitted:false});
  expect(await admitAdminJob({read:vi.fn()}, "","teaching")).toMatchObject({admitted:false});
 });
 it("denies outage without scheduling forbidden work",async()=>{
  const read=vi.fn(async()=>{throw new Error("db down")});
  expect(await admitAdminJob({read},"tenant-1","imports")).toEqual({admitted:false,reason:"unavailable"});
 });
 it("honors explicitly disabled verified flags",async()=>{
  expect(await admitAdminJob({read:async()=>false},"tenant-1","paid_joins")).toEqual({admitted:false,reason:"disabled"});
 });
 it("allows only an explicitly enabled, successfully resolved flag",async()=>{
  expect(await admitAdminJob({read:async()=>true},"tenant-1","calls")).toEqual({admitted:true,reason:"enabled"});
 });
});
