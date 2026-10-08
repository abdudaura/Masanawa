import { mkdtemp,mkdir,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach,describe,expect,it } from "vitest";
import { loadSchemaManifest } from "./manifest.js";

const folders:string[]=[];
async function temp() {const dir=await mkdtemp(path.join(tmpdir(),"masanawa-schema-test-"));folders.push(dir);return dir;}
afterEach(async()=>{for(const d of folders.splice(0)){await rm(d,{recursive:true,force:true});}});
const sha=(v:string)=>createHash("sha256").update(v,"utf8").digest("hex");

describe("portable migration manifest",()=>{
  it("matches the existing ordered owner/name/raw-SQL checksum contract",async()=>{
    const home=await temp(),aa=path.join(home,"aaa"),zz=path.join(home,"zzz");
    await mkdir(aa);await mkdir(zz);
    await writeFile(path.join(zz,"0002_more.sql"),"SELECT 2;\n");
    await writeFile(path.join(aa,"0001_first.sql"),"SELECT 1;\n");
    await writeFile(path.join(zz,"0001_first.sql"),"SELECT 'hello';\n");
    const one=await loadSchemaManifest([{owner:"zzz",directory:zz},{owner:"aaa",directory:aa}]);
    const two=await loadSchemaManifest([{owner:"aaa",directory:aa},{owner:"zzz",directory:zz}]);
    expect(one.digest).toBe(two.digest);
    expect(one.migrations.map(x=>x.owner+"/"+x.name)).toEqual([
      "aaa/0001_first.sql","zzz/0001_first.sql","zzz/0002_more.sql"]);
    expect(one.migrations[0]?.sha256).toBe(sha("SELECT 1;\n"));
    expect(one.migrations[0]?.sql).toBe("SELECT 1;\n");
  });
  it("rejects duplicate schema ownership before allowing apply",async()=>{
    const d=await temp();await writeFile(path.join(d,"0001_first.sql"),"SELECT 1;");
    await expect(loadSchemaManifest([{owner:"identity",directory:d},{owner:"identity",directory:d}]))
      .rejects.toThrow("schema.owner_duplicate_or_invalid");
  });
  it("manifest changes when migration SQL changes and ignores non-SQL files",async()=>{
    const d=await temp();
    const file=path.join(d,"0001_first.sql");
    await writeFile(file,"SELECT 1;");
    await writeFile(path.join(d,"NOTES.md"),"do not import me");
    const before=await loadSchemaManifest([{owner:"talks",directory:d}]);
    await writeFile(file,"SELECT 2;");
    const after=await loadSchemaManifest([{owner:"talks",directory:d}]);
    expect(after.digest).not.toBe(before.digest);
    expect(after.migrations).toHaveLength(1);
  });
});
