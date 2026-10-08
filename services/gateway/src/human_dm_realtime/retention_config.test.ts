import {describe,expect,it} from "vitest";
import {readHumanDmRetentionConfiguration} from "./retention_config.js";

const good:Record<string,string>={
  MASANAWA_C03_RETENTION_OPERATOR_CONFIRM:"I_UNDERSTAND_PRUNING",
  MASANAWA_C03_RETENTION_TENANT:"tenant_test_01",
  MASANAWA_C03_RETENTION_CONFIRM_TENANT:"tenant_test_01",
  MASANAWA_C03_RETENTION_EXPECT_DATABASE:"masanawa_c03_test",
  MASANAWA_C03_RETENTION_BACKUP_REF:"disposable-test-restore-20261008",
  MASANAWA_DATABASE_URL:"postgresql://localhost/masanawa_c03_test",
};
describe("C03 operator confirmation must pass before opening a PostgreSQL pool",()=>{
  it("parses exact confirmation with conservative defaults and no accidental output of secret",()=>{
    const config=readHumanDmRetentionConfiguration(good);
    expect(config).toEqual({
      connectionString:good.MASANAWA_DATABASE_URL,
      tenantId:"tenant_test_01",
      expectedDatabase:"masanawa_c03_test",
      retentionDays:30,
      batchSize:500,
      maxBatches:20,
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(JSON.stringify(config)).not.toContain("disposable-test-restore-20261008");
  });
  it("requires all attestation, DB, tenant and mode envs",()=>{
    for(const name of Object.keys(good)){
      const env:Record<string,string|undefined>={...good};
      env[name]=undefined;
      expect(()=>readHumanDmRetentionConfiguration(env)).toThrow();
    }
    expect(()=>readHumanDmRetentionConfiguration({
      ...good,MASANAWA_C03_RETENTION_OPERATOR_CONFIRM:"yes",
    })).toThrow("explicit operator");
    expect(()=>readHumanDmRetentionConfiguration({
      ...good,MASANAWA_C03_RETENTION_CONFIRM_TENANT:"another",
    })).toThrow("tenant does not match");
    expect(()=>readHumanDmRetentionConfiguration({
      ...good,MASANAWA_C03_RETENTION_BACKUP_REF:"fake",
    })).toThrow();
    expect(()=>readHumanDmRetentionConfiguration({
      ...good,MASANAWA_C03_RETENTION_TENANT:" tenant_test_01",
      MASANAWA_C03_RETENTION_CONFIRM_TENANT:" tenant_test_01",
    })).toThrow("malformed");
  });
  it("rejects unsafe retention parameters even if the explicit confirmation is set",()=>{
    const variants: Array<readonly [string,string]>=[
      ["MASANAWA_C03_RETENTION_DAYS","6"],
      ["MASANAWA_C03_RETENTION_DAYS","366"],
      ["MASANAWA_C03_RETENTION_DAYS","NaN"],
      ["MASANAWA_C03_RETENTION_DAYS","1.2"],
      ["MASANAWA_C03_RETENTION_BATCH_SIZE","1001"],
      ["MASANAWA_C03_RETENTION_BATCH_SIZE","0"],
      ["MASANAWA_C03_RETENTION_MAX_BATCHES","101"],
      ["MASANAWA_C03_RETENTION_MAX_BATCHES","-1"],
      ["MASANAWA_C03_RETENTION_MAX_BATCHES","001"],
      ["MASANAWA_C03_RETENTION_MAX_BATCHES","9999999999999999999999"],
    ];
    for(const [name,value] of variants){
      expect(()=>readHumanDmRetentionConfiguration({...good,[name]:value}))
        .toThrow();
    }
  });
  it("preserves specifically approved overrides without changing user-facing services",()=>{
    expect(readHumanDmRetentionConfiguration({
      ...good,
      MASANAWA_C03_RETENTION_DAYS:"90",
      MASANAWA_C03_RETENTION_BATCH_SIZE:"20",
      MASANAWA_C03_RETENTION_MAX_BATCHES:"2",
    })).toMatchObject({retentionDays:90,batchSize:20,maxBatches:2});
  });
});
