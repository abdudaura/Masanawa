import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { readMigrationManifest, type MigrationRoot } from "../migrations.js";

export interface SchemaMigration {
  readonly owner: string;
  readonly name: string;
  readonly sha256: string;
  readonly sql: string;
}
export interface SchemaManifest {
  readonly migrations: readonly SchemaMigration[];
  readonly digest: string;
}
const migrationName=/^[0-9]{4,}_[a-z0-9][a-z0-9_-]*\.sql$/u;
const digest=(value: string) => createHash("sha256").update(value,"utf8").digest("hex");

/** Same migration discovery, ordering and checksum as the existing runMigrations. */
export async function loadSchemaManifest(roots: readonly MigrationRoot[]): Promise<SchemaManifest> {
  if (roots.length===0) throw new Error("schema.roots_empty");
  const result: SchemaMigration[]=[];
  const owners=new Set<string>();
  for (const root of roots) {
    if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(root.owner) || owners.has(root.owner)) {
      throw new Error("schema.owner_duplicate_or_invalid");
    }
    owners.add(root.owner);
    const entries=(await readdir(root.directory,{withFileTypes:true}))
      .filter(e=>e.isFile()&&migrationName.test(e.name))
      .map(e=>e.name).sort();
    for (const name of entries) {
      const sql=await readFile(path.join(root.directory,name),"utf8");
      if (!sql.trim() || Buffer.byteLength(sql,"utf8")>8*1024*1024) {
        throw new Error("schema.migration_size_invalid");
      }
      result.push(Object.freeze({owner:root.owner,name,sha256:digest(sql),sql}));
    }
  }
  result.sort((a,b)=>a.owner===b.owner?a.name.localeCompare(b.name):a.owner.localeCompare(b.owner));
  // Guard against accidentally diverging from the existing production migration
  // resolver/order, or migration files changing during this operator approval.
  const canonical=await readMigrationManifest(roots);
  if(canonical.length!==result.length || canonical.some((m,i)=>
    m.owner!==result[i]?.owner || m.name!==result[i]?.name ||
    m.sha256!==result[i]?.sha256)){
    throw new Error("schema.manifest_resolver_mismatch");
  }
  // Stable regardless of checkout path or filesystem timestamps. Pin this in an approval.
  const fingerprint=result.map(m=>[m.owner,m.name,m.sha256].join("/")).join("\n")+"\n";
  return Object.freeze({
    migrations:Object.freeze(result),
    digest:digest(fingerprint),
  });
}
