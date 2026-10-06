import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  completeDevicePairing,
  createPostgresPool,
  deviceMigrationRoots,
  issueDevicePairingChallenge,
  listCharacterDeviceAssignments,
  putCharacterDeviceAssignment,
  readCharacterDeviceAssignment,
  registerDevice,
  runMigrations,
} from "@masanawa/postgres";

const connectionString=process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres=connectionString?describe:describe.skip;

describePostgres("Character Device assignment persistence acceptance",()=>{
  const databaseName=`masanawa_device_assign_${randomUUID().replaceAll("-","")}`;
  let admin:ReturnType<typeof createPostgresPool>;
  let pool:ReturnType<typeof createPostgresPool>;
  let created=false;

  beforeAll(async()=>{
    admin=createPostgresPool({connectionString:connectionString!,applicationName:"device-assignment-admin",max:1});
    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created=true;
    const url=new URL(connectionString!); url.pathname=`/${databaseName}`;
    pool=createPostgresPool({connectionString:url.toString(),applicationName:"device-assignment",max:4});
    await runMigrations(pool,deviceMigrationRoots());
  });
  afterAll(async()=>{
    try{
      await pool?.end();
      if(created){
        await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",[databaseName]);
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
    } finally { await admin?.end(); }
  });

  async function activeDevice(tenantId=createCanonicalId("tenant")){
    const d=await registerDevice(pool,{
      tenantId,enrollmentFingerprint:`enrollment-${randomUUID()}`,
      metadata:{deviceClass:"android_phone",platform:"android",platformVersion:"12",model:"TECNO Pop 7",appVersion:"1.0.0"},
      registeredAt:toInstant("2026-10-06T17:00:00.000Z"),
    });
    const challenge=await issueDevicePairingChallenge(pool,{
      tenantId,deviceId:d.deviceId,lifetimeMs:60_000,at:toInstant("2026-10-06T17:00:10.000Z"),
    });
    const paired=await completeDevicePairing(pool,{
      tenantId,deviceId:d.deviceId,pairingRequestId:challenge.challenge.pairingRequestId,
      secret:challenge.secret,at:toInstant("2026-10-06T17:00:20.000Z"),
    });
    return {tenantId,deviceId:paired.deviceId};
  }

  function assignment(scope:Awaited<ReturnType<typeof activeDevice>>,characterId=createCanonicalId("character")){
    const at=toInstant("2026-10-06T17:01:00.000Z");
    return {
      ...scope,characterId,role:"primary" as const,state:"active" as const,
      policy:{
        allowedCapabilityKeys:["telephony.call.place"],
        allowDegradedCapability:false,
        allowDegradedDeviceHealth:false,
      },
      validFrom:at,validUntil:null,revision:1,createdAt:at,updatedAt:at,
    };
  }

  it("creates and exactly replays one immutable assignment",async()=>{
    const scope=await activeDevice();
    const value=assignment(scope);
    const stored=await putCharacterDeviceAssignment(pool,{assignment:value,expectedRevision:null});
    expect(stored).toEqual(value);
    await expect(putCharacterDeviceAssignment(pool,{assignment:value,expectedRevision:null}))
      .resolves.toEqual(value);

    await expect(putCharacterDeviceAssignment(pool,{
      assignment:{...value,policy:{...value.policy,allowedCapabilityKeys:["sms.send"]}},
      expectedRevision:null,
    })).rejects.toMatchObject({code:"devices.assignment_conflict"});
  });

  it("uses CAS lifecycle updates and supports exact update replay",async()=>{
    const scope=await activeDevice();
    const initial=assignment(scope);
    await putCharacterDeviceAssignment(pool,{assignment:initial,expectedRevision:null});
    const suspended={...initial,state:"suspended" as const,revision:2,updatedAt:toInstant("2026-10-06T17:02:00.000Z")};
    await expect(putCharacterDeviceAssignment(pool,{assignment:suspended,expectedRevision:1}))
      .resolves.toEqual(suspended);
    await expect(putCharacterDeviceAssignment(pool,{assignment:suspended,expectedRevision:1}))
      .resolves.toEqual(suspended);

    await expect(putCharacterDeviceAssignment(pool,{
      assignment:{...suspended,state:"active" as const,revision:4,updatedAt:toInstant("2026-10-06T17:03:00.000Z")},
      expectedRevision:2,
    })).rejects.toMatchObject({code:"devices.assignment_transition_invalid"});
  });

  it("can revoke assignment after the Device itself is suspended",async()=>{
    const scope=await activeDevice();
    const initial=assignment(scope);
    await putCharacterDeviceAssignment(pool,{assignment:initial,expectedRevision:null});
    await pool.query(
      "UPDATE devices.devices SET state='suspended',updated_at=$3 WHERE tenant_id=$1 AND device_id=$2",
      [scope.tenantId,scope.deviceId,toInstant("2026-10-06T17:02:00.000Z")]
    );
    const revoked={...initial,state:"revoked" as const,revision:2,updatedAt:toInstant("2026-10-06T17:03:00.000Z")};
    await expect(putCharacterDeviceAssignment(pool,{assignment:revoked,expectedRevision:1}))
      .resolves.toEqual(revoked);
  });

  it("creates replacement Device assignment without changing Character identity",async()=>{
    const originalScope=await activeDevice();
    const replacementScope=await activeDevice(originalScope.tenantId);
    const characterId=createCanonicalId("character");
    const original=assignment(originalScope,characterId);
    const replacement=assignment(replacementScope,characterId);
    await putCharacterDeviceAssignment(pool,{assignment:original,expectedRevision:null});
    await putCharacterDeviceAssignment(pool,{assignment:replacement,expectedRevision:null});
    const listed=await listCharacterDeviceAssignments(pool,{tenantId:originalScope.tenantId,characterId});
    expect(listed).toHaveLength(2);
    expect(listed.every(x=>x.characterId===characterId)).toBe(true);
    expect(new Set(listed.map(x=>x.deviceId))).toEqual(
      new Set([originalScope.deviceId,replacementScope.deviceId]),
    );
  });

  it("filters revoked assignments by default and can include durable history",async()=>{
    const scope=await activeDevice();
    const initial=assignment(scope);
    await putCharacterDeviceAssignment(pool,{assignment:initial,expectedRevision:null});
    const revoked={...initial,state:"revoked" as const,revision:2,updatedAt:toInstant("2026-10-06T17:02:00.000Z")};
    await putCharacterDeviceAssignment(pool,{assignment:revoked,expectedRevision:1});

    await expect(listCharacterDeviceAssignments(pool,{tenantId:scope.tenantId,characterId:initial.characterId}))
      .resolves.toEqual([]);
    const history=await listCharacterDeviceAssignments(pool,{tenantId:scope.tenantId,characterId:initial.characterId,includeRevoked:true});
    expect(history).toHaveLength(1);
    expect(history[0]?.state).toBe("revoked");
  });

  it("isolates cross-Tenant reads and rejects creation on inactive Device",async()=>{
    const scope=await activeDevice();
    const initial=assignment(scope);
    await putCharacterDeviceAssignment(pool,{assignment:initial,expectedRevision:null});
    await expect(readCharacterDeviceAssignment(pool,{
      tenantId:createCanonicalId("tenant"),characterId:initial.characterId,deviceId:scope.deviceId,
    })).resolves.toBeNull();

    const inactiveScope=await activeDevice();
    await pool.query(
      "UPDATE devices.devices SET state='suspended',updated_at=$3 WHERE tenant_id=$1 AND device_id=$2",
      [inactiveScope.tenantId,inactiveScope.deviceId,toInstant("2026-10-06T17:04:00.000Z")]
    );
    await expect(putCharacterDeviceAssignment(pool,{assignment:assignment(inactiveScope),expectedRevision:null}))
      .rejects.toMatchObject({code:"devices.not_active"});
  });
});
