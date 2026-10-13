import type {FastifyInstance,FastifyRequest} from "fastify";
import {registerHomeFeedRoutes,type FeedRoutesOptions} from "./routes.js";
import {registerAdminFeedReviewRoutes,type AdminReviewRoutesOptions} from "./admin_review_routes.js";
import {registerFeedMediaRoutes,type FeedMediaOptions} from "./media_routes.js";

/** Structural port implemented by the existing platform customer-session
 * authorizer. The host supplies that authority, never an HTTP role header. */
export interface StatusSession {tenantId:string;userId:string}
export interface StatusRuntime {
 sessions:{authorize(input:{authorizationHeader:string|undefined}):Promise<StatusSession>};
 feed:FeedRoutesOptions["service"];
 editorial:AdminReviewRoutesOptions["service"];
 isEditor?:(session:StatusSession)=>Promise<boolean>;
 enabled?:()=>boolean;
 media?:Omit<FeedMediaOptions,"tenant"|"principal"|"enabled">;
}

/** One registration for the canonical feed/editorial/media services. No
 * separate session store, publisher, ledger or PostgreSQL connection. */
export async function registerStatusRuntime(app:FastifyInstance,options:StatusRuntime){
 await app.register(async scope=>{
  scope.setErrorHandler((error,_request,reply)=>{
   const problem=error as {status?:number;statusCode?:number;code?:string};
   const status=problem.statusCode??problem.status;
   if(status&&[401,403,404,409,410,422,503].includes(status)){
    return reply.code(status).send({code:problem.code??"status_unavailable"});
   }
   return reply.code(503).send({code:"status_unavailable"});
  });
  const identities=new WeakMap<FastifyRequest,StatusSession>();
  const resolve=async(request:FastifyRequest)=>{
   let identity=identities.get(request);
   if(!identity){
    identity=await options.sessions.authorize({authorizationHeader:request.headers.authorization});
    if(!identity||typeof identity.tenantId!=="string"||!identity.tenantId||
       typeof identity.userId!=="string"||!identity.userId){
     throw Object.assign(new Error("authentication_required"),{status:401,code:"authentication_required"});
    }
    identities.set(request,identity);
   }
   return identity;
  };
  const enabled=options.enabled??(()=>true);
  // Media routes read the tenant before principal; authenticate once before
  // any feature handler so every existing route observes the same session.
  scope.addHook("preHandler",async request=>{if(enabled())await resolve(request);});
  const tenant=(request:FastifyRequest)=>identities.get(request)?.tenantId??null;
  const principal=async(request:FastifyRequest)=>{
   const session=await resolve(request);
   const staff=request.routeOptions.url?.startsWith("/v1/admin/")===true&&
     await options.isEditor?.(session)===true;
   return staff
    ?{kind:"staff" as const,tenantId:session.tenantId,id:session.userId,permissions:["content_editor"]}
    :{kind:"fan" as const,tenantId:session.tenantId,id:session.userId};
  };
  await registerHomeFeedRoutes(scope,{service:options.feed,principal,tenant,
   // Conservative existing review path until canonical account-age policy is supplied.
   isNewAccount:async()=>true,enabled});
  await registerAdminFeedReviewRoutes(scope,{service:options.editorial,principal,tenant,enabled});
  if(options.media)await registerFeedMediaRoutes(scope,{...options.media,principal,tenant,enabled});
 });
}
