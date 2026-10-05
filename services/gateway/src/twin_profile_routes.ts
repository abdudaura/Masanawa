import type { FastifyInstance } from "fastify";
import type {
  TwinProfileService,
  TwinProfileUpdate,
} from "./twin_profile.js";

function bodyObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Request body must be an object");
  }
  return value as Record<string, unknown>;
}

function patchFromBody(value: unknown): TwinProfileUpdate {
  const body = bodyObject(value);
  const allowed = new Set([
    "displayName",
    "bio",
    "interests",
    "languages",
    "avatarUrl",
    "discoverable",
  ]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown twin profile field: ${key}`);
  }
  return body as TwinProfileUpdate;
}

export function registerTwinProfileRoutes(
  app: FastifyInstance,
  service: TwinProfileService,
): void {
  app.get("/agent/twin/profile", async (request, reply) => {
    const profile = await service.read({
      authorizationHeader: request.headers.authorization,
    });
    if (!profile) return reply.code(404).send({ error: "Twin profile not found" });
    return profile;
  });

  app.post("/agent/twin/profile/customize/preview", async (request) =>
    service.previewCustomization({
      authorizationHeader: request.headers.authorization,
      patch: patchFromBody(request.body),
    }),
  );

  app.post("/agent/twin/profile/customize", async (request) => {
    const body = bodyObject(request.body);
    const expectedRevision = body.expectedRevision;
    const confirmed = body.confirmed;
    const updatedAt = body.updatedAt;
    if (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 1) {
      throw new TypeError("expectedRevision is invalid");
    }
    if (typeof confirmed !== "boolean") throw new TypeError("confirmed is invalid");
    if (typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt))) {
      throw new TypeError("updatedAt is invalid");
    }
    const patchBody = { ...body };
    delete patchBody.expectedRevision;
    delete patchBody.confirmed;
    delete patchBody.updatedAt;
    return service.applyCustomization({
      authorizationHeader: request.headers.authorization,
      expectedRevision: expectedRevision as number,
      confirmed,
      updatedAt: updatedAt as never,
      patch: patchFromBody(patchBody),
    });
  });
}
