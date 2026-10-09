import { readRequiredEnv } from "@masanawa/contracts";
import {
  createPostgresPool,
  createPostgresAccountDeletionQueue,
  createPostgresDeletionFinancialPreflight,
} from "@masanawa/postgres";
import { createAccountDeletionRunner } from "./account-deletion-runner.js";

export async function startAccountDeletionReconciliation(
  env: Readonly<Record<string,string|undefined>> = process.env,
  signals: Pick<NodeJS.Process,"on"> = process,
): Promise<void> {
  // Only a reconciliation process. Never enables account erasure or
  // bypasses provider cleanup. This is deliberately NOT in worker /readyz.
  if (env.MASANAWA_ACCOUNT_DELETION_RECONCILIATION_ENABLED !== "true") {
    throw new Error("account_deletion.reconciliation_not_enabled");
  }
  const connectionString = readRequiredEnv({
    DATABASE_URL: env.MASANAWA_DATABASE_URL ?? env.DATABASE_URL,
  },"DATABASE_URL");
  const pool = createPostgresPool({
    connectionString,
    applicationName: "masanawa-deletion-reconciliation",
    max: 3,
  });
  const queue = createPostgresAccountDeletionQueue(pool);
  const financial = createPostgresDeletionFinancialPreflight(pool);
  const runner = createAccountDeletionRunner({queue,financial});
  let closing = false;
  const stop = () => { closing = true; };
  signals.on("SIGTERM",stop);
  signals.on("SIGINT",stop);
  try {
    while (!closing) {
      try {
        const outcome = await runner.runOnce();
        if (outcome !== "idle") {
          process.stdout.write(JSON.stringify({
            event: "account_deletion.reconciliation_tick",outcome,
          }) + "\n");
        }
      } catch {
        process.stderr.write(JSON.stringify({
          event:"account_deletion.reconciliation_retry",
        })+"\n");
      }
      if(!closing)await new Promise<void>(resolve=>setTimeout(resolve,10_000));
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("/account-deletion-main.js")) {
  void startAccountDeletionReconciliation().catch(() => {
    process.exitCode=1;
  });
}
