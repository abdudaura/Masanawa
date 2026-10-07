import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkModerationService } from "./talk_moderation/service.js";
import type { TalkReaction } from "./talk_moderation/model.js";

const TalkParams=Type.Object({talkId:Type.String({minLength:1,maxLength:160})},{additionalProperties:false});

export function registerTalkModerationRoutes(app:FastifyInstance,service:TalkModerationService):void{
  app.get("/talks/:talkId/participation",{schema:{params:TalkParams}},async request=>{
    const {talkId}=request.params as {talkId:string};
    return service.participation({authorizationHeader:request.headers.authorization,talkId});
  });

  app.post("/talks/:talkId/reactions",{
    schema:{params:TalkParams,body:Type.Object({reaction:Type.Union([
      Type.Literal("❤️"),Type.Literal("👏"),Type.Literal("😂"),Type.Literal("💯"),Type.Literal("🤔"),Type.Literal("🔥"),
    ])},{additionalProperties:false})},
  },async request=>{
    const {talkId}=request.params as {talkId:string};
    const {reaction}=request.body as {reaction:TalkReaction};
    return service.reaction({authorizationHeader:request.headers.authorization,talkId,reaction});
  });

  app.post("/talks/:talkId/raise-hand",{
    schema:{params:TalkParams,body:Type.Object({raised:Type.Boolean()},{additionalProperties:false})},
  },async request=>{
    const {talkId}=request.params as {talkId:string};
    const {raised}=request.body as {raised:boolean};
    return service.raiseHand({authorizationHeader:request.headers.authorization,talkId,raised});
  });

  app.post("/talks/:talkId/questions",{
    schema:{params:TalkParams,body:Type.Object({body:Type.String({minLength:1,maxLength:500})},{additionalProperties:false})},
  },async (request,reply)=>{
    const {talkId}=request.params as {talkId:string};
    const {body}=request.body as {body:string};
    const question=await service.question({authorizationHeader:request.headers.authorization,talkId,body});
    reply.code(201);
    return question;
  });

  app.get("/talks/:talkId/host-questions",{schema:{params:TalkParams}},async request=>{
    const {talkId}=request.params as {talkId:string};
    return service.hostQuestions({authorizationHeader:request.headers.authorization,talkId});
  });

  app.post("/talks/:talkId/host-questions/:questionId",{
    schema:{
      params:Type.Object({talkId:Type.String({minLength:1,maxLength:160}),questionId:Type.String({minLength:1,maxLength:160})},{additionalProperties:false}),
      body:Type.Object({action:Type.Union([Type.Literal("answered"),Type.Literal("dismissed")])},{additionalProperties:false}),
    },
  },async request=>{
    const {talkId,questionId}=request.params as {talkId:string;questionId:string};
    const {action}=request.body as {action:"answered"|"dismissed"};
    return service.hostQuestion({authorizationHeader:request.headers.authorization,talkId,questionId,action});
  });

  app.get("/talks/:talkId/host-controls",{schema:{params:TalkParams}},async request=>{
    const {talkId}=request.params as {talkId:string};
    return service.hostControls({authorizationHeader:request.headers.authorization,talkId});
  });

  app.post("/talks/:talkId/invitations",{
    schema:{
      params:TalkParams,
      body:Type.Object(
        {handle:Type.String({minLength:1,maxLength:160})},
        {additionalProperties:false},
      ),
    },
  },async request=>{
    const {talkId}=request.params as {talkId:string};
    const {handle}=request.body as {handle:string};
    return service.inviteHuman({
      authorizationHeader:request.headers.authorization,
      talkId,
      handle,
    });
  });

  app.post("/talks/:talkId/invitation-response",{
    schema:{
      params:TalkParams,
      body:Type.Object(
        {action:Type.Union([Type.Literal("accept"),Type.Literal("decline")])},
        {additionalProperties:false},
      ),
    },
  },async request=>{
    const {talkId}=request.params as {talkId:string};
    const {action}=request.body as {action:"accept"|"decline"};
    return service.respondHumanInvitation({
      authorizationHeader:request.headers.authorization,
      talkId,
      action,
    });
  });

  app.post("/talks/:talkId/host-requests/:requestId",{
    schema:{
      params:Type.Object({talkId:Type.String({minLength:1,maxLength:160}),requestId:Type.String({minLength:1,maxLength:160})},{additionalProperties:false}),
      body:Type.Object({action:Type.Union([Type.Literal("accept"),Type.Literal("decline")])},{additionalProperties:false}),
    },
  },async request=>{
    const {talkId,requestId}=request.params as {talkId:string;requestId:string};
    const {action}=request.body as {action:"accept"|"decline"};
    return service.hostRequest({authorizationHeader:request.headers.authorization,talkId,requestId,action});
  });

  app.post("/talks/:talkId/host-participants/:participantId",{
    schema:{
      params:Type.Object({talkId:Type.String({minLength:1,maxLength:160}),participantId:Type.String({minLength:1,maxLength:160})},{additionalProperties:false}),
      body:Type.Object({action:Type.Union([Type.Literal("mute"),Type.Literal("unmute"),Type.Literal("remove")])},{additionalProperties:false}),
    },
  },async request=>{
    const {talkId,participantId}=request.params as {talkId:string;participantId:string};
    const {action}=request.body as {action:"mute"|"unmute"|"remove"};
    return service.hostParticipant({authorizationHeader:request.headers.authorization,talkId,participantId,action});
  });

  app.post("/talks/:talkId/end",{schema:{params:TalkParams}},async request=>{
    const {talkId}=request.params as {talkId:string};
    return service.end({authorizationHeader:request.headers.authorization,talkId});
  });
}
