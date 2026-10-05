import type { FastifyInstance } from "fastify";
import type {
  TwinAttributionEventType,
  TwinAttributionInput,
  TwinAttributionService,
  createCommissionPolicyAdminService,
} from "./twin_attribution.js";

function text(value: unknown, name: string, max = 256): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value.trim();
}

function amount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000_000_000_000) {
    throw new TypeError("Invalid baseCredits");
  }
  return parsed;
}

function eventType(value: unknown): TwinAttributionEventType {
  const allowed: readonly TwinAttributionEventType[] = [
    "external-funding",
    "commerce-purchase",
    "internal-transfer",
    "gift",
    "refund",
    "reversal",
    "test",
    "admin",
  ];
  if (typeof value !== "string" || !allowed.includes(value as TwinAttributionEventType)) {
    throw new TypeError("Invalid attribution eventType");
  }
  return value as TwinAttributionEventType;
}

export function registerTwinAttributionRoutes(
  app: FastifyInstance,
  service: TwinAttributionService,
): void {
  app.post("/v1/monetization/attribution/quote", async (request) => {
    const body = request.body as Record<string, unknown>;
    const raw = body.attribution as Record<string, unknown>;
    const attribution: TwinAttributionInput = {
      attributionId: text(raw.attributionId, "attributionId"),
      ownerUserId: text(raw.ownerUserId, "ownerUserId"),
      characterId: text(raw.characterId, "characterId"),
      customerUserId:
        raw.customerUserId == null
          ? null
          : text(raw.customerUserId, "customerUserId"),
      eventType: eventType(raw.eventType),
      operationId: text(raw.operationId, "operationId"),
      attributedAt: text(raw.attributedAt, "attributedAt"),
      expiresAt:
        raw.expiresAt == null ? null : text(raw.expiresAt, "expiresAt"),
      selfAttribution: raw.selfAttribution === true,
    };
    return service.quote({
      authorizationHeader: request.headers.authorization,
      attribution,
      baseCredits: amount(body.baseCredits),
    });
  });
}


type CommissionPolicyAdminService = ReturnType<typeof createCommissionPolicyAdminService>;

function commissionEventType(value: unknown): "external-funding" | "commerce-purchase" {
  if (value !== "external-funding" && value !== "commerce-purchase") {
    throw new TypeError("Invalid commission eventType");
  }
  return value;
}

export function registerCommissionPolicyAdminRoutes(
  app: FastifyInstance,
  service: CommissionPolicyAdminService,
): void {
  app.get("/v1/admin/monetization/commission/:eventType", async (request) => {
    const params = request.params as Record<string, unknown>;
    return service.read({
      authorizationHeader: request.headers.authorization,
      eventType: commissionEventType(params.eventType),
    });
  });

  app.put("/v1/admin/monetization/commission/:eventType", async (request) => {
    const params = request.params as Record<string, unknown>;
    const body = request.body as Record<string, unknown>;
    const maximum =
      body.maximumCommissionCredits === null ||
      body.maximumCommissionCredits === undefined
        ? null
        : amount(body.maximumCommissionCredits);
    const effectiveAt =
      typeof body.effectiveAt === "string"
        ? body.effectiveAt
        : new Date().toISOString();
    return service.update({
      authorizationHeader: request.headers.authorization,
      eventType: commissionEventType(params.eventType),
      enabled: body.enabled === true,
      rateBasisPoints: amount(body.rateBasisPoints),
      minimumCommissionCredits: amount(body.minimumCommissionCredits),
      maximumCommissionCredits: maximum,
      effectiveAt,
    });
  });
}
