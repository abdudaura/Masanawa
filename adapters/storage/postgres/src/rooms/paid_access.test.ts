import {describe,expect,it,vi} from "vitest";
import type {Pool} from "pg";
import {createPgRoomsRepository} from "./repository.js";

const actor={tenantId:"tenant_one",userId:"fan_one",roles:[] as string[]};
const room={tenant_id:"tenant_one",room_id:"room_math_1",state:"published",plan_mode:"paid"};
function fakeDb(opts:{entitled?:boolean;member?:boolean;banned?:boolean;free?:boolean}={}){
 const sql:string[]=[];
 const args:unknown[][]=[];
 let inserted=false;
 const query=vi.fn(async(statement:string,params:unknown[]=[]):Promise<{rows:any[]}>=>{
  sql.push(statement);args.push(params);
  if(statement.startsWith("SELECT * FROM rooms.rooms"))return {rows:[{...room,plan_mode:opts.free?"free":"paid"}]};
  if(statement.startsWith("SELECT 1 FROM rooms.entitlements"))
   return {rows:opts.entitled?[{valid:1}]:[]};
  if(statement.startsWith("SELECT state FROM rooms.memberships"))
   return {rows:opts.banned?[{state:"banned"}]:opts.member?[{state:"active"}]:[]};
  if(statement.startsWith("INSERT INTO rooms.memberships")){inserted=true;return {rows:[]};}
  return {rows:[]};
 });
 const pool={query,connect:vi.fn(async()=>({query,release:vi.fn()}))} as unknown as Pool;
 return {pool,sql,args,get inserted(){return inserted;}};
}
describe("J08 paid Room admission uses the verified database entitlement",()=>{
 it("never admits a paid Room without a fresh verified entitlement",async()=>{
  const db=fakeDb({entitled:false});
  await expect(createPgRoomsRepository(db.pool).join(actor,"room_math_1"))
   .rejects.toMatchObject({status:403,code:"subscription_not_verified"});
  expect(db.inserted).toBe(false);
  const index=db.sql.findIndex(s=>s.includes("FROM rooms.entitlements"));
  expect(index).toBeGreaterThan(-1);
  expect(db.args[index]).toEqual(["tenant_one","room_math_1","fan_one"]);
  expect(db.sql).toContain("ROLLBACK");
 });
 it("permits existing eligible paid users to join, without duplicate ledger",async()=>{
  const db=fakeDb({entitled:true});
  await createPgRoomsRepository(db.pool).join(actor,"room_math_1");
  expect(db.inserted).toBe(true);
  expect(db.sql.some(s=>s.includes("ON CONFLICT(tenant_id,room_id,user_id)"))).toBe(true);
  expect(db.sql).toContain("COMMIT");
 });
 it("a banned paid member still cannot rejoin with a valid subscription",async()=>{
  const db=fakeDb({entitled:true,banned:true});
  await expect(createPgRoomsRepository(db.pool).join(actor,"room_math_1"))
   .rejects.toMatchObject({status:403,code:"room_banned"});
  expect(db.inserted).toBe(false);
 });
 it("a former paid member cannot read lessons on expiry, despite retained membership",async()=>{
  const db=fakeDb({member:true,entitled:false});
  await expect(createPgRoomsRepository(db.pool).lessons(actor,"room_math_1"))
   .rejects.toMatchObject({status:403,code:"subscription_not_verified"});
  expect(db.sql.some(s=>s.includes("SELECT lesson_id"))).toBe(false);
 });
 it("free Rooms do not query paid subscription state",async()=>{
  const db=fakeDb({free:true});
  await createPgRoomsRepository(db.pool).join(actor,"room_math_1");
  expect(db.inserted).toBe(true);
  expect(db.sql.some(s=>s.includes("FROM rooms.entitlements"))).toBe(false);
 });
 it("no authenticated fan identity means no paid access",async()=>{
  const db=fakeDb({entitled:true});
  await expect(createPgRoomsRepository(db.pool).join({...actor,userId:null},"room_math_1"))
   .rejects.toMatchObject({status:401,code:"authentication_required"});
  expect(db.inserted).toBe(false);
 });
});
