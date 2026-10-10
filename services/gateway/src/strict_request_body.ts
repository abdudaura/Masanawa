import type { FastifyRequest } from "fastify";

/** Reject forged fields before Fastify's default validator can strip them. */
export function strictRequestBody(allowed: readonly string[]) {
  const fields = new Set(allowed);
  return async (request: FastifyRequest): Promise<void> => {
    const body = request.body;
    if (body !== null && typeof body === "object" && !Array.isArray(body) &&
        Object.keys(body).some((field) => !fields.has(field))) {
      throw Object.assign(new Error("Invalid request"), { statusCode: 400 });
    }
  };
}
