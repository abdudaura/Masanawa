import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkReplayService } from "./talk_replay/service.js";

const TalkParams=Type.Object({talkId:Type.String({minLength:1,maxLength:240})},{additionalProperties:false});

export function registerTalkReplayRoutes(app:FastifyInstance,service:TalkReplayService,options:{readonly includeMyTalks?:boolean}={}):void{
  app.post("/talks/:talkId/replay/recording",{
    schema:{params:TalkParams,body:Type.Object({
      consent:Type.Literal(true),
      publicationPreference:Type.Union([Type.Literal("publish"),Type.Literal("private")]),
    },{additionalProperties:false})},
  },async(request,reply)=>{
    const {talkId}=request.params as {talkId:string};
    const body=request.body as {consent:true;publicationPreference:"publish"|"private"};
    const result=await service.start({
      authorizationHeader:request.headers.authorization,talkId,
      consent:body.consent,publicationPreference:body.publicationPreference,
    });
    reply.code(201);
    return result;
  });

  app.get("/talks/:talkId/replay",{schema:{params:TalkParams}},async request=>{
    const {talkId}=request.params as {talkId:string};
    return service.view({authorizationHeader:request.headers.authorization,talkId});
  });

  app.get("/talks/:talkId/replay/playback",{schema:{params:TalkParams}},async (request,reply)=>{
    // Per-user signed S3 links must never be reused from a shared HTTP cache
    // across logout, account switch, replay unpublish or moderation changes.
    reply.header("Cache-Control","private, no-store, max-age=0");
    reply.header("Pragma","no-cache");
    reply.header("Vary","Authorization");
    const {talkId}=request.params as {talkId:string};
    return service.playback({authorizationHeader:request.headers.authorization,talkId});
  });

  app.post("/talks/:talkId/replay/publication",{
    schema:{params:TalkParams,body:Type.Object({
      action:Type.Union([Type.Literal("publish"),Type.Literal("unpublish"),Type.Literal("discard")]),
    },{additionalProperties:false})},
  },async request=>{
    const {talkId}=request.params as {talkId:string};
    const {action}=request.body as {action:"publish"|"unpublish"|"discard"};
    return service.publication({authorizationHeader:request.headers.authorization,talkId,action});
  });

  // The full gateway uses TalkLibraryService for this shared endpoint.
  // Keep the replay-only contract for compositions without a library.
  if(options.includeMyTalks!==false){
  app.get("/me/talks",{
    schema:{querystring:Type.Object({limit:Type.Optional(Type.Integer({minimum:1,maximum:100}))},{additionalProperties:false})},
  },async request=>{
    const query=request.query as {limit?:number};
    return service.myTalks({authorizationHeader:request.headers.authorization,limit:query.limit??60});
  });
  }
}
