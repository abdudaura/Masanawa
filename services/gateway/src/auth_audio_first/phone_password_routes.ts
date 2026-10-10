import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Type from "typebox";
import { CustomerAuthError } from "../customer_auth.js";
import type { PhonePasswordAuthService } from "./phone_password.js";

/**
 * AF00 mounts this ONLY after applying the credential migration and a
 * shared persistent per-IP/per-number signup/login rate limiter. Never
 * expose a new authentication surface on an unthrottled public Gateway.
 */
export function registerPhonePasswordRoutes(app: FastifyInstance, service: PhonePasswordAuthService): void {
  const router = app.withTypeProvider<TypeBoxTypeProvider>();
  const phone = Type.String({ minLength: 8, maxLength: 16, pattern: "^\\+[1-9][0-9]{6,14}$" });
  const password = Type.String({ minLength: 8, maxLength: 16, pattern: "^[0-9]{8,16}$" });

  function fail(error: unknown, reply: { code(statusCode: number): unknown }) {
    if (error instanceof CustomerAuthError) {
      reply.code(error.statusCode);
      return { code: error.code, message: error.code };
    }
    reply.code(503);
    return { code: "AUTH_UNAVAILABLE", message: "AUTH_UNAVAILABLE" };
  }

  router.post("/auth/phone/register", {
    schema: {
      body: Type.Object({
        phone, password,
        name: Type.String({ minLength: 1, maxLength: 160 }),
      }, { additionalProperties: false }),
    },
  }, async (request, reply) => {
    reply.header("cache-control", "no-store");
    try {
      return await service.register(request.body);
    } catch (error) {
      return fail(error, reply);
    }
  });

  router.post("/auth/phone/login", {
    schema: {
      body: Type.Object({ phone, password }, { additionalProperties: false }),
    },
  }, async (request, reply) => {
    reply.header("cache-control", "no-store");
    try {
      return await service.login(request.body);
    } catch (error) {
      return fail(error, reply);
    }
  });
}
