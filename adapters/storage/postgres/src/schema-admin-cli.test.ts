import type {Pool} from "pg";
import { mkdtemp,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {afterEach,describe,expect,it} from "vitest";
import {runSchemaCli} from "./schema_admin/cli.js";
const dirs:string[]=[];
afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
async function init(){
  const dir=await mkdtemp(path.join(tmpdir(),"r16-cli-"));dirs.push(dir);
  await writeFile(path.join(dir,"0001_start.sql"),"SELECT 1;");
  const output={out:[] as string[],err:[] as string[]};
  const deps={
    roots:[{owner:"identity",directory:dir}],env:{} as Record<string,string|undefined>,
    makePool:(_url:string)=>{throw Error("db should not be contacted");},
    output:{out:(x:string)=>output.out.push(x),err:(x:string)=>output.err.push(x)},
  };
  return{deps,output};
}
describe("R16 schema CLI privilege boundary",()=>{
  it("prints deterministic manifest without database access or exposing secrets",async()=>{
    const h=await init();
    expect(await runSchemaCli(["manifest"],h.deps)).toBe(0);
    const data=JSON.parse(h.output.out[0]!);
    expect(data.migrationCount).toBe(1);
    expect(data.manifestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(h.output.out[0]).not.toContain("DATABASE_URL");
  });
  it("rejects all unrecognized commands/flags, never creating connections",async()=>{
    const h=await init();
    expect(await runSchemaCli(["drop"],h.deps)).toBe(3);
    expect(await runSchemaCli(["apply","--force"],h.deps)).toBe(3);
    expect(h.output.out).toEqual([]);
  });
  it("does not leak a secret connection string when connection fails",async()=>{
    const h=await init();
    h.deps.env.MASANAWA_DATABASE_URL="postgres://secret_user:secret_password@example.invalid/private";
    expect(await runSchemaCli(["status"],h.deps)).toBe(3);
    expect(h.output.err.join(" ")).not.toContain("secret_password");
  });
});
