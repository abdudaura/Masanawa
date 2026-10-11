import type { FastifyInstance, FastifyRequest } from "fastify";
// Structural port to the existing notifications PG adapter; do not import its
// source into the Gateway rootDir or create a second preferences authority.
const kinds = ["comment_reply","room_answer","followed_post","subscription","wallet","case_update"] as const;
type DeliveryKind = (typeof kinds)[number];
interface DeliveryActor { tenantId: string; fanUserId: string }
interface DeliveryPreferences {
  list(actor: DeliveryActor): Promise<Array<{kind:DeliveryKind;enabled:boolean}>>;
  set(actor:DeliveryActor, choice:{kind:DeliveryKind;enabled:boolean}):Promise<{kind:DeliveryKind;enabled:boolean}>;
}
const isDeliveryKind = (kind: unknown): kind is DeliveryKind =>
  typeof kind === "string" && (kinds as readonly string[]).includes(kind);

export interface DeliveryPrincipal extends DeliveryActor { signedIn: true }
/** Default disabled until AF00 injects the canonical session, pool and migration-gated flag. */
export function registerDeliveryPreferenceRoutes(app: FastifyInstance, deps: {
  preferences: DeliveryPreferences;
  resolvePrincipal: (req: FastifyRequest) => Promise<DeliveryPrincipal | null>;
  enabled?: () => boolean;
}): void {
  const fail = (reply: {code(n:number): {send(value:unknown):unknown}}, n: number, label: string) =>
    reply.code(n).send({error:{code:label}});
  async function actor(req: FastifyRequest): Promise<DeliveryActor|null> {
    const v = await deps.resolvePrincipal(req);
    return v?.signedIn === true && typeof v.tenantId === "string" && v.tenantId.length > 0 &&
      typeof v.fanUserId === "string" && v.fanUserId.length > 0
      ? { tenantId:v.tenantId, fanUserId:v.fanUserId } : null;
  }
  app.get("/v1/notification-preferences", async (req,reply) => {
    reply.header("Cache-Control", "no-store");
    if (deps.enabled?.() !== true) return fail(reply,503,"feature_disabled");
    const who = await actor(req);
    if (!who) return fail(reply,401,"unauthorized");
    try { return {items:await deps.preferences.list(who)}; }
    catch { return fail(reply,503,"preferences_unavailable"); }
  });
  app.put("/v1/notification-preferences/:kind", async (req,reply) => {
    reply.header("Cache-Control", "no-store");
    if (deps.enabled?.() !== true) return fail(reply,503,"feature_disabled");
    const who = await actor(req);
    if (!who) return fail(reply,401,"unauthorized");
    const {kind} = req.params as {kind?:unknown};
    const body = req.body;
    if (!isDeliveryKind(kind) || body == null || typeof body !== "object" ||
        Array.isArray(body) || Object.keys(body).length !== 1 ||
        !Object.prototype.hasOwnProperty.call(body,"enabled") ||
        typeof (body as {enabled?:unknown}).enabled !== "boolean") {
      return fail(reply,422,"invalid_preference");
    }
    try {
      const result=await deps.preferences.set(who,{kind,enabled:(body as {enabled:boolean}).enabled});
      return result;
    } catch(e) {
      if(e instanceof RangeError || e instanceof TypeError) return fail(reply,422,"invalid_preference");
      return fail(reply,503,"preferences_unavailable");
    }
  });
}
