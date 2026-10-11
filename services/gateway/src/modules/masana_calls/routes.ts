import type { FastifyInstance } from "fastify";
import { CallFault, type createMasanaCallService } from "./service.js";
export type MasanaCallService = ReturnType<typeof createMasanaCallService>;
/** AF00 composes this feature route exactly once; no legacy Talk/Seat entry. */
export function registerMasanaCallRoutes(app: FastifyInstance, service: MasanaCallService): void {
  void app.register(async scope => {
    scope.setErrorHandler((err, _request, reply) => {
      if (err instanceof CallFault) { void reply.code(err.status).send({code:err.code}); return; }
      void reply.send(err);
    });
    scope.post("/v1/calls", async request => service.start(request.headers.authorization,request.body));
    scope.get<{Params:{id:string}}>("/v1/calls/:id",async request=>
      service.status(request.headers.authorization,request.params.id));
    scope.post<{Params:{id:string}}>("/v1/calls/:id/connected",async request=>
      service.markConnected(request.headers.authorization,request.params.id));
    scope.post<{Params:{id:string}}>("/v1/calls/:id/end",async request=>
      service.end(request.headers.authorization,request.params.id));
  });
}
