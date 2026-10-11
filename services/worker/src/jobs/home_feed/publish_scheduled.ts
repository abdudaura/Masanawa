/** A06: bounded scheduled-post release, using the *same* feed.posts repository.
 * AF00 registers with the existing worker scheduler; this file does not create
 * another queue, timer or service. A missing live media/author verifier denies.
 */
export interface ScheduledPost {
 id:string;tenantId:string;authorMasanaId:string;media:readonly string[];
 revision:number;scheduledAt:string|null;state:string;
}
export interface ScheduledPosts {
 due(tenant:string,at:Date,limit:number):Promise<readonly ScheduledPost[]>;
 releaseScheduled(tenant:string,id:string,revision:number,at:Date):Promise<boolean>;
}
export interface ReleaseVerifier {
 verifiedAuthor(tenant:string,authorMasanaId:string):Promise<boolean>;
 verifiedMedia(tenant:string,authorMasanaId:string,mediaRef:string):Promise<boolean>;
}
export function makeScheduledFeedPublisher(repo:ScheduledPosts,verifier:ReleaseVerifier,
  enabled:()=>boolean=()=>false){
 return async (tenant:string,now=new Date()):Promise<{published:number;deferred:number}>=>{
  if(!enabled())return {published:0,deferred:0};
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenant))throw Error("invalid_tenant");
  const items=await repo.due(tenant,now,30);
  let published=0,deferred=0;
  for(const post of items){
   if(post.tenantId!==tenant||post.state!=="scheduled"||!post.scheduledAt||
     Date.parse(post.scheduledAt)>now.getTime()){deferred++;continue}
   // Revoke/suspension after staff approval must not release a queued post.
   if(!await verifier.verifiedAuthor(tenant,post.authorMasanaId)){deferred++;continue}
   let eligible=true;
   for(const media of post.media){
    if(!await verifier.verifiedMedia(tenant,post.authorMasanaId,media)){eligible=false;break}
   }
   if(!eligible){deferred++;continue}
   // PG transaction checks state, revision, due time and author approval again.
   if(await repo.releaseScheduled(tenant,post.id,post.revision,now))published++;
   else deferred++;
  }
  return {published,deferred};
 };
}
