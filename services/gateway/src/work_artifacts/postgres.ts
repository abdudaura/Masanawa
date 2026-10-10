import type { Artifact, ArtifactRepository, Owner } from './model.js';
/** Structural port implemented by the existing pg Pool; no new connection/configuration authority. */
export interface QueryPort { query(sql: string, values?: any[]): Promise<{rows: any[]}>; }
/** DB-clock daily cap is atomic across workers, accounts are independent, retries count toward abuse limits. */
export function createArtifactCreationLimiter(db:QueryPort) {
  return async(owner:Owner):Promise<boolean> => {
    const result=await db.query(`INSERT INTO work_artifacts.creation_budgets(tenant_id,user_id,day,attempts)
      VALUES($1,$2,(now() AT TIME ZONE 'UTC')::date,1)
      ON CONFLICT(tenant_id,user_id) DO UPDATE SET day=EXCLUDED.day,
        attempts=CASE WHEN creation_budgets.day < EXCLUDED.day THEN 1 ELSE creation_budgets.attempts+1 END
      WHERE creation_budgets.day < EXCLUDED.day OR creation_budgets.attempts < 20 RETURNING attempts`,[owner.tenantId,owner.userId]);
    return result.rows.length===1;
  };
}
function row(r: any): Artifact {
  return {id:r.id, tenantId:r.tenant_id, userId:r.user_id, requestId:r.request_id,
    filename:r.filename, mimeType:r.mime_type, sizeBytes:r.size_bytes, sha256:r.sha256,
    objectKey:r.object_key, provenance:r.provenance, state:r.state, revision:r.revision,
    createdAt:new Date(r.created_at).toISOString(), expiresAt:new Date(r.expires_at).toISOString(), grants:r.grants};
}
export function createArtifactRepository(db: QueryPort): ArtifactRepository {
  return {
    async reserve(a) {
      const inserted = await db.query(`INSERT INTO work_artifacts.files
        (tenant_id,user_id,id,request_id,filename,mime_type,size_bytes,sha256,object_key,provenance,state,revision,created_at,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'generating',1,$11,$12)
        ON CONFLICT (tenant_id,user_id,request_id) DO NOTHING RETURNING *`,
        [a.tenantId,a.userId,a.id,a.requestId,a.filename,a.mimeType,a.sizeBytes,a.sha256,a.objectKey,
          JSON.stringify(a.provenance),a.createdAt,a.expiresAt]);
      if (inserted.rows[0]) return row(inserted.rows[0]);
      // Separate statement obtains a fresh READ COMMITTED snapshot after a concurrent INSERT wins.
      const found = await db.query(`SELECT * FROM work_artifacts.files WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3`,
        [a.tenantId,a.userId,a.requestId]);
      if (!found.rows[0]) throw new Error('artifact_reservation_unavailable');
      return row(found.rows[0]);
    },
    async find(tenantId,id) {
      const result = await db.query('SELECT * FROM work_artifacts.files WHERE tenant_id=$1 AND id=$2',[tenantId,id]);
      return result.rows[0] ? row(result.rows[0]) : null;
    },
    async findRequest(owner,requestId) {
      const result=await db.query('SELECT * FROM work_artifacts.files WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3',
        [owner.tenantId,owner.userId,requestId]);
      return result.rows[0] ? row(result.rows[0]) : null;
    },
    async change(owner,id,revision,patch) {
      const result = await db.query(`UPDATE work_artifacts.files SET state=$5,grants=$6::jsonb,revision=revision+1
        WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND revision=$4 RETURNING *`,
        [owner.tenantId,owner.userId,id,revision,patch.state,JSON.stringify(patch.grants)]);
      return result.rows[0] ? row(result.rows[0]) : null;
    },
    async list(owner,after,limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 51) throw new TypeError('Invalid page size');
      const result = await db.query(`SELECT * FROM work_artifacts.files
        WHERE tenant_id=$1 AND user_id=$2 AND ($3::text IS NULL OR id > $3) ORDER BY id LIMIT $4`,
        [owner.tenantId,owner.userId,after ?? null,limit]);
      return result.rows.map(row);
    },
    async cleanupCandidates(limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Invalid cleanup bound');
      // Deleted tombstones remain eligible until expiry + one hour to erase any late in-flight PUT.
      // Updating a bounded batch prevents oldest rows starving the queue; multiworkers skip locked rows.
      const result = await db.query(`WITH batch AS (
        SELECT tenant_id,id FROM work_artifacts.files
        WHERE (state IN ('revoked','deleting') OR (state <> 'deleted' AND expires_at <= now())
          OR (state='deleted' AND expires_at + interval '1 hour' > now()))
        AND (cleanup_checked_at IS NULL OR cleanup_checked_at < now() - interval '1 minute')
        ORDER BY cleanup_checked_at NULLS FIRST,expires_at LIMIT $1 FOR UPDATE SKIP LOCKED)
        UPDATE work_artifacts.files f SET cleanup_checked_at=now() FROM batch b
        WHERE f.tenant_id=b.tenant_id AND f.id=b.id RETURNING f.*`,[limit]);
      return result.rows.map(row);
    },
  };
}
/** No provider writes except deleting this domain's exact object keys. Safe to retry after process loss. */
export async function sweepArtifacts(repo: ArtifactRepository,
  remove: (owner:Owner,id:string)=>Promise<unknown>, eraseTombstone:(key:string)=>Promise<void>) {
  const result = {deleted:0, failed:0};
  for (const a of await repo.cleanupCandidates(50)) {
    try {
      if (a.state === 'deleted') await eraseTombstone(a.objectKey);
      else await remove({tenantId:a.tenantId,userId:a.userId},a.id);
      result.deleted++;
    } catch { result.failed++; }
  }
  return result;
}
