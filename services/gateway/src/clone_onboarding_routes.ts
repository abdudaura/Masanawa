import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { CloneSetupError } from "@masanawa/identity";
import { PlatformError } from "@masanawa/contracts";
import type { CloneOnboardingService } from "./clone_onboarding.js";
import { createGatewayApp, type GatewayAppOptions } from "./app.js";

const Revision = Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
const ShortText = Type.String({ minLength: 1, maxLength: 120 });
const StringList = (maximum: number, minimum = 1) => Type.Array(ShortText, { minItems: minimum, maxItems: maximum });
const Profile = Type.Object({
  displayName: Type.Optional(Type.Union([ShortText, Type.Null()])),
  biography: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })),
  languages: Type.Optional(StringList(16, 0)),
  personality: Type.Optional(StringList(24)),
  expertise: Type.Optional(StringList(32)),
}, { additionalProperties: false });
/** Registrar for the existing Gateway composition owner; no second auth/runtime. */
export async function registerCloneOnboardingRoutes(app: FastifyInstance, service: CloneOnboardingService): Promise<void> {
  await app.register(async routes => {
    routes.addHook("onSend", async (_request, reply, payload) => {
      reply.header("Cache-Control", "private, no-store");
      return payload;
    });
    // Fastify's default AJV removes additional fields. Reject them BEFORE
    // validation so forged scope/technical settings are not silently accepted.
    routes.addHook("preValidation", async request => {
      const fields: Readonly<Record<string, readonly string[]>> = {
        "/creator/onboarding/profile": ["expectedRevision", "profile"],
        "/creator/onboarding/preview": ["expectedRevision"],
        "/creator/onboarding/confirm": ["expectedPreviewRevision", "requestId"],
        "/creator/onboarding/cancel": ["expectedRevision"],
        "/creator/onboarding/support": ["characterId"],
      };
      const routeUrl = (request.routeOptions.url ?? "").replace(/^\/v1(?=\/)/u, "");
      const allowed = fields[routeUrl];
      const body = request.body;
      if (allowed && body && typeof body === "object" && Object.keys(body).some(key => !allowed.includes(key))) throw new CloneSetupError("invalid");
      if (routeUrl === "/creator/onboarding/profile" && body && typeof body === "object") {
        const profile = (body as Record<string, unknown>).profile;
        if (profile && typeof profile === "object" && Object.keys(profile).some(key => !["displayName", "biography", "languages", "personality", "expertise"].includes(key))) throw new CloneSetupError("invalid");
      }
    });
    routes.setErrorHandler((error, _request, reply) => {
      if (error instanceof CloneSetupError) {
        const status = error.code === "invalid" ? 400 : 409;
        return reply.code(status).send({ error: `clone.setup.${error.code}`, message: error.code === "conflict" ? "Setup changed. Reload the current profile before confirming." : error.code === "confirmed" ? "This profile is already confirmed. Resume setup to finish." : "Review the profile and complete the required fields." });
      }
      const fault = error && typeof error === "object" ? error as { readonly validation?: unknown; readonly statusCode?: number } : {};
      if (fault.validation) return reply.code(400).send({ error: "clone.setup.invalid", message: "Check the setup fields." });
      // Preserve typed authentication status; arbitrary exception text stays private.
      const status = error instanceof PlatformError && error.category === "authentication" ? 401
        : error instanceof PlatformError && error.category === "authorization" ? 403
        : fault.statusCode === 401 || fault.statusCode === 403 ? fault.statusCode : 503;
      return reply.code(status).send({ error: status === 503 ? "clone.setup.unavailable" : "clone.setup.denied", message: status === 503 ? "Setup could not finish. Reload and resume the confirmed request." : "Sign in with an authorized account." });
    });
    routes.get("/creator/onboarding", async request => service.read({ authorizationHeader: request.headers.authorization }));
    routes.put<{ Body: { expectedRevision: number | null; profile: unknown } }>("/creator/onboarding/profile", {
      schema: { body: Type.Object({ expectedRevision: Type.Union([Revision, Type.Null()]), profile: Profile }, { additionalProperties: false }) },
    }, async request => service.save({ authorizationHeader: request.headers.authorization, ...request.body }));
    routes.post<{ Body: { expectedRevision: number } }>("/creator/onboarding/preview", {
      schema: { body: Type.Object({ expectedRevision: Revision }, { additionalProperties: false }) },
    }, async request => service.preview({ authorizationHeader: request.headers.authorization, ...request.body }));
    routes.post<{ Body: { expectedPreviewRevision: number; requestId: string } }>("/creator/onboarding/confirm", {
      schema: { body: Type.Object({ expectedPreviewRevision: Revision, requestId: Type.String({ minLength: 1, maxLength: 100 }) }, { additionalProperties: false }) },
    }, async request => service.confirm({ authorizationHeader: request.headers.authorization, ...request.body }));
    routes.post<{ Body: { expectedRevision: number } }>("/creator/onboarding/cancel", {
      schema: { body: Type.Object({ expectedRevision: Revision }, { additionalProperties: false }) },
    }, async request => service.cancel({ authorizationHeader: request.headers.authorization, ...request.body }));
    routes.put<{ Body: { characterId: string } }>("/creator/onboarding/support", {
      schema: { body: Type.Object({ characterId: Type.String({ minLength: 1, maxLength: 100 }) }, { additionalProperties: false }) },
    }, async request => service.selectSupport({ authorizationHeader: request.headers.authorization, ...request.body }));
  });
}

/** Existing startGatewayService appFactory seam; owners supply canonical ports. */
export function createGatewayWithCloneOnboarding(options: GatewayAppOptions & { readonly cloneOnboarding: CloneOnboardingService }) {
  return createGatewayApp(options);
}
