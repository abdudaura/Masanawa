import {describe,it,expect} from "vitest";
import {seedMasanaDrafts} from "./staging_seed.js";
describe("staging-only fixture",()=>{
 it("denies a production seed before opening database",async()=>{
  await expect(seedMasanaDrafts({db:{connect:async()=>{throw Error("must_not_connect")}},
   fixture:{characters:[]},tenantId:"tenant_demo",environment:"production",seedAllowed:"staging"}))
   .rejects.toThrow("seed_disabled");
 });
 it("fails closed when fewer than 12 entries are supplied",async()=>{
  await expect(seedMasanaDrafts({db:{connect:async()=>{throw Error("must_not_connect")}},
   fixture:{characters:[]},tenantId:"tenant_demo",environment:"staging",seedAllowed:"staging"}))
   .rejects.toThrow("seed_fixture_incomplete");
 });
});
