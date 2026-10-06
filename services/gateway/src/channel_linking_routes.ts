import type { FastifyInstance } from "fastify";
import type { LaunchChannelKind } from "@masanawa/identity";
import type { ChannelLinkingService } from "./channel_linking.js";

function bodyObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Request body must be an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const set = new Set(allowed);
  for (const key of Object.keys(body)) {
    if (!set.has(key)) {
      throw new TypeError(`Unknown channel linking field: ${key}`);
    }
  }
}

function text(
  value: unknown,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function channel(value: unknown): LaunchChannelKind {
  if (value !== "whatsapp" && value !== "telegram") {
    throw new TypeError("channel is invalid");
  }
  return value;
}

export function registerChannelLinkingRoutes(
  app: FastifyInstance,
  service: ChannelLinkingService,
): void {
  app.post("/v1/channels/link/challenges", async (request) => {
    const body = bodyObject(request.body);
    exactKeys(body, ["requestId", "channelAccountId", "channel"]);

    return service.issue({
      authorizationHeader: request.headers.authorization,
      requestId: text(body.requestId, "requestId", 8, 180),
      channelAccountId: text(
        body.channelAccountId,
        "channelAccountId",
        8,
        180,
      ),
      channel: channel(body.channel),
    });
  });

  app.post(
    "/v1/channels/link/challenges/:requestId/verify",
    async (request) => {
      const params = request.params as Record<string, unknown>;
      const body = bodyObject(request.body);
      exactKeys(body, [
        "transportEvidence",
        "channelAccountId",
        "channel",
        "externalSubjectId",
        "secret",
      ]);

      return service.verify({
        transportEvidence: text(
          body.transportEvidence,
          "transportEvidence",
          8,
          4096,
        ),
        requestId: text(params.requestId, "requestId", 8, 180),
        channelAccountId: text(
          body.channelAccountId,
          "channelAccountId",
          8,
          180,
        ),
        channel: channel(body.channel),
        externalSubjectId: text(
          body.externalSubjectId,
          "externalSubjectId",
          1,
          512,
        ),
        secret: text(body.secret, "secret", 20, 128),
      });
    },
  );
}
