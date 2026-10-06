import {
  PlatformError,
  toInstant,
  type DeviceCredentialId,
  type DeviceId,
  type Instant,
  type RequestId,
  type TenantId,
} from "@masanawa/contracts";
import {
  fingerprintCanonicalJson,
  type DeviceOperationalCredential,
  type DeviceReconnectChallenge,
} from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface CredentialRow {
  tenant_id: TenantId;
  device_credential_id: DeviceCredentialId;
  device_id: DeviceId;
  generation: string;
  state: DeviceOperationalCredential["state"];
  verification_key_ref: string;
  key_fingerprint: string;
  issued_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revision: string;
  credential_fingerprint: string;
}
interface ChallengeRow {
  tenant_id: TenantId;
  request_id: RequestId;
  device_id: DeviceId;
  device_credential_id: DeviceCredentialId;
  credential_generation: string;
  challenge_digest: string;
  state: DeviceReconnectChallenge["state"];
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
  revision: string;
  challenge_fingerprint: string;
}
const credentialColumns = `
 tenant_id, device_credential_id, device_id, generation::text, state,
 verification_key_ref, key_fingerprint, issued_at, expires_at, revoked_at,
 revision::text, credential_fingerprint`;
const challengeColumns = `
 tenant_id, request_id, device_id, device_credential_id,
 credential_generation::text, challenge_digest, state, created_at, expires_at,
 consumed_at, revision::text, challenge_fingerprint`;

function credentialRecord(row: CredentialRow): DeviceOperationalCredential {
  return Object.freeze({
    tenantId: row.tenant_id,
    deviceCredentialId: row.device_credential_id,
    deviceId: row.device_id,
    generation: Number(row.generation),
    state: row.state,
    verificationKeyRef: row.verification_key_ref,
    keyFingerprint: row.key_fingerprint,
    issuedAt: toInstant(row.issued_at),
    expiresAt: toInstant(row.expires_at),
    revokedAt: row.revoked_at ? toInstant(row.revoked_at) : null,
    revision: Number(row.revision),
  });
}
function challengeRecord(row: ChallengeRow): DeviceReconnectChallenge {
  return Object.freeze({
    tenantId: row.tenant_id,
    requestId: row.request_id,
    deviceId: row.device_id,
    deviceCredentialId: row.device_credential_id,
    credentialGeneration: Number(row.credential_generation),
    challengeDigest: row.challenge_digest,
    state: row.state,
    createdAt: toInstant(row.created_at),
    expiresAt: toInstant(row.expires_at),
    consumedAt: row.consumed_at ? toInstant(row.consumed_at) : null,
    revision: Number(row.revision),
  });
}
function credentialFingerprint(value: DeviceOperationalCredential) {
  return fingerprintCanonicalJson(value);
}
function challengeFingerprint(value: DeviceReconnectChallenge) {
  return fingerprintCanonicalJson(value);
}
async function requireDevice(
  client: PoolClient,
  tenantId: TenantId,
  deviceId: DeviceId,
  activeRequired: boolean,
) {
  const r = await client.query<{ state: string }>(
    "SELECT state FROM devices.devices WHERE tenant_id=$1 AND device_id=$2 FOR UPDATE",
    [tenantId, deviceId],
  );
  if (!r.rows[0]) {
    throw new PlatformError({
      code: "devices.not_found",
      category: "not-found",
      message: "Device does not exist in the requested tenant",
      retryable: false,
    });
  }
  if (activeRequired && r.rows[0].state !== "active") {
    throw new PlatformError({
      code: "devices.not_active",
      category: "authorization",
      message: "Device is not active",
      retryable: false,
    });
  }
}
async function loadCredential(
  client: PoolClient,
  tenantId: TenantId,
  deviceCredentialId: DeviceCredentialId,
  forUpdate = false,
): Promise<CredentialRow | null> {
  const r = await client.query<CredentialRow>(
    `SELECT ${credentialColumns}
       FROM devices.operational_credentials
      WHERE tenant_id=$1 AND device_credential_id=$2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, deviceCredentialId],
  );
  return r.rows[0] ?? null;
}
async function loadChallenge(
  client: PoolClient,
  tenantId: TenantId,
  requestId: RequestId,
  forUpdate = false,
): Promise<ChallengeRow | null> {
  const r = await client.query<ChallengeRow>(
    `SELECT ${challengeColumns}
       FROM devices.reconnect_challenges
      WHERE tenant_id=$1 AND request_id=$2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, requestId],
  );
  return r.rows[0] ?? null;
}
function sameCredentialIdentity(a: DeviceOperationalCredential, b: DeviceOperationalCredential) {
  return a.tenantId===b.tenantId && a.deviceCredentialId===b.deviceCredentialId &&
    a.deviceId===b.deviceId && a.generation===b.generation &&
    a.verificationKeyRef===b.verificationKeyRef && a.keyFingerprint===b.keyFingerprint &&
    a.issuedAt===b.issuedAt && a.expiresAt===b.expiresAt;
}
function sameChallengeIdentity(a: DeviceReconnectChallenge, b: DeviceReconnectChallenge) {
  return a.tenantId===b.tenantId && a.requestId===b.requestId &&
    a.deviceId===b.deviceId && a.deviceCredentialId===b.deviceCredentialId &&
    a.credentialGeneration===b.credentialGeneration &&
    a.challengeDigest===b.challengeDigest && a.createdAt===b.createdAt &&
    a.expiresAt===b.expiresAt;
}

