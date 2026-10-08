
import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { strictRequestBody } from "../strict_request_body.js";
import { SupportError } from "./model.js";
import type { SupportStaffService } from "./operator.js";

const statuses=Type.Union([
  Type.Literal("queued"),Type.Literal("reviewing"),
  Type.Literal("resolved"),Type.Literal("closed"),
]);

/** Register ONLY when supplied with a real privileged staff-role authorizer.
 * No public bearer/session or admin-token shortcut is installed here.
 */
export function registerSupportStaffRoutes(app: FastifyInstance, service: SupportStaffService): void {
  const failure=(error:unknown,reply:{code(status:number):unknown})=>{
    if(error instanceof SupportError){reply.code(error.statusCode);return {error:error.code};}
    reply.code(403);return {error:"SUPPORT_STAFF_FORBIDDEN"};
  };
  app.get("/v1/support/admin/queue",{
    schema:{querystring:Type.Object({
      limit:Type.Optional(Type.Integer({minimum:1,maximum:100})),
    },{additionalProperties:false})},
  },async(request,reply)=>{
    try{
      const q=request.query as {limit?:number};
      return {tickets:await service.queue({authorizationHeader:request.headers.authorization,limit:q.limit??30})};
    }catch(error){return failure(error,reply);}
  });
  app.post("/v1/support/admin/tickets/:id/transition",{
    preValidation: strictRequestBody(["expectedStatus", "nextStatus", "resolution"]),
    schema:{
      params:Type.Object({id:Type.String({format:"uuid"})},{additionalProperties:false}),
      body:Type.Object({
        expectedStatus:statuses,nextStatus:statuses,
        resolution:Type.Optional(Type.String({minLength:20,maxLength:1000})),
      },{additionalProperties:false}),
    },
  },async(request,reply)=>{
    try{
      const params=request.params as {id:string};
      const body=request.body as {expectedStatus:"queued"|"reviewing"|"resolved"|"closed";nextStatus:"queued"|"reviewing"|"resolved"|"closed";resolution?:string};
      return await service.transition({
        authorizationHeader:request.headers.authorization,ticketId:params.id,...body,
      });
    }catch(error){return failure(error,reply);}
  });
}

