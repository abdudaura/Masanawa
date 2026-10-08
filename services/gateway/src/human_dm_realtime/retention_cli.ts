/** Dedicated C03 cron/one-off CLI. Not part of HTTP/migration startup.
 * Requires operator opt-in and verified target before any mutation.
 */
import {createPostgresPool} from "@masanawa/postgres";
import {readHumanDmRetentionConfiguration} from "./retention_config.js";
import {pruneHumanDmJournal,verifyHumanDmRetentionTarget} from "./retention.js";

// Parse/validate all operator confirmations BEFORE even constructing the
// connection pool. Nothing automatically executes at Gateway startup.
const config=readHumanDmRetentionConfiguration(process.env);
const pool=createPostgresPool({
  connectionString:config.connectionString,
  applicationName:"masanawa-c03-private-event-retention",
  max:1,
});
try {
  // A backup reference remains an operator attestation; release Work must
  // inspect independent restore evidence before ever authorizing invocation.
  await verifyHumanDmRetentionTarget({
    pool,
    tenantId:config.tenantId,
    expectedDatabase:config.expectedDatabase,
  });
  const result=await pruneHumanDmJournal({
    pool,
    tenantId:config.tenantId,
    retentionDays:config.retentionDays,
    batchSize:config.batchSize,
    maxBatches:config.maxBatches,
  });
  process.stdout.write(JSON.stringify({
    event:"c03.retention.complete",...result,
  })+"\n");
} finally {
  await pool.end();
}
