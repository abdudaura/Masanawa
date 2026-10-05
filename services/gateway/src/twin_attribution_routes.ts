import type { FastifyInstance } from "fastify";
import type {
  TwinAttributionEventType,
  TwinAttributionInput,
  TwinAttributionService,
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
