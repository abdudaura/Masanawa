#!/usr/bin/env node
// Operator-only, schema-only entrypoint. Never invoke alpha:bootstrap.
import { createPostgresPool } from "./pool.js";
import { platformProductMigrationRoots } from "./readiness.js";
import { runSchemaCli } from "./schema_admin/cli.js";

const exitCode=await runSchemaCli(process.argv.slice(2),{
  roots:platformProductMigrationRoots(),
  env:process.env,
  makePool:(connectionString)=>createPostgresPool({
    connectionString,applicationName:"masanawa-schema-operator",max:1,
    connectionTimeoutMs:5000,
  }),
  output:{
    out:(value)=>process.stdout.write(value+"\n"),
    err:(value)=>process.stderr.write(value+"\n"),
  },
});
process.exitCode=exitCode;
