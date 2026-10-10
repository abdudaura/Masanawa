import { ArtifactError } from './model.js';
import type { ArtifactRepository, ArtifactObjectStore, Owner } from './model.js';

/** Trusted F08 worker hook, never an HTTP API. The caller must disable account admission,
 * drain all admitted writes (including uncertain provider PUTs), and keep that fence durable.
 * A cursor is worker journal state, never a client-supplied permission to skip files. */
export function createArtifactAccountErasure(input:{
  repository:ArtifactRepository; objects:ArtifactObjectStore;
  /** Qualified provider policy: includes retained versions/replicas, not just a DELETE marker. */
  verifyErasure:(key:string)=>Promise<boolean>;
  assertId:(kind:string,value:string)=>void;
  isQuiesced:(owner:Owner)=>Promise<boolean>;
}) {
  async function fence(owner:Owner) {
    if (!await input.isQuiesced(owner)) throw new ArtifactError('account_erasure_not_fenced',409);
  }
  return async(owner:Owner,after?:string) => {
    input.assertId('tenant',owner.tenantId); input.assertId('user',owner.userId);
    if (after!==undefined) input.assertId('media-artifact',after);
    await fence(owner);
    const rows=await input.repository.list(owner,after,51);
    let verified=0;
    for (let row of rows.slice(0,50)) {
      if (row.tenantId!==owner.tenantId || row.userId!==owner.userId) throw new ArtifactError('account_erasure_scope_mismatch',503);
      await fence(owner);
      if ((row.state!=='deleting' && row.state!=='deleted') || row.grants.length!==0) {
        const changed=await input.repository.change(owner,row.id,row.revision,{state:'deleting',grants:[]});
        if (!changed) throw new ArtifactError('revision_conflict',409);
        row=changed;
      }
      // Re-delete tombstones too: a prior uncertain PUT may have arrived after normal deletion.
      await input.objects.delete(row.objectKey);
      if (!await input.verifyErasure(row.objectKey)) throw new ArtifactError('artifact_erasure_unverified',503);
      await fence(owner);
      if (row.state!=='deleted') {
        if (!await input.repository.change(owner,row.id,row.revision,{state:'deleted',grants:[]}))
          throw new ArtifactError('revision_conflict',409);
      }
      verified++;
    }
    await fence(owner);
    // Commit this cursor only on success. Any exception retries the previous batch in full.
    // Terminal means this fenced artifact scan finished, not that whole-account deletion finished.
    return {verified,next:rows.length>50?rows[49]!.id:null};
  };
}
