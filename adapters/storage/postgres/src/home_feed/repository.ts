import type {Pool} from "pg";
/** PG18 tenant-scoped implementation. Composition injects the canonical Masana approved-revision check. */
type Row=Record<string,unknown>;
type Cursor={at:string;id:string}|null;
function item(r:Row){
 return {id:String(r.id),tenantId:String(r.tenant_id),authorMasanaId:String(r.author_masana_id),authorName:String(r.author_name??r.author_masana_id),
  kind:String(r.kind) as "text"|"image"|"audio",body:String(r.body),media:r.media_ids as string[],transcript:r.transcript===null?null:String(r.transcript),
  publishedAt:new Date(String(r.published_at)).toISOString(),likeCount:Number(r.like_count??0),commentCount:Number(r.comment_count??0),
  viewerLiked:Boolean(r.viewer_liked),viewerSaved:Boolean(r.viewer_saved)};
}
function comment(r:Row){return {id:String(r.id),postId:String(r.post_id),body:String(r.body),state:String(r.state),
 createdAt:new Date(String(r.created_at)).toISOString()};}
const projection=`p.*, (SELECT r.profile->>'displayName' FROM masana.character_revisions r WHERE r.tenant_id=p.tenant_id AND r.character_id=p.author_masana_id AND r.state='approved' LIMIT 1) AS author_name, (SELECT count(*)::int FROM feed.likes l WHERE l.tenant_id=p.tenant_id AND l.post_id=p.id) AS like_count,
 (SELECT count(*)::int FROM feed.comments c WHERE c.tenant_id=p.tenant_id AND c.post_id=p.id AND c.state='visible') AS comment_count,
 EXISTS(SELECT 1 FROM feed.likes l WHERE l.tenant_id=p.tenant_id AND l.post_id=p.id AND l.fan_id=$2) AS viewer_liked,
 EXISTS(SELECT 1 FROM feed.saves s WHERE s.tenant_id=p.tenant_id AND s.post_id=p.id AND s.fan_id=$2) AS viewer_saved`;
