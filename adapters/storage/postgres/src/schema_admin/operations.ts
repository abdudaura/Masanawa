import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";
import type { SchemaManifest, SchemaMigration } from "./manifest.js";

interface Queryable {
  query<T extends Record<string,unknown>=Record<string,unknown>>(
    text:string, values?:unknown[],
  ):Promise<{readonly rows:T[];readonly rowCount:number|null}>;
}
interface LedgerRow extends Record<string,unknown>{
  owner:string;name:string;sha256:string;applied_at:Date|string;
}
interface InstanceRow extends Record<string,unknown> {
  db_name:string; db_user:string; server_version:string; ledger_table:string|null;
}
export interface SchemaStatus {
  readonly manifestSha256:string;
  readonly databaseName:string;
  readonly databaseRole:string;
  readonly serverVersion:string;
  readonly compatible:boolean;
  readonly ledgerExists:boolean;
  readonly applied:number;
  readonly pending:readonly string[];
  readonly changed:readonly string[];
  readonly unexpected:readonly string[];
  readonly orderingViolations:readonly string[];
  readonly ready:boolean;
}
export class SchemaOperationError extends Error {
  constructor(readonly code:string){super(code);this.name="SchemaOperationError";}
}
function key(owner:string,name:string){return owner+"/"+name;}
async function inspect(query:Queryable,manifest:SchemaManifest):Promise<SchemaStatus>{
  const res=await query.query<InstanceRow>(
    "SELECT current_database()::text AS db_name, current_user::text AS db_user, "+
    "current_setting('server_version_num')::text AS server_version, "+
    "to_regclass('public.masanawa_schema_migrations')::text AS ledger_table",
  );
  const instance=res.rows[0];
  if(!instance) throw new SchemaOperationError("schema.db_metadata_unavailable");
  const ledgerExists=instance.ledger_table!==null;
  const applied=ledgerExists
    ?(await query.query<LedgerRow>(
       "SELECT owner,name,sha256,applied_at FROM public.masanawa_schema_migrations "+
       "ORDER BY applied_at,owner,name",
     )).rows:[];
  const expected=new Map(manifest.migrations.map(m=>[key(m.owner,m.name),m.sha256]));
  const actual=new Map(applied.map(m=>[key(m.owner,m.name),m.sha256]));
  const pending=manifest.migrations.filter(m=>!actual.has(key(m.owner,m.name)))
    .map(m=>key(m.owner,m.name));
  const changed=applied.filter(m=>expected.has(key(m.owner,m.name))&&
    expected.get(key(m.owner,m.name))!==m.sha256).map(m=>key(m.owner,m.name));
  const unexpected=applied.filter(m=>!expected.has(key(m.owner,m.name)))
    .map(m=>key(m.owner,m.name));
  // One global lexicographic sequence is required by existing runMigrations.
  // If a later migration is already applied but an earlier one remains pending,
  // manual reconciliation is required; do not silently backfill older schemas.
  const expectedKeys=manifest.migrations.map(m=>key(m.owner,m.name));
  const presentKeys=new Set(applied.map(m=>key(m.owner,m.name)));
  let foundPending=false;
  const orderingViolations:string[]=[];
  for(const k of expectedKeys){
    if(!presentKeys.has(k)) foundPending=true;
    else if(foundPending) orderingViolations.push(k);
  }
  const version=Number(instance.server_version);
  const compatible=Number.isInteger(version)&&version>=180000&&version<190000;
  const ready=compatible&&ledgerExists&&pending.length===0&&changed.length===0&&
    unexpected.length===0&&orderingViolations.length===0;
  return Object.freeze({
    manifestSha256:manifest.digest,databaseName:instance.db_name,
    databaseRole:instance.db_user,serverVersion:instance.server_version,
    compatible,ledgerExists,applied:applied.length,
    pending:Object.freeze(pending),changed:Object.freeze(changed),
    unexpected:Object.freeze(unexpected),
    orderingViolations:Object.freeze(orderingViolations),ready,
  });
}
/** Guaranteed read-only, including on a DB with no migration ledger. */
export async function schemaStatus(pool:Pool,manifest:SchemaManifest):Promise<SchemaStatus>{
  return withTransaction(pool,client=>inspect(client,manifest),
    {readOnly:true,isolation:"repeatable read"});
}
export interface OperatorApproval {
  readonly targetDatabase:string;
  readonly expectedManifestSha256:string;
  readonly deploymentCommitSha:string;
  readonly backupEvidenceId:string;
  readonly backupVerifiedAt:string;
  readonly approvedByOperator:boolean;
}
export interface ApplyResult {
  readonly before:SchemaStatus;
  readonly after:SchemaStatus;
  readonly applied:readonly string[];
}
function approve(approval:OperatorApproval,manifest:SchemaManifest,dbName:string,now:Date){
  if (!approval.approvedByOperator) throw new SchemaOperationError("schema.operator_approval_required");
  if (approval.expectedManifestSha256!==manifest.digest ||
      !/^[0-9a-f]{64}$/u.test(approval.expectedManifestSha256)) {
    throw new SchemaOperationError("schema.manifest_pin_mismatch");
  }
  if (dbName!==approval.targetDatabase || !approval.targetDatabase) {
    throw new SchemaOperationError("schema.target_database_mismatch");
  }
  if (!/^[0-9a-f]{40}$/u.test(approval.deploymentCommitSha)) {
    throw new SchemaOperationError("schema.deployment_sha_unverified");
  }
  if(!/^[A-Za-z0-9._:/-]{8,240}$/u.test(approval.backupEvidenceId)) {
    throw new SchemaOperationError("schema.backup_evidence_missing");
  }
  const verification=Date.parse(approval.backupVerifiedAt);
  if(!/(Z|[+-][0-9]{2}:[0-9]{2})$/u.test(approval.backupVerifiedAt)||
     !Number.isFinite(verification)||verification>now.getTime()+60_000||
     now.getTime()-verification>24*60*60_000){
    throw new SchemaOperationError("schema.backup_attestation_stale");
  }
}
function ensureSafe(status:SchemaStatus){
  if(!status.compatible)throw new SchemaOperationError("schema.postgres_version_unsupported");
  if(status.changed.length||status.unexpected.length||status.orderingViolations.length) {
    throw new SchemaOperationError("schema.manifest_drift_or_unknown");
  }
}
async function applyWithin(
  client:PoolClient,manifest:SchemaManifest,approval:OperatorApproval,now:Date,
):Promise<ApplyResult>{
  // Cooperates with existing runMigrations lock. Status, apply and reinspection
  // are all inside the SAME serializable transaction, preventing any concurrent
  // migration writer from invalidating the preflight.
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '10min'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('masanawa:schema-migrations'))");
  const before=await inspect(client,manifest);
  approve(approval,manifest,before.databaseName,now);
  ensureSafe(before);
  if(!before.ledgerExists){
    await client.query(`CREATE TABLE public.masanawa_schema_migrations (
      owner text NOT NULL, name text NOT NULL, sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY(owner,name))`);
  }
  const missing=new Set(before.pending);
  const applied:string[]=[];
  for(const migration of manifest.migrations){
    const mkey=key(migration.owner,migration.name);
    if(!missing.has(mkey))continue;
    await client.query(migration.sql);
    await client.query(
      "INSERT INTO public.masanawa_schema_migrations(owner,name,sha256) VALUES ($1,$2,$3)",
      [migration.owner,migration.name,migration.sha256]);
    applied.push(mkey);
  }
  const after=await inspect(client,manifest);
  if(!after.ready) throw new SchemaOperationError("schema.postapply_not_ready");
  return Object.freeze({before,after,applied:Object.freeze(applied)});
}
export async function schemaApply(
  pool:Pool,manifest:SchemaManifest,approval:OperatorApproval,
  now:Date=new Date(),
):Promise<ApplyResult>{
  return withTransaction(pool,client=>applyWithin(client,manifest,approval,now),
    {isolation:"serializable"});
}
/**
 * Fresh-schema rehearsal on an already provisioned disposable PostgreSQL DB.
 * It NEVER drops a schema or touches production, and refuses a populated DB.
 */
