/** Dedicated C03 cron/one-off CLI. Not part of the Gateway HTTP startup.
 * Requires explicit operator opt-in; never runs implicitly on migration.
 */
import {createPostgresPool} from "@masanawa/postgres";
import {pruneHumanDmJournal,verifyHumanDmRetentionTarget} from "./retention.js";

function required(name:string):string {
  const value=process.env[name];
  if(!value?.trim())throw new Error(`Missing required ${name}`);
  return value;
}
function integer(name:string,defaultValue:number):number {
  const value=process.env[name];
  if(value===undefined)return defaultValue;
  if(!/^[1-9][0-9]*$/u.test(value))throw new Error(`Invalid ${name}`);
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed))throw new Error(`Invalid ${name}`);
  return parsed;
}
if(process.env.MASANAWA_C03_RETENTION_OPERATOR_CONFIRM!=="I_UNDERSTAND_PRUNING") {
  throw new Error("C03 journal pruning requires an explicit operator confirmation");
}
const pool=createPostgresPool({
  connectionString:required("MASANAWA_DATABASE_URL"),
  applicationName:"masanawa-c03-private-event-retention",
  max:1,
});
try {
  const tenantId=required("MASANAWA_C03_RETENTION_TENANT");
  const expectedDatabase=required("MASANAWA_C03_RETENTION_EXPECT_DATABASE");
  const backupReference=required("MASANAWA_C03_RETENTION_BACKUP_REF");
  if(backupReference.length<8 ||
      required("MASANAWA_C03_RETENTION_CONFIRM_TENANT")!==tenantId) {
    throw new Error("C03 tenant confirmation or backup reference invalid");
  }
  // A reference is an operator attestation, NOT proof of a restorable backup.
  // The release owner must independently verify the backup/restore evidence.
  await verifyHumanDmRetentionTarget({pool,tenantId,expectedDatabase});
  const result=await pruneHumanDmJournal({
    pool,tenantId,
    retentionDays:integer("MASANAWA_C03_RETENTION_DAYS",30),
    batchSize:integer("MASANAWA_C03_RETENTION_BATCH_SIZE",500),
    maxBatches:integer("MASANAWA_C03_RETENTION_MAX_BATCHES",20),
  });
  process.stdout.write(JSON.stringify({
    event:"c03.retention.complete",...result,
  })+"\n");
} finally {
  await pool.end();
}
