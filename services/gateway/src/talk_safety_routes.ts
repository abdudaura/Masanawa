import { strictRequestBody } from './strict_request_body.js';
import type { FastifyRequest } from 'fastify';
import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkSafetyService } from "./talk_safety/service.js";

async function validatePreference(request: FastifyRequest): Promise<void> {
  await strictRequestBody(["blocked", "muted"])(request);
  const body = request.body as { blocked?: unknown; muted?: unknown } | null;
  if (!body || typeof body.blocked !== "boolean" || typeof body.muted !== "boolean") {
    throw Object.assign(new Error("Invalid preference"), { statusCode: 400 });
  }
}

const targetKind=Type.Union([
  Type.Literal("talk"),
  Type.Literal("replay"),
  Type.Literal("comment"),
  Type.Literal("profile"),
  Type.Literal("persona"),
]);

export function registerTalkSafetyRoutes(
  app:FastifyInstance,
  service:TalkSafetyService,
):void{
  app.post(
    "/safety/reports",
    {
      schema:{
        body:Type.Object({
          targetKind,
          targetId:Type.String({minLength:1,maxLength:256}),
          reason:Type.Union([
            Type.Literal("spam"),Type.Literal("harassment"),Type.Literal("hate"),
            Type.Literal("sexual"),Type.Literal("violence"),Type.Literal("self-harm"),
            Type.Literal("fraud"),Type.Literal("impersonation"),Type.Literal("privacy"),
            Type.Literal("other"),
          ]),
          detail:Type.Optional(Type.Union([Type.String({minLength:1,maxLength:2000}),Type.Null()])),
          clientRequestId:Type.String({minLength:1,maxLength:256}),
          expectedReporterUserId:Type.Optional(Type.String({minLength:3,maxLength:256})),
        },{additionalProperties:false}),
      },
    },
    async(request,reply)=>{
      const body=request.body as {
        targetKind:"talk"|"replay"|"comment"|"profile"|"persona";
        targetId:string;
        reason:"spam"|"harassment"|"hate"|"sexual"|"violence"|"self-harm"|"fraud"|"impersonation"|"privacy"|"other";
        detail?:string|null;
        clientRequestId:string;
        expectedReporterUserId?:string;
      };
      const result=await service.report({
        authorizationHeader:request.headers.authorization,
        ...body,
      });
      reply.code(202);
      return result;
    },
  );

  app.get(
    "/safety/profiles/:handle/preference",
    {
      schema:{
        params:Type.Object({handle:Type.String({minLength:2,maxLength:40})},{additionalProperties:false}),
      },
    },
    async(request)=>{
      const params=request.params as {handle:string};
      return service.readPreference({
        authorizationHeader:request.headers.authorization,
        handle:params.handle,
      });
    },
  );

  app.put(
    "/safety/profiles/:handle/preference",
    {
      preValidation: validatePreference,
      schema:{
        params:Type.Object({handle:Type.String({minLength:2,maxLength:40})},{additionalProperties:false}),
        body:Type.Object({
          blocked:Type.Boolean(),
          muted:Type.Boolean(),
        },{additionalProperties:false}),
      },
    },
    async(request)=>{
      const params=request.params as {handle:string};
      const body=request.body as {blocked:boolean;muted:boolean};
      return service.setPreference({
        authorizationHeader:request.headers.authorization,
        handle:params.handle,
        blocked:body.blocked,
        muted:body.muted,
      });
    },
  );

  app.get(
    "/safety/users/:userId/preference",
    {
      schema:{
        params:Type.Object({userId:Type.String({minLength:3,maxLength:256})},{additionalProperties:false}),
      },
    },
    async(request)=>{
      const params=request.params as {userId:string};
      return service.readUserPreference({
        authorizationHeader:request.headers.authorization,
        userId:params.userId,
      });
    },
  );

  app.put(
    "/safety/users/:userId/preference",
    {
      preValidation: validatePreference,
      schema:{
        params:Type.Object({userId:Type.String({minLength:3,maxLength:256})},{additionalProperties:false}),
        body:Type.Object({
          blocked:Type.Boolean(),
          muted:Type.Boolean(),
        },{additionalProperties:false}),
      },
    },
    async(request)=>{
      const params=request.params as {userId:string};
      const body=request.body as {blocked:boolean;muted:boolean};
      return service.setUserPreference({
        authorizationHeader:request.headers.authorization,
        userId:params.userId,
        blocked:body.blocked,
        muted:body.muted,
      });
    },
  );

  app.get(
    "/admin/talk-safety/:kind/:targetId",
    {
      schema:{
        params:Type.Object({
          kind:targetKind,
          targetId:Type.String({minLength:1,maxLength:256}),
        },{additionalProperties:false}),
      },
    },
    async(request)=>{
      const params=request.params as {
        kind:"talk"|"replay"|"comment"|"profile"|"persona";
        targetId:string;
      };
      return service.readEnforcement({
        authorizationHeader:request.headers.authorization,
        targetKind:params.kind,
        targetId:params.targetId,
      });
    },
  );

  app.put(
    "/admin/talk-safety/:kind/:targetId",
    {
      schema:{
        params:Type.Object({
          kind:targetKind,
          targetId:Type.String({minLength:1,maxLength:256}),
        },{additionalProperties:false}),
        body:Type.Object({
          expectedRevision:Type.Integer({minimum:0}),
          visibility:Type.Union([
            Type.Literal("public"),
            Type.Literal("restricted"),
            Type.Literal("blocked"),
          ]),
          reasonCode:Type.Union([Type.String({minLength:1,maxLength:160}),Type.Null()]),
        },{additionalProperties:false}),
      },
    },
    async(request)=>{
      const params=request.params as {
        kind:"talk"|"replay"|"comment"|"profile"|"persona";
        targetId:string;
      };
      const body=request.body as {
        expectedRevision:number;
        visibility:"public"|"restricted"|"blocked";
        reasonCode:string|null;
      };
      return service.setEnforcement({
        authorizationHeader:request.headers.authorization,
        targetKind:params.kind,
        targetId:params.targetId,
        ...body,
      });
    },
  );
}

