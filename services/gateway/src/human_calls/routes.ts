import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HumanCallService } from "./service.js";

const CallParams=Type.Object({callId:Type.String({format:"uuid"})},
  {additionalProperties:false});
const RequestBody=Type.Object({
  conversationId:Type.String({format:"uuid"}),
  requestId:Type.String({minLength:12,maxLength:128}),
  kind:Type.Union([Type.Literal("audio"),Type.Literal("video")]),
},{additionalProperties:false});

export function registerHumanCallRoutes(app:FastifyInstance,service:HumanCallService):void {
  const guard=(_request:unknown,reply:{header:(key:string,value:string)=>unknown})=>{
    reply.header("Cache-Control","private, no-store");
    reply.header("Vary","Authorization");
  };
  app.post("/v1/messages/calls",{
    onRequest:guard,
    schema:{body:RequestBody},
  },async(request,reply)=>{
    const body=request.body as {conversationId:string;requestId:string;kind:"audio"|"video"};
    const created=await service.start({
      authorizationHeader:request.headers.authorization,...body,
    });
    reply.code(201);
    return created;
  });
  // Call history is NOT shared as DM plaintext. A blocked/revoked pair must
  // not remain exposed just because local call history was cached.
  app.get("/v1/messages/calls",{
    onRequest:guard,
    schema:{querystring:Type.Object({
      limit:Type.Optional(Type.Integer({minimum:1,maximum:50})),
    },{additionalProperties:false})},
  },async(request)=>{
    const q=request.query as {limit?:number};
    return service.recent({authorizationHeader:request.headers.authorization,limit:q.limit});
  });
  app.get("/v1/messages/calls/:callId",{
    onRequest:guard,schema:{params:CallParams},
  },async(request)=>{
    const p=request.params as {callId:string};
    return service.get({authorizationHeader:request.headers.authorization,callId:p.callId});
  });
  for(const action of ["accept","decline","end"] as const) {
    app.post(`/v1/messages/calls/:callId/${action}`,{
      onRequest:guard,schema:{params:CallParams,body:Type.Object({},{additionalProperties:false})},
    },async(request)=>{
      const p=request.params as {callId:string};
      return service.act({
        authorizationHeader:request.headers.authorization,callId:p.callId,action,
      });
    });
  }
  app.post("/v1/messages/calls/:callId/media-token",{
    onRequest:guard,schema:{params:CallParams,body:Type.Object({},{additionalProperties:false})},
  },async(request)=>{
    const p=request.params as {callId:string};
    return service.media({
      authorizationHeader:request.headers.authorization,callId:p.callId,
    });
  });
}
