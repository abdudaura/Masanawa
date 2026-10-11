import type {FastifyInstance,FastifyRequest} from "fastify";
import type {PublishedPostMedia} from "../../../../../adapters/storage/postgres/src/home_feed/media_authorization.js";

/** Signer MUST perform its own tenant/author/media permission and rights check against
 * the canonical object store; this route never accepts a user-provided object key/URL. */
export type MediaSigner = (media:PublishedPostMedia)=>Promise<{
  url:string;contentType:string;expiresAt:string
}|null>;
export interface FeedMediaOptions {
  tenant:(request:FastifyRequest)=>string|null;
  principal:(request:FastifyRequest)=>Promise<{tenantId:string}|null>;
  enabled:()=>boolean;
  find:(tenantId:string,postId:string,mediaId:string)=>Promise<PublishedPostMedia|null>;
  sign:MediaSigner;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const media=/^media_[A-Za-z0-9_-]{8,128}$/;
const tenantId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const bad=(code:string)=>({code});
export async function registerFeedMediaRoutes(app:FastifyInstance,options:FeedMediaOptions){
  app.get("/v1/posts/:postId/media/:mediaId",async(request,reply)=>{
    reply.header("Cache-Control","private, no-store");
    reply.header("Pragma","no-cache");
    if(!options.enabled())return reply.code(503).send(bad("feature_disabled"));
    const tenant=options.tenant(request);
    // The sole canonical session resolver is optional for public posts.
    const actor=await options.principal(request);
    if(!tenant||!tenantId.test(tenant)||actor?.tenantId!==undefined&&actor.tenantId!==tenant)
      return reply.code(403).send(bad("tenant_denied"));
    const params=request.params as Record<string,unknown>;
    const postId=params.postId,mediaId=params.mediaId;
    if(typeof postId!=="string"||!uuid.test(postId)||typeof mediaId!=="string"||!media.test(mediaId))
      return reply.code(422).send(bad("invalid_media_reference"));
    const post=await options.find(tenant,postId,mediaId);
    if(!post||post.tenantId!==tenant||post.postId!==postId||post.mediaId!==mediaId||
      !["image","audio"].includes(post.kind))return reply.code(404).send(bad("media_unavailable"));
    const signed=await options.sign(post);
    // Never return unapproved, unsigned, HTTP, expired or unbounded grants.
    if(!signed)return reply.code(404).send(bad("media_unavailable"));
    let uri:URL;
    try{uri=new URL(signed.url);}catch{return reply.code(503).send(bad("media_signer_unavailable"));}
    const ttl=Date.parse(signed.expiresAt)-Date.now();
    if(uri.protocol!=="https:"||!uri.hostname||uri.username||uri.password||
      !Number.isFinite(ttl)||ttl<=0||ttl>300000||
      !(post.kind==="image"?/^image\/(jpeg|png|webp|gif)$/.test(signed.contentType):
        /^audio\/(mpeg|mp4|ogg|aac|wav|webm)$/.test(signed.contentType)))
      return reply.code(503).send(bad("media_signer_unavailable"));
    return reply.send({mediaId,kind:post.kind,url:signed.url,contentType:signed.contentType,
      expiresAt:signed.expiresAt,transcript:post.kind==="audio"?post.transcript:null});
  });
}
