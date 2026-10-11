import type {Pool} from "pg";
// Structural projection of the canonical @masanawa/feed editorial contract.
// Keep PostgreSQL free of an undeclared workspace dependency. AF00 will
// validate assignability when composing the canonical service with this port.
type EditorialState="draft"|"in_review"|"scheduled"|"published"|"hidden"|"removed";
type EditorialAction="submit"|"revise"|"approve"|"schedule"|"take_down";
type DraftInput={authorMasanaId:string;kind:"text"|"image"|"audio";body:string;
 media:readonly string[];transcript:string|null;idempotencyKey:string};
type EditorialPost={id:string;tenantId:string;authorMasanaId:string;kind:"text"|"image"|"audio";
 body:string;media:readonly string[];transcript:string|null;state:EditorialState;revision:number;
 createdBy:string;scheduledAt:string|null;updatedAt:string};

/** One transactional PostgreSQL authority: feed.posts and an immutable revision audit.
 * Registered by AF00 only after the forward-only feed migration is qualified.
 */
type Row=Record<string,unknown>;
function model(r:Row):EditorialPost{
 return {id:String(r.id),tenantId:String(r.tenant_id),authorMasanaId:String(r.author_masana_id),
  kind:String(r.kind) as EditorialPost["kind"],body:String(r.body),media:r.media_ids as string[],
  transcript:r.transcript===null?null:String(r.transcript),
  state:String(r.state) as EditorialState,revision:Number(r.review_revision),createdBy:String(r.published_by),
  scheduledAt:r.scheduled_at==null?null:new Date(String(r.scheduled_at)).toISOString(),
  updatedAt:new Date(String(r.updated_at)).toISOString()};
}
function fail(code:string,status=409):never{throw Object.assign(new Error(code),{code,status})}
function sameReplay(row:Row|undefined,post:string,action:string,payload:Record<string,unknown>):boolean{
 if(!row)return false;
 if(String(row.post_id)!==post||row.action!==action)fail("editorial_idempotency_conflict");
 const saved=row.request_payload as Record<string,unknown>|null;
 if(!saved||Object.entries(payload).some(([key,value])=>JSON.stringify(saved[key])!==JSON.stringify(value)))
  fail("editorial_idempotency_conflict");
 return true;
}
const eligibleAuthor=`EXISTS (SELECT 1 FROM masana.character_revisions cr
 JOIN identity.characters c USING(tenant_id,character_id)
 JOIN identity.character_ownership o USING(tenant_id,character_id)
 WHERE cr.tenant_id=feed.posts.tenant_id AND cr.character_id=feed.posts.author_masana_id
   AND cr.state='approved' AND c.state='active' AND o.kind='platform')`;
