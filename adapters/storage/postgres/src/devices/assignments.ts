import {
  PlatformError,
  toInstant,
  type CharacterId,
  type DeviceId,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

export type StoredAssignmentRole = "primary" | "secondary" | "pooled";
export type StoredAssignmentState = "active" | "suspended" | "revoked";

export interface StoredCharacterDeviceAssignment {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly deviceId: DeviceId;
  readonly role: StoredAssignmentRole;
  readonly state: StoredAssignmentState;
  readonly policy: Readonly<{
    allowedCapabilityKeys: readonly string[];
    allowDegradedCapability: boolean;
    allowDegradedDeviceHealth: boolean;
  }>;
  readonly validFrom: Instant;
  readonly validUntil: Instant | null;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

interface AssignmentRow {
  tenant_id: TenantId;
  character_id: CharacterId;
  device_id: DeviceId;
  role: StoredAssignmentRole;
  state: StoredAssignmentState;
  allowed_capability_keys: string[];
  allow_degraded_capability: boolean;
  allow_degraded_device_health: boolean;
  valid_from: Date;
  valid_until: Date | null;
  revision: string;
  assignment_fingerprint: string;
  created_at: Date;
  updated_at: Date;
}

const columns=`
 tenant_id, character_id, device_id, role, state,
 allowed_capability_keys, allow_degraded_capability,
 allow_degraded_device_health, valid_from, valid_until,
 revision::text, assignment_fingerprint, created_at, updated_at
`;
const keyPattern=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function normalize(input: StoredCharacterDeviceAssignment): StoredCharacterDeviceAssignment {
  if (!["primary","secondary","pooled"].includes(input.role)) throw new TypeError("assignment role is invalid");
  if (!["active","suspended","revoked"].includes(input.state)) throw new TypeError("assignment state is invalid");
  if (!Number.isSafeInteger(input.revision)||input.revision<1) throw new RangeError("assignment revision is invalid");
  if (!Array.isArray(input.policy.allowedCapabilityKeys)||input.policy.allowedCapabilityKeys.length<1||input.policy.allowedCapabilityKeys.length>128) {
    throw new RangeError("assignment capability policy is invalid");
  }
  const keys=input.policy.allowedCapabilityKeys.map((raw)=>{
    const key=raw.trim().toLowerCase();
    if(!keyPattern.test(key)||key.length>160) throw new TypeError("assignment capability key is invalid");
    return key;
  }).sort();
  if(new Set(keys).size!==keys.length) throw new TypeError("assignment capability keys must be unique");
  const createdAt=toInstant(input.createdAt);
  const updatedAt=toInstant(input.updatedAt);
  const validFrom=toInstant(input.validFrom);
  const validUntil=input.validUntil===null?null:toInstant(input.validUntil);
  if(Date.parse(validFrom)<Date.parse(createdAt)) throw new TypeError("assignment validFrom cannot precede creation");
  if(validUntil!==null&&Date.parse(validUntil)<=Date.parse(validFrom)) throw new TypeError("assignment validUntil must follow validFrom");
  if(Date.parse(updatedAt)<Date.parse(createdAt)) throw new TypeError("assignment updatedAt cannot precede creation");
  return Object.freeze({
    tenantId:input.tenantId,characterId:input.characterId,deviceId:input.deviceId,
    role:input.role,state:input.state,
    policy:Object.freeze({
      allowedCapabilityKeys:Object.freeze(keys),
      allowDegradedCapability:Boolean(input.policy.allowDegradedCapability),
      allowDegradedDeviceHealth:Boolean(input.policy.allowDegradedDeviceHealth),
    }),
    validFrom,validUntil,revision:input.revision,createdAt,updatedAt,
  });
}
function fingerprint(input:StoredCharacterDeviceAssignment){ return fingerprintCanonicalJson(input); }
function fromRow(row:AssignmentRow):StoredCharacterDeviceAssignment {
  return Object.freeze({
    tenantId:row.tenant_id,characterId:row.character_id,deviceId:row.device_id,
    role:row.role,state:row.state,
    policy:Object.freeze({
      allowedCapabilityKeys:Object.freeze([...row.allowed_capability_keys].sort()),
      allowDegradedCapability:row.allow_degraded_capability,
      allowDegradedDeviceHealth:row.allow_degraded_device_health,
    }),
    validFrom:toInstant(row.valid_from),
    validUntil:row.valid_until?toInstant(row.valid_until):null,
    revision:Number(row.revision),
    createdAt:toInstant(row.created_at),
    updatedAt:toInstant(row.updated_at),
  });
}
async function load(client:PoolClient,input:{tenantId:TenantId;characterId:CharacterId;deviceId:DeviceId},forUpdate=false){
  const r=await client.query<AssignmentRow>(
    `SELECT ${columns} FROM devices.character_device_assignments
      WHERE tenant_id=$1 AND character_id=$2 AND device_id=$3
      ${forUpdate?"FOR UPDATE":""}`,
    [input.tenantId,input.characterId,input.deviceId]
  );
  return r.rows[0]??null;
}
async function requireDevice(client:PoolClient,tenantId:TenantId,deviceId:DeviceId,activeRequired:boolean){
  const r=await client.query<{state:string}>(
    "SELECT state FROM devices.devices WHERE tenant_id=$1 AND device_id=$2 FOR UPDATE",
    [tenantId,deviceId]
  );
  if(!r.rows[0]) throw new PlatformError({code:"devices.not_found",category:"not-found",message:"Device does not exist in the requested tenant",retryable:false});
  if(activeRequired&&r.rows[0].state!=="active") throw new PlatformError({code:"devices.not_active",category:"authorization",message:"Device is not active",retryable:false});
}
function immutableSame(a:StoredCharacterDeviceAssignment,b:StoredCharacterDeviceAssignment){
  return a.tenantId===b.tenantId&&a.characterId===b.characterId&&a.deviceId===b.deviceId&&a.role===b.role&&
    JSON.stringify(a.policy)===JSON.stringify(b.policy)&&a.validFrom===b.validFrom&&a.validUntil===b.validUntil&&a.createdAt===b.createdAt;
}
function validTransition(from:StoredAssignmentState,to:StoredAssignmentState){
  return (from==="active"&&(to==="suspended"||to==="revoked"))||
    (from==="suspended"&&(to==="active"||to==="revoked"));
}

export async function putCharacterDeviceAssignment(
  pool:Pool,
  input:{readonly assignment:StoredCharacterDeviceAssignment; readonly expectedRevision:number|null},
):Promise<StoredCharacterDeviceAssignment>{
  const assignment=normalize(input.assignment);
  const fp=fingerprint(assignment);
  return withTransaction(pool,async(client)=>{
    const row=await load(client,assignment,true);
    await requireDevice(client,assignment.tenantId,assignment.deviceId,!row);
    if(!row){
      if(input.expectedRevision!==null) throw new PlatformError({code:"devices.assignment_not_found",category:"not-found",message:"Character Device assignment does not exist",retryable:false});
      if(assignment.revision!==1||assignment.state!=="active") throw new TypeError("new assignment must be active at revision one");
      await client.query(
        `INSERT INTO devices.character_device_assignments(
          tenant_id,character_id,device_id,role,state,allowed_capability_keys,
          allow_degraded_capability,allow_degraded_device_health,valid_from,valid_until,
          revision,assignment_fingerprint,created_at,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [assignment.tenantId,assignment.characterId,assignment.deviceId,assignment.role,assignment.state,
         assignment.policy.allowedCapabilityKeys,assignment.policy.allowDegradedCapability,
         assignment.policy.allowDegradedDeviceHealth,assignment.validFrom,assignment.validUntil,
         assignment.revision,fp,assignment.createdAt,assignment.updatedAt]
      );
      return assignment;
    }
    const current=fromRow(row);
    if(row.assignment_fingerprint===fp) return current;
    if(input.expectedRevision===null) throw new PlatformError({code:"devices.assignment_conflict",category:"conflict",message:"Character Device assignment already exists with different policy",retryable:false});
    if(current.revision!==input.expectedRevision) throw new PlatformError({code:"devices.assignment_revision_stale",category:"conflict",message:"Character Device assignment revision is stale",retryable:false});
    if(!immutableSame(current,assignment)) throw new PlatformError({code:"devices.assignment_immutable_conflict",category:"conflict",message:"Character Device assignment immutable policy cannot change",retryable:false});
    if(assignment.revision!==current.revision+1||!validTransition(current.state,assignment.state)) {
      throw new PlatformError({code:"devices.assignment_transition_invalid",category:"conflict",message:"Character Device assignment lifecycle transition is invalid",retryable:false});
    }
    if(Date.parse(assignment.updatedAt)<Date.parse(current.updatedAt)) throw new TypeError("assignment updatedAt cannot move backwards");
    const updated=await client.query<AssignmentRow>(
      `UPDATE devices.character_device_assignments
          SET state=$4, revision=$5, assignment_fingerprint=$6, updated_at=$7
        WHERE tenant_id=$1 AND character_id=$2 AND device_id=$3 AND revision=$8
        RETURNING ${columns}`,
      [assignment.tenantId,assignment.characterId,assignment.deviceId,assignment.state,
       assignment.revision,fp,assignment.updatedAt,current.revision]
    );
    if(updated.rowCount!==1) throw new PlatformError({code:"devices.assignment_revision_stale",category:"conflict",message:"Character Device assignment changed concurrently",retryable:true});
    return fromRow(updated.rows[0]!);
  });
}

export async function readCharacterDeviceAssignment(
  pool:Pool,input:{readonly tenantId:TenantId;readonly characterId:CharacterId;readonly deviceId:DeviceId},
):Promise<StoredCharacterDeviceAssignment|null>{
  const r=await pool.query<AssignmentRow>(
    `SELECT ${columns} FROM devices.character_device_assignments
      WHERE tenant_id=$1 AND character_id=$2 AND device_id=$3`,
    [input.tenantId,input.characterId,input.deviceId]
  );
  return r.rows[0]?fromRow(r.rows[0]):null;
}

export async function listCharacterDeviceAssignments(
  pool:Pool,input:{readonly tenantId:TenantId;readonly characterId:CharacterId;readonly includeRevoked?:boolean},
):Promise<readonly StoredCharacterDeviceAssignment[]>{
  const r=await pool.query<AssignmentRow>(
    `SELECT ${columns} FROM devices.character_device_assignments
      WHERE tenant_id=$1 AND character_id=$2
        AND ($3::boolean OR state <> 'revoked')
      ORDER BY role ASC, device_id ASC`,
    [input.tenantId,input.characterId,input.includeRevoked===true]
  );
  return Object.freeze(r.rows.map(fromRow));
}
