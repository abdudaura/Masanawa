import type { FastifyInstance } from "fastify";
import type {
  ProviderValuationEventType,
  createProviderValuationPolicyAdminService,
} from "./provider_valuation_admin.js";

type ProviderValuationAdminService =
  ReturnType<typeof createProviderValuationPolicyAdminService>;

function eventType(value: unknown): ProviderValuationEventType {
  if (value !== "external-funding" && value !== "commerce-purchase") {
    throw new TypeError("Invalid valuation eventType");
  }
  return value;
}

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`Invalid ${name}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return normalized;
}

function amount(value: unknown, name: string, min: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > 1_000_000_000_000
  ) {
    throw new TypeError(`Invalid ${name}`);
  }
  return parsed;
}

export function registerProviderValuationAdminRoutes(
  app: FastifyInstance,
  service: ProviderValuationAdminService,
): void {
  app.get("/v1/admin/monetization/valuation", async (request) => {
    const query = request.query as Record<string, unknown>;
    return service.read({
      authorizationHeader: request.headers.authorization,
      valuationKey: text(query.valuationKey, "valuationKey", 128),
      eventType: eventType(query.eventType),
    });
  });

  app.put("/v1/admin/monetization/valuation", async (request) => {
    const body = request.body as Record<string, unknown>;
    return service.update({
      authorizationHeader: request.headers.authorization,
      valuationKey: text(body.valuationKey, "valuationKey", 128),
      eventType: eventType(body.eventType),
      enabled: body.enabled === true,
      sourceUnit: text(body.sourceUnit, "sourceUnit", 64),
      sourceUnitsPerStep: amount(
        body.sourceUnitsPerStep,
        "sourceUnitsPerStep",
        1,
      ),
      creditUnitsPerStep: amount(
        body.creditUnitsPerStep,
        "creditUnitsPerStep",
        1,
      ),
      minimumSourceUnits: amount(
        body.minimumSourceUnits,
        "minimumSourceUnits",
        0,
      ),
      maximumBaseCredits:
        body.maximumBaseCredits === null ||
        body.maximumBaseCredits === undefined
          ? null
          : amount(body.maximumBaseCredits, "maximumBaseCredits", 0),
      effectiveAt:
        typeof body.effectiveAt === "string"
          ? body.effectiveAt
          : new Date().toISOString(),
    });
  });
}
