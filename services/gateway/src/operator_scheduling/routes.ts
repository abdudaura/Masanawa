import type {FastifyInstance} from "fastify";
import Type from "typebox";
import type {ScheduleService} from "@masanawa/operator-scheduling";

/** Standalone plugin. F11/F18 must compose only after identity and
 * reference-access adapters, DB migration, R14 push, and worker are live.
 */
export function registerOperatorSchedulingRoutes(
  app: FastifyInstance, schedules: ScheduleService,
): void {
  app.get("/v1/operator/schedules", async (request) => ({
    schedules: await schedules.list(request.headers.authorization),
  }));
  app.post("/v1/operator/schedules", {
    schema: {body: Type.Object({
      requestId: Type.String({minLength:36,maxLength:36}),
      spec: Type.Object({
        kind: Type.Union([Type.Literal("talk_reminder"),
          Type.Literal("lesson_followup"),Type.Literal("artifact_ready")]),
        referenceId: Type.String({minLength:5,maxLength:160}),
        frequency: Type.Union([Type.Literal("once"),Type.Literal("daily"),Type.Literal("weekly")]),
        timezone: Type.String({minLength:1,maxLength:80}),
        runAt: Type.Optional(Type.String()),
        localTime: Type.Optional(Type.String()),
        dayOfWeek: Type.Optional(Type.Integer({minimum:1,maximum:7})),
        quietStart: Type.String(),
        quietEnd: Type.String(),
        optedIn: Type.Literal(true),
      },{additionalProperties:false}),
    },{additionalProperties:false})},
  },async request => {
    const body = request.body as {requestId:string;spec:unknown};
    return {schedule:await schedules.create({
      authorizationHeader:request.headers.authorization,
      requestId:body.requestId,spec:body.spec,
    })};
  });
  app.post("/v1/operator/schedules/:id/actions",{
    schema: {
      params:Type.Object({id:Type.String({minLength:36,maxLength:36})},
        {additionalProperties:false}),
      body:Type.Object({
        revision:Type.Integer({minimum:1}),
        action:Type.Union([Type.Literal("pause"),
          Type.Literal("resume"),Type.Literal("cancel")]),
      },{additionalProperties:false}),
    },
  },async request => {
    const p=request.params as {id:string};
    const b=request.body as {revision:number;action:"pause"|"resume"|"cancel"};
    return {schedule:await schedules.change({
      authorizationHeader:request.headers.authorization,
      scheduleId:p.id,revision:b.revision,action:b.action,
    })};
  });
}
