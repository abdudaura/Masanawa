import type { FastifyInstance } from "fastify";
import type {
  AdminPaidFeatureKey,
  PaidFeatureTrialAdminService,
} from "./paid_feature_trial_admin.js";

function feature(value: unknown): AdminPaidFeatureKey {
  if (
    value !== "twin-voice" &&
    value !== "owner-access" &&
    value !== "premium-twin"
  ) {
    throw new TypeError("Invalid paid feature");
  }
  return value;
}

function integer(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return parsed;
}

export function registerPaidFeatureTrialAdminRoutes(
  app: FastifyInstance,
  service: PaidFeatureTrialAdminService,
): void {
  app.get("/v1/admin/monetization/trials/:feature", async (request) => {
    const params = request.params as Record<string, unknown>;
    return service.read({
      authorizationHeader: request.headers.authorization,
      feature: feature(params.feature),
    });
  });

  app.put("/v1/admin/monetization/trials/:feature", async (request) => {
    const params = request.params as Record<string, unknown>;
    const body = request.body as Record<string, unknown>;
    return service.update({
      authorizationHeader: request.headers.authorization,
      feature: feature(params.feature),
      enabled: body.enabled === true,
      durationDays: integer(body.durationDays, "durationDays", 1, 365),
      maxUnits:
        body.maxUnits === null || body.maxUnits === undefined
          ? null
          : integer(body.maxUnits, "maxUnits", 1, 1_000_000_000),
      effectiveAt:
        typeof body.effectiveAt === "string"
          ? body.effectiveAt
          : new Date().toISOString(),
    });
  });
}
