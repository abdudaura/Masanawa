import type { Pool } from "pg";
import type { MigrationRoot } from "../migrations.js";
import { loadSchemaManifest } from "./manifest.js";
import {
  SchemaOperationError,schemaApply,schemaBootstrapTest,schemaStatus,
  type OperatorApproval,
} from "./operations.js";

export interface SchemaCliOutput {
  out(value:string):void;
  err(value:string):void;
}
export interface SchemaCliDependencies {
  readonly roots:readonly MigrationRoot[];
  readonly makePool:(connectionString:string)=>Pool;
  readonly env:Readonly<Record<string,string|undefined>>;
  readonly output:SchemaCliOutput;
  readonly now?:()=>Date;
}
const allowed=new Set(["manifest","status","readiness","apply","bootstrap:test"]);
function required(env:Readonly<Record<string,string|undefined>>,name:string):string{
  const value=env[name]?.trim();
  if(!value)throw new SchemaOperationError("schema.required_env_missing_"+name.toLowerCase());
  return value;
}
const positiveApproval="I_APPROVE_SCHEMA_ONLY_MIGRATION";
const disposableApproval="I_CONFIRM_EMPTY_DISPOSABLE_TEST_DATABASE";
function write(output:SchemaCliOutput,value:unknown){
  output.out(JSON.stringify(value));
}
/**
 * DB credentials are env-only. No arbitrary migration directories, SQL, URLs,
 * backup contents, or credentials are accepted on argv or printed in results.
 * Exit codes: 0 success, 2 not-ready, 3 blocked/error.
 */
export async function runSchemaCli(args:readonly string[],dependencies:SchemaCliDependencies):Promise<number>{
  const {env,output}=dependencies;
  if(args.length!==1 || !allowed.has(args[0]!)){
    output.err("schema.usage: manifest|status|readiness|apply|bootstrap:test");
    return 3;
  }
  let pool:Pool|undefined;
  try {
    const command=args[0]!;
    const manifest=await loadSchemaManifest(dependencies.roots);
    if(command==="manifest"){
      write(output,{schemaVersion:1,manifestSha256:manifest.digest,
        migrationCount:manifest.migrations.length,
        migrations:manifest.migrations.map(x=>({
          owner:x.owner,name:x.name,sha256:x.sha256,
        }))});
      return 0;
    }
    pool=dependencies.makePool(required(env,"MASANAWA_DATABASE_URL"));
    if(command==="status" || command==="readiness"){
      const status=await schemaStatus(pool,manifest);
      write(output,{command,...status});
      return command==="readiness"&&!status.ready?2:0;
    }
    if(command==="apply"){
      const approval:OperatorApproval={
        targetDatabase:required(env,"MASANAWA_DB_EXPECTED_NAME"),
        expectedManifestSha256:required(env,"MASANAWA_DB_EXPECTED_MANIFEST_SHA256"),
        deploymentCommitSha:required(env,"MASANAWA_DB_DEPLOYMENT_SHA"),
        backupEvidenceId:required(env,"MASANAWA_DB_BACKUP_EVIDENCE_ID"),
        backupVerifiedAt:required(env,"MASANAWA_DB_BACKUP_VERIFIED_AT"),
        approvedByOperator:env.MASANAWA_DB_APPLY_APPROVAL===positiveApproval,
      };
      const result=await schemaApply(pool,manifest,approval,dependencies.now?.()??new Date());
      write(output,{command,manifestSha256:manifest.digest,databaseName:result.after.databaseName,
        applied:result.applied,ready:result.after.ready});
      return 0;
    }
    // Bootstrap runs only on newly provisioned, EMPTY, explicitly named test DB.
    const result=await schemaBootstrapTest(pool,manifest,{
      expectedDatabase:required(env,"MASANAWA_DB_EXPECTED_NAME"),
      disposableConfirmed:env.MASANAWA_DB_TEST_DISPOSABLE_ACK===disposableApproval,
    });
    write(output,{command,...result});
    return 0;
  }catch(error){
    output.err(error instanceof SchemaOperationError?error.code:
      "schema.operation_failed_check_private_logs");
    return 3;
  }finally{
    if(pool){
      try{await pool.end();}
      catch{output.err("schema.connection_close_failed");}
    }
  }
}