export async function createDeviceOperationalCredentialRecord(
  pool: Pool,
  credential: DeviceOperationalCredential,
): Promise<DeviceOperationalCredential> {
  if (credential.state!=="active" || credential.revision!==1 || credential.revokedAt!==null) {
    throw new TypeError("new Device credential must be active at revision one");
  }
  return withTransaction(pool, async (client) => {
    await requireDevice(client,credential.tenantId,credential.deviceId,true);
    const existing=await loadCredential(client,credential.tenantId,credential.deviceCredentialId,true);
    const fp=credentialFingerprint(credential);
    if(existing){
      if(existing.credential_fingerprint===fp) return credentialRecord(existing);
      throw new PlatformError({code:"devices.credential_conflict",category:"conflict",message:"Device credential identity already exists with different evidence",retryable:false});
    }
    const latest=await client.query<{generation:string;state:string}>(
      "SELECT generation::text,state FROM devices.operational_credentials WHERE tenant_id=$1 AND device_id=$2 ORDER BY generation DESC LIMIT 1 FOR UPDATE",
      [credential.tenantId,credential.deviceId]
    );
    const row=latest.rows[0];
    if(row){
      throw new PlatformError({code:"devices.credential_rotation_required",category:"conflict",message:"Device already has credential history; use atomic rotation",retryable:false});
    }
    if(credential.generation!==1) throw new PlatformError({code:"devices.credential_generation_invalid",category:"conflict",message:"First Device credential generation must be one",retryable:false});
    await client.query(
      `INSERT INTO devices.operational_credentials(
        tenant_id,device_credential_id,device_id,generation,state,
        verification_key_ref,key_fingerprint,issued_at,expires_at,revoked_at,
        revision,credential_fingerprint
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [credential.tenantId,credential.deviceCredentialId,credential.deviceId,credential.generation,
       credential.state,credential.verificationKeyRef,credential.keyFingerprint,
       credential.issuedAt,credential.expiresAt,credential.revokedAt,credential.revision,fp]
    );
    return credential;
  });
}

export async function revokeDeviceOperationalCredentialRecord(
  pool:Pool,
  input:{readonly credential:DeviceOperationalCredential;readonly expectedRevision:number},
):Promise<DeviceOperationalCredential>{
  const target=input.credential;
  if(target.state!=="revoked"||target.revokedAt===null) throw new TypeError("credential revoke persistence requires revoked target state");
  return withTransaction(pool,async(client)=>{
    await requireDevice(client,target.tenantId,target.deviceId,false);
    const row=await loadCredential(client,target.tenantId,target.deviceCredentialId,true);
    if(!row) throw new PlatformError({code:"devices.credential_not_found",category:"not-found",message:"Device credential does not exist",retryable:false});
    const current=credentialRecord(row);
    const fp=credentialFingerprint(target);
    if(row.credential_fingerprint===fp) return current;
    if(current.revision!==input.expectedRevision) throw new PlatformError({code:"devices.credential_revision_stale",category:"conflict",message:"Device credential revision is stale",retryable:false});
    if(!sameCredentialIdentity(current,target)||current.state!=="active"||target.revision!==current.revision+1) {
      throw new PlatformError({code:"devices.credential_transition_invalid",category:"conflict",message:"Device credential revocation transition is invalid",retryable:false});
    }
    const r=await client.query<CredentialRow>(
      `UPDATE devices.operational_credentials
          SET state='revoked',revoked_at=$3,revision=$4,credential_fingerprint=$5
        WHERE tenant_id=$1 AND device_credential_id=$2 AND revision=$6
        RETURNING ${credentialColumns}`,
      [target.tenantId,target.deviceCredentialId,target.revokedAt,target.revision,fp,current.revision]
    );
    if(r.rowCount!==1) throw new PlatformError({code:"devices.credential_revision_stale",category:"conflict",message:"Device credential changed concurrently",retryable:true});
    return credentialRecord(r.rows[0]!);
  });
}

export async function rotateDeviceOperationalCredentialRecords(
  pool:Pool,
  input:{
    readonly revoked:DeviceOperationalCredential;
    readonly replacement:DeviceOperationalCredential;
    readonly expectedRevision:number;
  },
):Promise<Readonly<{revoked:DeviceOperationalCredential;replacement:DeviceOperationalCredential}>>{
  return withTransaction(pool,async(client)=>{
    const {revoked,replacement}=input;
    if(revoked.tenantId!==replacement.tenantId||revoked.deviceId!==replacement.deviceId||replacement.generation!==revoked.generation+1) {
      throw new TypeError("Device credential rotation scope/generation is invalid");
    }
    if(revoked.state!=="revoked"||replacement.state!=="active"||replacement.revision!==1||replacement.revokedAt!==null) {
      throw new TypeError("Device credential rotation target states are invalid");
    }
    await requireDevice(client,revoked.tenantId,revoked.deviceId,true);
    const currentRow=await loadCredential(client,revoked.tenantId,revoked.deviceCredentialId,true);
    if(!currentRow) throw new PlatformError({code:"devices.credential_not_found",category:"not-found",message:"Current Device credential does not exist",retryable:false});
    const current=credentialRecord(currentRow);
    const replacementRow=await loadCredential(client,replacement.tenantId,replacement.deviceCredentialId,true);
    const revokedFp=credentialFingerprint(revoked);
    const replacementFp=credentialFingerprint(replacement);
    if(currentRow.credential_fingerprint===revokedFp && replacementRow?.credential_fingerprint===replacementFp) {
      return Object.freeze({revoked:current,replacement:credentialRecord(replacementRow)});
    }
    if(current.revision!==input.expectedRevision||current.state!=="active") throw new PlatformError({code:"devices.credential_revision_stale",category:"conflict",message:"Current Device credential is no longer active at expected revision",retryable:false});
    if(!sameCredentialIdentity(current,revoked)||revoked.revision!==current.revision+1) throw new PlatformError({code:"devices.credential_transition_invalid",category:"conflict",message:"Current Device credential revocation is invalid",retryable:false});
    if(replacementRow) throw new PlatformError({code:"devices.credential_conflict",category:"conflict",message:"Replacement credential identity already exists",retryable:false});
    const latest=await client.query<{generation:string}>(
      "SELECT generation::text FROM devices.operational_credentials WHERE tenant_id=$1 AND device_id=$2 ORDER BY generation DESC LIMIT 1 FOR UPDATE",
      [revoked.tenantId,revoked.deviceId]
    );
    if(Number(latest.rows[0]?.generation)!==current.generation) throw new PlatformError({code:"devices.credential_generation_stale",category:"conflict",message:"Current Device credential generation is stale",retryable:false});
    await client.query(
      "UPDATE devices.operational_credentials SET state='revoked',revoked_at=$3,revision=$4,credential_fingerprint=$5 WHERE tenant_id=$1 AND device_credential_id=$2 AND revision=$6",
      [revoked.tenantId,revoked.deviceCredentialId,revoked.revokedAt,revoked.revision,revokedFp,current.revision]
    );
    await client.query(
      `INSERT INTO devices.operational_credentials(
        tenant_id,device_credential_id,device_id,generation,state,verification_key_ref,
        key_fingerprint,issued_at,expires_at,revoked_at,revision,credential_fingerprint
      ) VALUES($1,$2,$3,$4,'active',$5,$6,$7,$8,NULL,1,$9)`,
      [replacement.tenantId,replacement.deviceCredentialId,replacement.deviceId,replacement.generation,
       replacement.verificationKeyRef,replacement.keyFingerprint,replacement.issuedAt,replacement.expiresAt,replacementFp]
    );
    return Object.freeze({revoked,replacement});
  });
}

export async function readCurrentDeviceOperationalCredential(
  pool:Pool,input:{readonly tenantId:TenantId;readonly deviceId:DeviceId},
):Promise<DeviceOperationalCredential|null>{
  const r=await pool.query<CredentialRow>(
    `SELECT ${credentialColumns} FROM devices.operational_credentials
      WHERE tenant_id=$1 AND device_id=$2 AND state='active'
      ORDER BY generation DESC LIMIT 1`,
    [input.tenantId,input.deviceId]
  );
  return r.rows[0]?credentialRecord(r.rows[0]):null;
}

export async function createDeviceReconnectChallengeRecord(
  pool:Pool,challenge:DeviceReconnectChallenge,
):Promise<DeviceReconnectChallenge>{
  if(challenge.state!=="pending"||challenge.revision!==1||challenge.consumedAt!==null) throw new TypeError("new reconnect challenge must be pending at revision one");
  return withTransaction(pool,async(client)=>{
    const credentialRow=await loadCredential(client,challenge.tenantId,challenge.deviceCredentialId,true);
    if(!credentialRow) throw new PlatformError({code:"devices.credential_not_found",category:"not-found",message:"Device credential does not exist",retryable:false});
    const credential=credentialRecord(credentialRow);
    if(credential.state!=="active"||credential.deviceId!==challenge.deviceId||credential.generation!==challenge.credentialGeneration) throw new PlatformError({code:"devices.reconnect_credential_stale",category:"authorization",message:"Reconnect challenge is not bound to the current active credential",retryable:false});
    if(Date.parse(challenge.expiresAt)>Date.parse(credential.expiresAt)) throw new TypeError("Reconnect challenge cannot outlive Device credential");
    const current=await readCurrentDeviceOperationalCredential(client as unknown as Pool,{tenantId:challenge.tenantId,deviceId:challenge.deviceId}).catch(()=>null);
    // The locked credential above plus the unique-active index is authoritative; avoid trusting a stale caller generation.
    if(current!==null && current.deviceCredentialId!==challenge.deviceCredentialId) throw new PlatformError({code:"devices.reconnect_credential_stale",category:"authorization",message:"Reconnect credential is not current",retryable:false});
    const existing=await loadChallenge(client,challenge.tenantId,challenge.requestId,true);
    const fp=challengeFingerprint(challenge);
    if(existing){
      if(existing.challenge_fingerprint===fp) return challengeRecord(existing);
      throw new PlatformError({code:"devices.reconnect_challenge_conflict",category:"conflict",message:"Reconnect RequestId already exists with different evidence",retryable:false});
    }
    await client.query(
      `INSERT INTO devices.reconnect_challenges(
        tenant_id,request_id,device_id,device_credential_id,credential_generation,
        challenge_digest,state,created_at,expires_at,consumed_at,revision,challenge_fingerprint
      ) VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8,NULL,1,$9)`,
      [challenge.tenantId,challenge.requestId,challenge.deviceId,challenge.deviceCredentialId,
       challenge.credentialGeneration,challenge.challengeDigest,challenge.createdAt,challenge.expiresAt,fp]
    );
    return challenge;
  });
}

export async function putDeviceReconnectChallengeRecord(
  pool:Pool,input:{readonly challenge:DeviceReconnectChallenge;readonly expectedRevision:number},
):Promise<DeviceReconnectChallenge>{
  const target=input.challenge;
  return withTransaction(pool,async(client)=>{
    const row=await loadChallenge(client,target.tenantId,target.requestId,true);
    if(!row) throw new PlatformError({code:"devices.reconnect_challenge_not_found",category:"not-found",message:"Reconnect challenge does not exist",retryable:false});
    const current=challengeRecord(row);
    const fp=challengeFingerprint(target);
    if(row.challenge_fingerprint===fp) return current;
    if(current.revision!==input.expectedRevision) throw new PlatformError({code:"devices.reconnect_challenge_revision_stale",category:"conflict",message:"Reconnect challenge revision is stale",retryable:false});
    if(!sameChallengeIdentity(current,target)||current.state!=="pending"||target.revision!==current.revision+1||!(target.state==="consumed"||target.state==="expired")) {
      throw new PlatformError({code:"devices.reconnect_challenge_transition_invalid",category:"conflict",message:"Reconnect challenge transition is invalid",retryable:false});
    }
    if(target.state==="consumed"){
      if(target.consumedAt===null) throw new TypeError("Consumed reconnect challenge requires consumedAt");
      const credentialRow=await loadCredential(client,target.tenantId,target.deviceCredentialId,true);
      if(!credentialRow) throw new PlatformError({code:"devices.credential_not_found",category:"not-found",message:"Device credential does not exist",retryable:false});
      const credential=credentialRecord(credentialRow);
      if(credential.state!=="active"||credential.deviceId!==target.deviceId||credential.generation!==target.credentialGeneration||Date.parse(target.consumedAt)>=Date.parse(credential.expiresAt)) {
        throw new PlatformError({code:"devices.reconnect_credential_stale",category:"authorization",message:"Device credential became unavailable before reconnect consumption",retryable:false});
      }
    } else if(target.consumedAt!==null){
      throw new TypeError("Expired reconnect challenge cannot carry consumedAt");
    }
    const updated=await client.query<ChallengeRow>(
      `UPDATE devices.reconnect_challenges
          SET state=$3,consumed_at=$4,revision=$5,challenge_fingerprint=$6
        WHERE tenant_id=$1 AND request_id=$2 AND revision=$7
        RETURNING ${challengeColumns}`,
      [target.tenantId,target.requestId,target.state,target.consumedAt,target.revision,fp,current.revision]
    );
    if(updated.rowCount!==1) throw new PlatformError({code:"devices.reconnect_challenge_revision_stale",category:"conflict",message:"Reconnect challenge changed concurrently",retryable:true});
    return challengeRecord(updated.rows[0]!);
  });
}

export async function readDeviceReconnectChallenge(
  pool:Pool,input:{readonly tenantId:TenantId;readonly requestId:RequestId},
):Promise<DeviceReconnectChallenge|null>{
  const r=await pool.query<ChallengeRow>(
    `SELECT ${challengeColumns} FROM devices.reconnect_challenges WHERE tenant_id=$1 AND request_id=$2`,
    [input.tenantId,input.requestId]
  );
  return r.rows[0]?challengeRecord(r.rows[0]):null;
}
