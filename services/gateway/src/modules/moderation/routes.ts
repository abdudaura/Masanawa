import type {FastifyInstance} from "fastify";
import {CaseError} from "@masanawa/moderation";
import type {createCaseService} from "./service.js";
export type ModerationRoutes = ReturnType<typeof createCaseService>;
/** Feature-owned routes only. AF00 composes after auth, PG, and denylist review. */
export function registerModerationRoutes(app:FastifyInstance,service:ModerationRoutes):void {
 const wrap=<T>(operation:()=>Promise<T>):Promise<T>=>operation().catch(error=>{
  if(error instanceof CaseError)throw Object.assign(new Error(error.code),{statusCode:error.statusCode,code:error.code});
  throw error;
 });
 app.post("/v1/cases",async r=>wrap(()=>service.report(r.headers.authorization,r.body as Parameters<ModerationRoutes["report"]>[1])));
 app.get("/v1/cases",async r=>wrap(()=>service.ownCases(r.headers.authorization)));
 app.get("/v1/cases/:id",async r=>wrap(()=>service.read(r.headers.authorization,(r.params as {id:string}).id)));
 app.post("/v1/cases/:id/appeal",async r=>wrap(()=>service.appeal(r.headers.authorization,(r.params as {id:string}).id,(r.body as {reason:unknown}).reason)));
 app.get("/v1/admin/cases",async r=>wrap(()=>service.adminCases(r.headers.authorization)));
 app.get("/v1/admin/cases/:id",async r=>wrap(()=>service.read(r.headers.authorization,(r.params as {id:string}).id)));
 app.post("/v1/admin/cases/:id/actions",async r=>wrap(()=>service.propose(r.headers.authorization,(r.params as {id:string}).id,r.body as Parameters<ModerationRoutes["propose"]>[2])));
 app.post("/v1/admin/cases/:id/appeals/:appealId/review",async r=>wrap(()=>service.reviewAppeal(r.headers.authorization,
 (r.params as {id:string}).id,(r.params as {appealId:string}).appealId,
 r.body as Parameters<ModerationRoutes["reviewAppeal"]>[3])));
 app.post("/v1/admin/cases/:id/actions/:actionId/review",async r=>wrap(()=>service.review(r.headers.authorization,(r.params as {id:string,actionId:string}).id,(r.params as {actionId:string}).actionId,r.body as Parameters<ModerationRoutes["review"]>[3])));
}