export class PgHomeFeedRepository {
 constructor(private readonly pool:Pool){}
 async list(tenant:string,viewer:string|null,mode:"for_you"|"following",before:Cursor,limit:number) {
  const rows=await this.pool.query(`SELECT ${projection} FROM feed.posts p WHERE p.tenant_id=$1 AND p.state='published' AND EXISTS (SELECT 1 FROM masana.character_revisions m
    WHERE m.tenant_id=p.tenant_id AND m.character_id=p.author_masana_id AND m.state='approved')
   AND ($3::text='for_you' OR EXISTS (
     SELECT 1 FROM masana.follows f WHERE f.tenant_id=p.tenant_id AND f.fan_user_id=$2 AND f.character_id=p.author_masana_id))
   AND ($4::timestamptz IS NULL OR (p.published_at,p.id)<($4::timestamptz,$5::uuid))
   ORDER BY p.published_at DESC,p.id DESC LIMIT $6`,
   [tenant,viewer,mode,before?.at??null,before?.id??null,limit]);
  return rows.rows.map(item);
 }
 async find(tenant:string,viewer:string|null,id:string){
  const rows=await this.pool.query(`SELECT ${projection} FROM feed.posts p WHERE p.tenant_id=$1 AND p.id=$3::uuid AND p.state='published' AND EXISTS (SELECT 1 FROM masana.character_revisions m
    WHERE m.tenant_id=p.tenant_id AND m.character_id=p.author_masana_id AND m.state='approved')`,[tenant,viewer,id]);
  return rows.rows[0]?item(rows.rows[0]):null;
 }
 async publish(tenant:string,publisher:string,v:{authorMasanaId:string;kind:string;body:string;media:readonly string[];transcript:string|null;idempotencyKey:string}){
  const added=await this.pool.query(`INSERT INTO feed.posts
   (tenant_id,author_masana_id,kind,body,media_ids,transcript,idempotency_key,published_by)
   VALUES($1,$3,$4,$5,$6,$7,$8,$2)
   ON CONFLICT(tenant_id,published_by,idempotency_key) DO NOTHING
   RETURNING id`,[tenant,publisher,v.authorMasanaId,v.kind,v.body,v.media,v.transcript,v.idempotencyKey]);
  const existing=await this.pool.query(`SELECT id,author_masana_id,kind,body,media_ids,transcript FROM feed.posts
    WHERE tenant_id=$1 AND published_by=$2 AND idempotency_key=$3`,[tenant,publisher,v.idempotencyKey]);
  const row=existing.rows[0] as Row|undefined;
  if(!row)throw new Error("feed_publish_readback_unavailable");
  // A reused idempotency key must never silently overwrite or reinterpret a post.
  if(row.author_masana_id!==v.authorMasanaId||row.kind!==v.kind||row.body!==v.body||row.transcript!==v.transcript||
    JSON.stringify(row.media_ids)!==JSON.stringify(v.media))throw Object.assign(new Error("idempotency_conflict"),{status:409,code:"idempotency_conflict"});
  const post=await this.find(tenant,null,String(row.id));
  if(!post)throw new Error("feed_publish_hidden");
  void added;
  return post;
 }
 async setLike(tenant:string,fan:string,id:string,enabled:boolean){
  if(enabled)await this.pool.query(`INSERT INTO feed.likes(tenant_id,post_id,fan_id)
   SELECT $1,p.id,$2 FROM feed.posts p WHERE p.tenant_id=$1 AND p.id=$3::uuid AND p.state='published'
   ON CONFLICT DO NOTHING`,[tenant,fan,id]);
  else await this.pool.query("DELETE FROM feed.likes WHERE tenant_id=$1 AND fan_id=$2 AND post_id=$3::uuid",[tenant,fan,id]);
  return enabled;
 }
 async setSave(tenant:string,fan:string,id:string,enabled:boolean){
  if(enabled)await this.pool.query(`INSERT INTO feed.saves(tenant_id,post_id,fan_id)
   SELECT $1,p.id,$2 FROM feed.posts p WHERE p.tenant_id=$1 AND p.id=$3::uuid AND p.state='published'
   ON CONFLICT DO NOTHING`,[tenant,fan,id]);
  else await this.pool.query("DELETE FROM feed.saves WHERE tenant_id=$1 AND fan_id=$2 AND post_id=$3::uuid",[tenant,fan,id]);
  return enabled;
 }
 async comment(tenant:string,fan:string,post:string,body:string,key:string,pending:boolean){
  const rows=await this.pool.query(`WITH inserted AS (
   INSERT INTO feed.comments(tenant_id,post_id,fan_id,body,state,idempotency_key)
   SELECT $1,p.id,$2,$4,$5,$6 FROM feed.posts p WHERE p.tenant_id=$1 AND p.id=$3::uuid AND p.state='published'
   ON CONFLICT(tenant_id,fan_id,idempotency_key) DO UPDATE
   SET idempotency_key=EXCLUDED.idempotency_key
   WHERE feed.comments.post_id=EXCLUDED.post_id AND feed.comments.body=EXCLUDED.body
   RETURNING id,post_id,body,state,created_at
  ), queued AS (
   INSERT INTO events.outbox(outbox_event_id,tenant_id,event_id,event_type,schema_version,
     aggregate_type,aggregate_id,correlation_id,destination,payload)
   SELECT 'outbox-event_feed-comment_'||replace(i.id::text,'-',''),$1,
     'event_feed-comment_'||replace(i.id::text,'-',''),'feed.comment.pending',1,
     'feed_comment',i.id::text,'correlation_feed-comment_'||replace(i.id::text,'-',''),
     'feed.comment_review',
     jsonb_build_object('tenantId',$1::text,'postId',$3::text,'commentId',i.id::text,'fanId',$2::text,
       'outboxEventId','outbox-event_feed-comment_'||replace(i.id::text,'-',''))
   FROM inserted i WHERE i.state='pending'
   ON CONFLICT DO NOTHING RETURNING outbox_event_id
  )
  SELECT * FROM inserted`,[tenant,fan,post,body,pending?"pending":"visible",key]);
  const row=rows.rows[0] as Row|undefined;
  if(!row)throw Object.assign(new Error("idempotency_conflict_or_post_unavailable"),{status:409,code:"idempotency_conflict"});
  if(row.post_id!==post||row.body!==body)throw Object.assign(new Error("idempotency_conflict"),{status:409,code:"idempotency_conflict"});
  return comment(row) as {id:string;postId:string;body:string;state:"pending"|"visible";createdAt:string};
 }
 async comments(tenant:string,post:string,viewer:string|null,before:string|null,limit:number){
  const rows=await this.pool.query(`SELECT c.id,c.post_id,c.body,c.state,c.created_at FROM feed.comments c
   WHERE c.tenant_id=$1 AND c.post_id=$2::uuid AND (c.state='visible' OR (c.state='pending' AND c.fan_id=$3))
   AND ($4::uuid IS NULL OR (c.created_at,c.id)<(SELECT c2.created_at,c2.id FROM feed.comments c2 WHERE c2.tenant_id=$1 AND c2.id=$4::uuid))
   ORDER BY c.created_at DESC,c.id DESC LIMIT $5`,[tenant,post,viewer,before,limit]);
  return rows.rows.map(r=>comment(r) as {id:string;postId:string;body:string;state:"pending"|"visible";createdAt:string});
 }
}
