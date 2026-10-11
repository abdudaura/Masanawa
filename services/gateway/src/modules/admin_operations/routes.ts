import type { FastifyInstance } from "fastify";
import { FLAG_NAMES, OperationsError, type OperationsService, type OperationsFlag } from "./service.js";

/** AF00 registers once under the gateway's existing authenticated /v1 authority. */
export function registerAdminOperationsRoutes(app: FastifyInstance, operations: OperationsService): void {
  void app.register(async (scope) => {
  scope.setErrorHandler((error, _request, reply) => {
    if (error instanceof OperationsError) {
      void reply.code(error.status).send({code: "admin_ops."+error.code});
    } else {
      void reply.send(error);
    }
  });
  scope.get("/v1/admin/ops/overview", async request => operations.overview(request.headers.authorization));
  scope.get("/v1/admin/ops/flags", async request => operations.flags(request.headers.authorization));
  scope.get<{Querystring:{name:string;enabled:string}}>("/v1/admin/ops/flags/preview", async request => {
    const {name,enabled}=request.query;
    if (!FLAG_NAMES.some(n=>n===name) || (enabled!=="true" && enabled!=="false")) throw new OperationsError("invalid",400);
    return operations.preview(request.headers.authorization,name as OperationsFlag,enabled==="true");
  });
  scope.put<{Params:{name:string};Body:{enabled:boolean;expectedRevision:number;idempotencyKey:string;reason:string}}>("/v1/admin/ops/flags/:name", async request => {
    const {name}=request.params;
    if (!FLAG_NAMES.some(n=>n===name)) throw new OperationsError("invalid",400);
    if (!request.body || typeof request.body !== "object") throw new OperationsError("invalid",400);
    const { enabled,expectedRevision,idempotencyKey,reason }=request.body;
    // Whitelist exact command members. Untrusted request body cannot override the
    // bound path flag, authenticated actor or canonical tenant.
    return operations.setFlag(request.headers.authorization,{
      name:name as OperationsFlag,enabled,expectedRevision,idempotencyKey,reason
    });
  });
  app.get<{Querystring:{limit?:string}}>("/v1/admin/staff/audit", async request => {
    const limit=request.query.limit===undefined?30:Number(request.query.limit);
    return operations.audit(request.headers.authorization,limit);
  });
  scope.get("/v1/admin/staff",async request=> operations.staff(request.headers.authorization));
  });
}
