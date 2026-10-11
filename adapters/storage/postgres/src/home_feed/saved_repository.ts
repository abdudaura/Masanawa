import type {Pool} from "pg";
import type {SavedCursor,SavedItem,SavedRepository} from "../../../../../packages/feed/src/saved.js";

/** One fan-private C25 projection over existing feed.saves and verified official video items. */
export class PgSavedLibraryRepository implements SavedRepository {
  constructor(private readonly pool:Pool){}
  async list(tenant:string,fan:string,before:SavedCursor|null,limit:number):Promise<readonly SavedItem[]> {
    const sql=String.raw\`WITH saved_items AS (
      SELECT 'post'::text AS kind, s.post_id AS id, s.created_at AS saved_at,
        jsonb_build_object('id',p.id,'authorMasanaId',p.author_masana_id,
          'authorName',COALESCE((SELECT r.profile->>'displayName'
            FROM masana.character_revisions r WHERE r.tenant_id=p.tenant_id
              AND r.character_id=p.author_masana_id AND r.state='approved' LIMIT 1),p.author_masana_id),
          'kind',p.kind,'body',p.body,'media',p.media_ids,'transcript',p.transcript,
          'publishedAt',p.published_at,'likeCount',
            (SELECT count(*)::int FROM feed.likes l WHERE l.tenant_id=p.tenant_id AND l.post_id=p.id),
          'commentCount',(SELECT count(*)::int FROM feed.comments c
            WHERE c.tenant_id=p.tenant_id AND c.post_id=p.id AND c.state='visible'),
          'viewerLiked',EXISTS(SELECT 1 FROM feed.likes l
            WHERE l.tenant_id=p.tenant_id AND l.post_id=p.id AND l.fan_id=$2),
          'viewerSaved',true) AS payload
      FROM feed.saves s JOIN feed.posts p ON p.tenant_id=s.tenant_id AND p.id=s.post_id
      WHERE s.tenant_id=$1 AND s.fan_id=$2 AND p.state='published'
        AND EXISTS(SELECT 1 FROM masana.character_revisions r
          WHERE r.tenant_id=p.tenant_id AND r.character_id=p.author_masana_id AND r.state='approved')
      UNION ALL
      SELECT 'video'::text,v.video_id,v.created_at,
        jsonb_build_object('id',i.item_id,'provider',i.provider,'sourceUrl',i.source_url,
          'title',i.title,'channelName',i.channel_name,'reviewState',i.review_state,
          'verifiedAt',i.verified_at) AS payload
      FROM feed.saved_videos v JOIN external_videos.items i
        ON i.tenant_id=v.tenant_id AND i.item_id=v.video_id
      WHERE v.tenant_id=$1 AND v.fan_id=$2 AND i.review_state='approved'
        AND i.verified_at IS NOT NULL AND i.verification_reference IS NOT NULL
    )
    SELECT kind,id,saved_at,payload FROM saved_items
    WHERE ($3::timestamptz IS NULL OR (saved_at,kind,id)<($3::timestamptz,$4::text,$5::uuid))
    ORDER BY saved_at DESC,kind DESC,id DESC LIMIT $6\`;
    const result=await this.pool.query<{
      kind:"post"|"video";id:string;saved_at:Date|string;payload:Record<string,unknown>;
    }>(sql,[tenant,fan,before?.at??null,before?.kind??null,before?.id??null,limit]);
    return result.rows.map(r=>({
      kind:r.kind,id:String(r.id),savedAt:new Date(r.saved_at).toISOString(),
      ...(r.kind==="post"?{post:r.payload}:{video:r.payload})
    }));
  }
  async setVideoSaved(tenant:string,fan:string,id:string,enabled:boolean):Promise<boolean>{
    if(enabled){
      const result=await this.pool.query(
        \`INSERT INTO feed.saved_videos(tenant_id,fan_id,video_id)
         SELECT $1,$2,i.item_id FROM external_videos.items i
         WHERE i.tenant_id=$1 AND i.item_id=$3::uuid AND i.review_state='approved'
           AND i.verified_at IS NOT NULL AND i.verification_reference IS NOT NULL
         ON CONFLICT DO NOTHING RETURNING video_id\`,[tenant,fan,id]);
      if(result.rowCount)return true;
      const already=await this.pool.query(
        \`SELECT 1 FROM feed.saved_videos s JOIN external_videos.items i
          ON i.tenant_id=s.tenant_id AND i.item_id=s.video_id
          WHERE s.tenant_id=$1 AND s.fan_id=$2 AND s.video_id=$3::uuid
            AND i.review_state='approved' AND i.verified_at IS NOT NULL
            AND i.verification_reference IS NOT NULL\`,[tenant,fan,id]);
      return Boolean(already.rowCount);
    }
    await this.pool.query("DELETE FROM feed.saved_videos WHERE tenant_id=$1 AND fan_id=$2 AND video_id=$3::uuid",[tenant,fan,id]);
    return false;
  }
}
