/** C03 one-off maintenance configuration.
 * Fail closed BEFORE constructing any SQL pool or opening a DB connection.
 * Operator-provided backup IDs are attestations; never proof of restorable data.
 */
export interface HumanDmRetentionConfiguration {
  readonly connectionString: string;
  readonly tenantId: string;
  readonly expectedDatabase: string;
  readonly retentionDays: number;
  readonly batchSize: number;
  readonly maxBatches: number;
}
export function readHumanDmRetentionConfiguration(
  env: Readonly<Record<string, string | undefined>>,
): HumanDmRetentionConfiguration {
  function required(name:string):string {
    const value=env[name];
    if(!value || !value.trim() || value!==value.trim()) {
      throw new Error(`Missing or malformed required ${name}`);
    }
    return value;
  }
  function integer(name:string,defaultValue:number):number {
    const value=env[name];
    if(value===undefined)return defaultValue;
    if(!/^[1-9][0-9]*$/u.test(value))throw new Error(`Invalid ${name}`);
    const parsed=Number(value);
    if(!Number.isSafeInteger(parsed))throw new Error(`Invalid ${name}`);
    return parsed;
  }
  if(env.MASANAWA_C03_RETENTION_OPERATOR_CONFIRM!=="I_UNDERSTAND_PRUNING") {
    throw new Error("C03 private journal retention requires explicit operator confirmation");
  }
  const tenantId=required("MASANAWA_C03_RETENTION_TENANT");
  if(tenantId.length>256 ||
      required("MASANAWA_C03_RETENTION_CONFIRM_TENANT")!==tenantId) {
    throw new Error("C03 maintenance tenant does not match the confirmation");
  }
  const expectedDatabase=required("MASANAWA_C03_RETENTION_EXPECT_DATABASE");
  if(expectedDatabase.length>128)throw new Error("Invalid expected C03 database name");
  const backupReference=required("MASANAWA_C03_RETENTION_BACKUP_REF");
  if(backupReference.length<8)throw new Error("A backup reference must be attested");
  const config:HumanDmRetentionConfiguration={
    connectionString:required("MASANAWA_DATABASE_URL"),
    tenantId,expectedDatabase,
    retentionDays:integer("MASANAWA_C03_RETENTION_DAYS",30),
    batchSize:integer("MASANAWA_C03_RETENTION_BATCH_SIZE",500),
    maxBatches:integer("MASANAWA_C03_RETENTION_MAX_BATCHES",20),
  };
  // Duplicate validation is deliberate: exported operator bounds all callers,
  // and this parser blocks invalid env BEFORE even constructing the DB pool.
  if(config.retentionDays<7 || config.retentionDays>365 ||
     config.batchSize<1 || config.batchSize>1000 ||
     config.maxBatches<1 || config.maxBatches>100) {
    throw new Error("Unsafe C03 retention batch/age limits");
  }
  return Object.freeze(config);
}
