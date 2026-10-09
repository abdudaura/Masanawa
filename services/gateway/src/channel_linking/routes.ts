import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import { LinkError, parseLinkChannel, type LinkIdentity, type LinkingService } from "./service.js";

export interface LinkedChannelsRoutesOptions {
  readonly authorize: PlatformCustomerSessionAuthorizer;
  readonly service: LinkingService;
}

function errorResponse(reply: FastifyReply, cause: unknown): unknown {
  if (cause instanceof LinkError) return reply.code(cause.status).send({ error: cause.code });
  if (cause && typeof cause === "object" && "statusCode" in cause) {
    const status = Number(cause.statusCode);
    if (status === 401 || status === 403) return reply.code(status).send({ error: "UNAUTHORIZED" });
  }
  // Do not expose provider identifiers, generated codes, database details, or tokens.
  return reply.code(503).send({ error: "CHANNEL_STORAGE_UNAVAILABLE" });
}

function noBody(request: FastifyRequest): void {
  const body = request.body;
  if (body !== undefined && body !== null &&
      (typeof body !== "object" || Array.isArray(body) ||
       Object.keys(body as object).length > 0)) {
    throw new LinkError("INVALID_CHANNEL", 400);
  }
}

export function registerLinkedChannelsRoutes(
  app: FastifyInstance,
  options: LinkedChannelsRoutesOptions,
): void {
  const ownerOf = async (request: FastifyRequest): Promise<LinkIdentity> => {
    const identity = await options.authorize.authorize({
      authorizationHeader: request.headers.authorization,
    });
    return Object.freeze({ tenantId: identity.tenantId, userId: identity.userId });
  };
  const channelOf = (request: FastifyRequest) =>
    parseLinkChannel((request.params as { channel?: unknown }).channel);

  app.get("/v1/me/linked-channels", async (request, reply) => {
    try { return { channels: await options.service.status(await ownerOf(request)) }; }
    catch (error) { return errorResponse(reply, error); }
  });

  app.post("/v1/me/linked-channels/:channel/begin", async (request, reply) => {
    try {
      noBody(request);
      const owner = await ownerOf(request);
      const channel = channelOf(request);
      return reply.code(201).send(await options.service.begin(owner, channel));
    } catch (error) { return errorResponse(reply, error); }
  });

  app.delete("/v1/me/linked-channels/:channel", async (request, reply) => {
    try {
      const owner = await ownerOf(request);
      const channel = channelOf(request);
      await options.service.unlink(owner, channel);
      return { channel, linked: false };
    } catch (error) { return errorResponse(reply, error); }
  });

  app.post("/v1/me/linked-channels/:channel/prefer", async (request, reply) => {
    try {
      noBody(request);
      const owner = await ownerOf(request);
      const channel = channelOf(request);
      await options.service.prefer(owner, channel);
      return { channel, preferred: true };
    } catch (error) { return errorResponse(reply, error); }
  });
}