const selection="tenant_id,id,author_masana_id,kind,body,media_ids,transcript,state,review_revision,published_by,scheduled_at,updated_at";
export class PgEditorialReviewRepository {
 constructor(private readonly pool:Pool){}
 async create(tenant:string,editor:string,input:Required<DraftInput>):Promise<EditorialPost>{
  const client=await this.pool.connect();
  try{
   await client.query("BEGIN");
   const inserted=await client.query(`INSERT INTO feed.posts
    (tenant_id,author_masana_id,kind,body,media_ids,transcript,state,idempotency_key,published_by)
    VALUES($1,$2,$3,$4,$5,$6,'draft',$7,$8)
    ON CONFLICT (tenant_id,published_by,idempotency_key) DO NOTHING
    RETURNING ${selection}`,
    [tenant,input.authorMasanaId,input.kind,input.body,input.media,input.transcript,input.idempotencyKey,editor]);
   const rows=inserted.rowCount?inserted:await client.query(`SELECT ${selection} FROM feed.posts
     WHERE tenant_id=$1 AND published_by=$2 AND idempotency_key=$3 FOR UPDATE`,
    [tenant,editor,input.idempotencyKey]);
   const r=rows.rows[0] as Row|undefined;
   if(!r)fail("editorial_idempotency_unknown");
   if(r.author_masana_id!==input.authorMasanaId||r.kind!==input.kind||r.body!==input.body
      ||r.transcript!==input.transcript||JSON.stringify(r.media_ids)!==JSON.stringify(input.media))
     fail("editorial_idempotency_conflict");
   if(inserted.rowCount){
    await client.query(`INSERT INTO feed.editorial_events
      (tenant_id,post_id,revision,previous_state,next_state,actor_id,action,idempotency_key)
      VALUES($1,$2,0,NULL,'draft',$3,'create',$4)`,
      [tenant,r.id,editor,input.idempotencyKey]);
   }
   await client.query("COMMIT");return model(r);
  }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 }
 async update(tenant:string,id:string,editor:string,revision:number,input:Required<DraftInput>):Promise<EditorialPost>{
  const client=await this.pool.connect();
  try{
   await client.query("BEGIN");
   const payload={expectedRevision:revision,authorMasanaId:input.authorMasanaId,kind:input.kind,
    body:input.body,media:input.media,transcript:input.transcript};
   const replay=await client.query(`SELECT post_id,action,request_payload FROM feed.editorial_events
      WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3`,[tenant,editor,input.idempotencyKey]);
   if(sameReplay(replay.rows[0] as Row|undefined,id,"edit",payload)){
    const current=await client.query(`SELECT ${selection} FROM feed.posts WHERE tenant_id=$1 AND id=$2::uuid`,[tenant,id]);
    if(!current.rows[0])fail("editorial_not_found",404);
    await client.query("COMMIT");return model(current.rows[0] as Row);
   }
   const found=await client.query(`SELECT ${selection} FROM feed.posts
     WHERE tenant_id=$1 AND id=$2::uuid FOR UPDATE`,[tenant,id]);
   const previous=found.rows[0] as Row|undefined;
   if(!previous)fail("editorial_not_found",404);
   // Concurrent duplicate request may commit while waiting on this row lock.
   const afterLock=await client.query(`SELECT post_id,action,request_payload FROM feed.editorial_events
      WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3`,[tenant,editor,input.idempotencyKey]);
   if(sameReplay(afterLock.rows[0] as Row|undefined,id,"edit",payload)){
    await client.query("COMMIT");return model(previous);
   }
   if(previous.published_by!==editor||previous.state!=="draft")fail("draft_owner_required",403);
   if(previous.author_masana_id!==input.authorMasanaId)fail("immutable_draft_author");
   if(Number(previous.review_revision)!==revision)fail("editorial_stale_revision");
   const changed=await client.query(`UPDATE feed.posts SET kind=$4,body=$5,media_ids=$6,
     transcript=$7,updated_at=now(),review_revision=review_revision+1
     WHERE tenant_id=$1 AND id=$2::uuid AND review_revision=$3
     RETURNING ${selection}`,[tenant,id,revision,input.kind,input.body,input.media,input.transcript]);
   if(!changed.rows[0])fail("editorial_stale_revision");
   await client.query(`INSERT INTO feed.editorial_events
     (tenant_id,post_id,revision,previous_state,next_state,actor_id,action,idempotency_key,request_payload)
     VALUES($1,$2,$3,'draft','draft',$4,'edit',$5,$6::jsonb)`,
     [tenant,id,revision+1,editor,input.idempotencyKey,JSON.stringify(payload)]);
   await client.query("COMMIT");return model(changed.rows[0] as Row);
  }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 }
 async get(tenant:string,id:string):Promise<EditorialPost|null>{
  const r=await this.pool.query(`SELECT ${selection} FROM feed.posts WHERE tenant_id=$1 AND id=$2::uuid`,[tenant,id]);
  return r.rows[0]?model(r.rows[0] as Row):null;
 }
 async list(tenant:string,filter:readonly EditorialState[],limit:number):Promise<readonly EditorialPost[]>{
  const r=await this.pool.query(`SELECT ${selection} FROM feed.posts
    WHERE tenant_id=$1 AND (cardinality($2::text[])=0 OR state=ANY($2::text[]))
    ORDER BY updated_at DESC,id DESC LIMIT $3`,[tenant,filter,Math.min(limit,50)]);
  return r.rows.map(x=>model(x as Row));
 }
 async change(tenant:string,post:string,actor:string,expectedRevision:number,
  action:EditorialAction,key:string,scheduledAt:string|null):Promise<EditorialPost>{
  const client=await this.pool.connect();
  try{
   await client.query("BEGIN");
   // Treat exact replay as a read. An unrelated reused key cannot perform another action.
   const payload={expectedRevision,scheduledAt};
   const replay=await client.query(`SELECT post_id,action,request_payload FROM feed.editorial_events
     WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3`,[tenant,actor,key]);
   if(sameReplay(replay.rows[0] as Row|undefined,post,action,payload)){
    const same=await client.query(`SELECT ${selection} FROM feed.posts WHERE tenant_id=$1 AND id=$2::uuid`,[tenant,post]);
    if(!same.rows[0])fail("editorial_not_found",404);
    await client.query("COMMIT");return model(same.rows[0] as Row);
   }
   const found=await client.query(`SELECT ${selection} FROM feed.posts
    WHERE tenant_id=$1 AND id=$2::uuid FOR UPDATE`,[tenant,post]);
   const before=found.rows[0] as Row|undefined;
   if(!before)fail("editorial_not_found",404);
   const afterLock=await client.query(`SELECT post_id,action,request_payload FROM feed.editorial_events
     WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3`,[tenant,actor,key]);
   if(sameReplay(afterLock.rows[0] as Row|undefined,post,action,payload)){
    await client.query("COMMIT");return model(before);
   }
   if(Number(before.review_revision)!==expectedRevision)fail("editorial_stale_revision");
   const old=String(before.state);
   const transitions:Record<EditorialAction,readonly string[]>={
    submit:["draft"],revise:["in_review"],approve:["in_review"],
    schedule:["in_review"],take_down:["published","scheduled"]};
   if(!transitions[action]?.includes(old))fail("editorial_invalid_transition");
   if((action==="approve"||action==="schedule")&&before.published_by===actor)fail("separate_reviewer_required",403);
   const next:Record<EditorialAction,EditorialState>={
    submit:"in_review",revise:"draft",approve:"published",schedule:"scheduled",take_down:"hidden"};
   const state=next[action],revision=expectedRevision+1;
   const changed=await client.query(`UPDATE feed.posts SET state=$3,review_revision=$4,updated_at=now(),
      scheduled_at=CASE WHEN $3='scheduled' THEN $5::timestamptz ELSE NULL END,
      reviewed_by=CASE WHEN $3 IN ('scheduled','published') THEN $6 ELSE reviewed_by END,
      reviewed_at=CASE WHEN $3 IN ('scheduled','published') THEN now() ELSE reviewed_at END,
      published_at=CASE WHEN $3='published' THEN now() ELSE published_at END
    WHERE tenant_id=$1 AND id=$2::uuid AND review_revision=$7
      AND ($3 NOT IN ('published','scheduled') OR ${eligibleAuthor})
    RETURNING ${selection}`,[tenant,post,state,revision,scheduledAt,actor,expectedRevision]);
   if(!changed.rows[0])fail("editorial_stale_revision");
   await client.query(`INSERT INTO feed.editorial_events
    (tenant_id,post_id,revision,previous_state,next_state,actor_id,action,idempotency_key,request_payload)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [tenant,post,revision,old,state,actor,action,key,JSON.stringify(payload)]);
   await client.query("COMMIT");return model(changed.rows[0] as Row);
  }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 }
 /** Worker can query due drafts but is not allowed to skip independent approval. */
 async due(tenant:string,at:Date,limit=30):Promise<readonly EditorialPost[]>{
  const r=await this.pool.query(`SELECT ${selection} FROM feed.posts WHERE tenant_id=$1
    AND state='scheduled' AND scheduled_at<=$2 ORDER BY scheduled_at,id LIMIT $3`,
    [tenant,at.toISOString(),Math.min(limit,30)]);
  return r.rows.map(x=>model(x as Row));
 }
 async releaseScheduled(tenant:string,post:string,revision:number,at:Date):Promise<boolean>{
  const client=await this.pool.connect();
  try{
   await client.query("BEGIN");
   const r=await client.query(`UPDATE feed.posts SET state='published',scheduled_at=NULL,
      published_at=$4,updated_at=$4,review_revision=review_revision+1
    WHERE tenant_id=$1 AND id=$2::uuid AND review_revision=$3 AND state='scheduled'
      AND scheduled_at<=$4 AND reviewed_by IS NOT NULL
      AND ${eligibleAuthor}
    RETURNING review_revision`,[tenant,post,revision,at.toISOString()]);
   if(r.rowCount){
    await client.query(`INSERT INTO feed.editorial_events
     (tenant_id,post_id,revision,previous_state,next_state,actor_id,action,idempotency_key)
     VALUES($1,$2,$3,'scheduled','published','feed_scheduler','scheduled_release',$4)`,
     [tenant,post,r.rows[0].review_revision,`schedule-release:${tenant}:${post}:${revision}`]);
   }
   await client.query("COMMIT");return Boolean(r.rowCount);
  }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 }
}

