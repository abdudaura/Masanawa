import type {ReplayObjectStore} from "../../talk_replay/playback/s3_object_store.js";
import type {FeedMediaOptions,PublishedPostMedia} from "./media_routes.js";
/** Explicit canonical Masana storage dependency. A replay bucket is never inferred. */
export interface StatusMediaConfiguration {
 objects:Pick<ReplayObjectStore,"presignGet"> & {
  statObject(objectKey:string):Promise<{contentType:string;bytes:number}|null>;
 };
 approvedDownloadOrigins:readonly string[];
}
interface CanonicalMedia {
 object(tenant:string,author:string,media:string,kind:"image"|"audio"):Promise<{objectKey:string}|null>;
}
interface PublishedMedia {
 find(tenant:string,post:string,media:string):Promise<PublishedPostMedia|null>;
}
const image=/^image\/(jpeg|png|webp|gif)$/;
const audio=/^audio\/(mpeg|mp4|ogg|aac|wav|webm)$/;
/** Reuses cleared character_media + published feed membership. No cache or public key. */
export function createStatusMediaRuntime(input:{eligibility:CanonicalMedia;published:PublishedMedia;
 configuration?:StatusMediaConfiguration}){
 const configuration=input.configuration;
 const origins=new Set(configuration?.approvedDownloadOrigins??[]);
 for(const origin of origins){
  const url=new URL(origin);
  if(url.protocol!=="https:"||url.origin!==origin||url.username||url.password)
   throw new TypeError("Status media requires exact HTTPS download origins");
 }
 const validated=async(tenant:string,author:string,media:string,kind:string)=>{
  if((kind!=="image"&&kind!=="audio")||!configuration||origins.size===0)return null;
  const object=await input.eligibility.object(tenant,author,media,kind);
  if(!object)return null;
  const metadata=await configuration.objects.statObject(object.objectKey);
  if(!metadata||!(kind==="image"?image.test(metadata.contentType):audio.test(metadata.contentType))||
    !Number.isSafeInteger(metadata.bytes)||metadata.bytes<1||
    metadata.bytes>(kind==="image"?10:30)*1024*1024)return null;
  // Network work must not retain a revoked approval or replaced object mapping.
  const current=await input.eligibility.object(tenant,author,media);
  if(!current||current.objectKey!==object.objectKey)return null;
  return {...object,contentType:metadata.contentType};
 };
 const media:Omit<FeedMediaOptions,"tenant"|"principal"|"enabled">={
  find:(tenant,post,ref)=>input.published.find(tenant,post,ref),
  approvedDownloadOrigin:origin=>origins.has(origin),
  sign:async post=>{
   if(!configuration||origins.size===0)throw new Error("status.media_store_unavailable");
   const object=await validated(post.tenantId,post.authorMasanaId,post.mediaId,post.kind);
   if(!object)return null;
   const current=await input.published.find(post.tenantId,post.postId,post.mediaId);
   if(!current||current.authorMasanaId!==post.authorMasanaId||current.kind!==post.kind||
     current.tenantId!==post.tenantId||current.postId!==post.postId||current.mediaId!==post.mediaId)return null;
   const grant=await configuration.objects.presignGet(object.objectKey,120);
   return {...grant,contentType:object.contentType};
  },
 };
 return {media,approved:async(tenant:string,author:string,ref:string,kind:string)=>
  (await validated(tenant,author,ref,kind))!==null};
}
