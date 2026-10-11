import type {Pool} from "pg";

/** Reuse feed.posts: never create a second media catalogue or change old media rows. */
export type PublishedPostMedia = {
  tenantId: string;
  postId: string;
  authorMasanaId: string;
  mediaId: string;
  kind: "image"|"audio";
  transcript: string|null;
};
export class PgFeedMediaAuthorization {
  constructor(private readonly pool: Pick<Pool,"query">) {}
  async find(tenantId:string,postId:string,mediaId:string):Promise<PublishedPostMedia|null> {
    const result=await this.pool.query(
      `SELECT p.author_masana_id,p.kind,p.transcript FROM feed.posts p
       WHERE p.tenant_id=$1 AND p.id=$2::uuid AND p.state='published'
       AND $3::text=ANY(p.media_ids) AND p.kind IN ('image','audio')
       AND EXISTS (SELECT 1 FROM masana.character_revisions m
          WHERE m.tenant_id=p.tenant_id AND m.character_id=p.author_masana_id
          AND m.state='approved') LIMIT 1`,[tenantId,postId,mediaId]);
    const row=result.rows[0] as {author_masana_id:string;kind:"image"|"audio";transcript:string|null}|undefined;
    return row?{tenantId,postId,mediaId,authorMasanaId:row.author_masana_id,kind:row.kind,transcript:row.transcript}:null;
  }
}