export async function schemaBootstrapTest(
  pool:Pool,manifest:SchemaManifest,confirmation:{
    readonly expectedDatabase:string;readonly disposableConfirmed:boolean;
  },
):Promise<Readonly<{databaseName:string;manifestSha256:string;applied:readonly string[];idempotent:boolean;rollbackVerified:boolean}>>{
  if(!confirmation.disposableConfirmed ||
      !/^masanawa_test_[a-z0-9_]{5,60}$/u.test(confirmation.expectedDatabase)){
    throw new SchemaOperationError("schema.disposable_database_confirmation_required");
  }
  return withTransaction(pool,async client=>{
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '10min'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('masanawa:schema-migrations'))");
    const before=await inspect(client,manifest);
    if(before.databaseName!==confirmation.expectedDatabase ||
       before.ledgerExists||before.applied>0||!before.compatible) {
      throw new SchemaOperationError("schema.bootstrap_target_not_fresh");
    }
    const schemas=await client.query<{schema_name:string}&Record<string,unknown>>(
      "SELECT schema_name FROM information_schema.schemata "+
      "WHERE schema_name IN ('agents','commerce','events','identity','memory','security','skills','talks','world')"
    );
    if(schemas.rows.length!==0) throw new SchemaOperationError("schema.bootstrap_target_not_empty");
    const publicObjects=await client.query<{object_name:string}&Record<string,unknown>>(
      "SELECT c.relname AS object_name FROM pg_class c JOIN pg_namespace n "+
      "ON n.oid=c.relnamespace WHERE n.nspname='public' "+
      "AND c.relkind IN ('r','p','v','m','S','f','c') AND NOT EXISTS "+
      "(SELECT 1 FROM pg_depend dep WHERE dep.objid=c.oid "+
      "AND dep.deptype='e')");
    if(publicObjects.rows.length!==0) throw new SchemaOperationError("schema.bootstrap_public_not_empty");
    // PostgreSQL large objects live in a system catalog, not user schemas.
    // They can carry private binary user data even when public is apparently empty.
    const largeObjects=await client.query<{object_id:string}&Record<string,unknown>>(
      "SELECT oid::text AS object_id FROM pg_largeobject_metadata LIMIT 1"
    );
    if(largeObjects.rows.length!==0) {
      throw new SchemaOperationError("schema.bootstrap_large_objects_present");
    }
    // A disposable name alone is not proof of an empty database. Reject any
    // non-system namespace, including user data outside known Masanawa schemas.
    // The pre-existing extension objects in public are excluded from the
    // separate relation/routine/type checks, but custom schemas never pass.
    const otherSchemas=await client.query<{schema_name:string}&Record<string,unknown>>(
      "SELECT n.nspname AS schema_name FROM pg_namespace n "+
      "WHERE n.nspname NOT IN ('public','pg_catalog','information_schema') "+
      "AND n.nspname !~ '^pg_(toast|temp)(_|$)'"
    );
    if(otherSchemas.rows.length!==0) {
      throw new SchemaOperationError("schema.bootstrap_other_schemas_present");
    }
    // PostgreSQL procedures/functions and independent enum/domain/range types
    // can contain user-owned state or behavior even when pg_class has no tables.
    // Skip automatically derived array types (e.g., extension type arrays).\n    // Check before the first DDL; no schema, object or data is ever dropped.
    const publicRoutines=await client.query<{routine_name:string}&Record<string,unknown>>(
      "SELECT p.proname AS routine_name FROM pg_proc p "+
      "JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' "+
      "AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.objid=p.oid "+
      "AND dep.deptype='e')"
    );
    if(publicRoutines.rows.length!==0) {
      throw new SchemaOperationError("schema.bootstrap_public_routines_present");
    }
    const publicTypes=await client.query<{type_name:string}&Record<string,unknown>>(
      "SELECT t.typname AS type_name FROM pg_type t "+
      "JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' "+
      "AND t.typrelid=0 AND t.typcategory <> 'A' "+
      "AND t.typtype IN ('b','c','d','e','r','m') "+
      "AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.objid=t.oid "+
      "AND dep.deptype='e')"
    );
    if(publicTypes.rows.length!==0) {
      throw new SchemaOperationError("schema.bootstrap_public_types_present");
    }
    // Standalone definitions can outlive tables and routines. A database with
    // pre-existing collations, operators, text-search definitions, replication
    // publications or foreign connections is not an empty rehearsal target.
    // Extension-owned objects (e.g. pgvector) are installation prerequisites,
    // not orphaned user definitions. Only static catalog identifiers appear in
    // this SQL; no names or other caller-controlled values are interpolated.
    const publicDefinitions=await client.query<{object_kind:string}&Record<string,unknown>>(
      "SELECT object_kind FROM ("+
      [
        ["pg_collation","c","collnamespace","collation"],
        ["pg_conversion","c","connamespace","conversion"],
        ["pg_operator","o","oprnamespace","operator"],
        ["pg_ts_config","c","cfgnamespace","text_search_configuration"],
        ["pg_ts_dict","d","dictnamespace","text_search_dictionary"],
        ["pg_ts_parser","p","prsnamespace","text_search_parser"],
        ["pg_ts_template","t","tmplnamespace","text_search_template"],
      ].map(([catalog,alias,namespace,kind])=>
        "SELECT '"+kind+"'::text AS object_kind FROM "+catalog+" "+alias+
        " JOIN pg_namespace n ON n.oid="+alias+"."+namespace+
        " WHERE n.nspname='public' AND NOT EXISTS ("+
        "SELECT 1 FROM pg_depend dep WHERE dep.classid='"+catalog+"'::regclass"+
        " AND dep.objid="+alias+".oid AND dep.deptype='e')"
      ).concat(
        [
          ["pg_event_trigger","event_trigger"],
          ["pg_publication","publication"],
          ["pg_foreign_server","foreign_server"],
          ["pg_foreign_data_wrapper","foreign_data_wrapper"],
        ].map(([catalog,kind])=>
          "SELECT '"+kind+"'::text AS object_kind FROM "+catalog+" o"+
          " WHERE NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE "+
          "dep.classid='"+catalog+"'::regclass AND dep.objid=o.oid AND dep.deptype='e')"
        )
      ).join(" UNION ALL ")+
      ") existing LIMIT 1"
    );
    if(publicDefinitions.rows.length!==0) {
      throw new SchemaOperationError("schema.bootstrap_public_definitions_present");
    }
    // A savepoint must roll back a nontrivial write without destroying the
    // rest of the outer transaction (proving rollback behavior on this server).
    await client.query("SAVEPOINT schema_rollback_probe");
    await client.query("CREATE TABLE public.masanawa_schema_rollback_probe(value int)");
    await client.query("ROLLBACK TO SAVEPOINT schema_rollback_probe");
    const probe=await client.query<{exists:boolean}&Record<string,unknown>>(
      "SELECT to_regclass('public.masanawa_schema_rollback_probe') IS NOT NULL AS exists");
    if(probe.rows[0]?.exists!==false)throw new SchemaOperationError("schema.rollback_probe_failed");
    await client.query(`CREATE TABLE public.masanawa_schema_migrations (
      owner text NOT NULL,name text NOT NULL,sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY(owner,name))`);
    const applied:string[]=[];
    for(const m of manifest.migrations){
      await client.query(m.sql);
      await client.query("INSERT INTO public.masanawa_schema_migrations(owner,name,sha256) VALUES($1,$2,$3)",
        [m.owner,m.name,m.sha256]);
      applied.push(key(m.owner,m.name));
    }
    const after=await inspect(client,manifest);
    if(!after.ready || after.applied!==manifest.migrations.length) {
      throw new SchemaOperationError("schema.bootstrap_not_ready");
    }
    // No-op equivalence after a fresh migration, in the very same transaction.
    const again=await inspect(client,manifest);
    if(!again.ready||again.pending.length||again.applied!==after.applied) {
      throw new SchemaOperationError("schema.bootstrap_second_run_changed");
    }
    return Object.freeze({databaseName:after.databaseName,
      manifestSha256:manifest.digest,applied:Object.freeze(applied),
      idempotent:true,rollbackVerified:true});
  },{isolation:"serializable"});
}
