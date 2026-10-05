import type { FastifyInstance } from "fastify";
import type {
  OwnerAccessOfferingModality,
  createOwnerAccessOfferingService,
} from "./owner_access_offering.js";

type OwnerAccessOfferingService = ReturnType<
  typeof createOwnerAccessOfferingService
>;

function modality(value: unknown): OwnerAccessOfferingModality {
  if (value !== "text" && value !== "voice" && value !== "video") {
    throw new TypeError("Invalid owner access modality");
  }
  return value;
}

export function registerOwnerAccessOfferingRoutes(
  app: FastifyInstance,
  service: OwnerAccessOfferingService,
): void {
  app.get("/v1/twin/owner-access/offering", async (request) => {
    return service.read({
      authorizationHeader: request.headers.authorization,
    });
  });

  app.put("/v1/twin/owner-access/offering", async (request) => {
    const body = request.body as Record<string, unknown>;
    const modalities = Array.isArray(body.modalities)
      ? body.modalities.map(modality)
      : (() => {
          throw new TypeError("Invalid owner access modalities");
        })();
    const durations = Array.isArray(body.durationOptionsMinutes)
      ? body.durationOptionsMinutes.map((value) => Number(value))
      : (() => {
          throw new TypeError("Invalid owner access durations");
        })();

    return service.update({
      authorizationHeader: request.headers.authorization,
      enabled: body.enabled === true,
      modalities,
      durationOptionsMinutes: durations,
      priceCreditsPerMinute: Number(body.priceCreditsPerMinute),
    });
  });
}
