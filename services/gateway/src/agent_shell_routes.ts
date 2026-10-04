import type { FastifyInstance } from "fastify";
import { parseCanonicalId } from "@masanawa/contracts";
import type {
  AgentShellService,
  LiveVoiceTokenService,
} from "./agent_shell_contract.js";
import type { MobilePushRegistrationService } from "./mobile_push.js";

type ShellOptions = {
  readonly agentShell?: AgentShellService;
  readonly liveVoiceTokens?: LiveVoiceTokenService;
  readonly mobilePush?: MobilePushRegistrationService;
};

function text(value: unknown, name: string, max = 2048): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

function integer(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return parsed;
}

function values(raw: unknown): Readonly<Record<string, string>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TypeError("Invalid action values");
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 100) throw new TypeError("Too many action values");
  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!key || key.length > 128 || typeof value !== "string" || value.length > 512) {
      throw new TypeError("Invalid action value");
    }
    result[key] = value;
  }
  return Object.freeze(result);
}

export function registerAgentShellRoutes(app: FastifyInstance, options: ShellOptions): void {
  if (options.agentShell) {
    const shell = options.agentShell;

    app.get("/v1/agent/shell/config", async (request) => {
      const query = request.query as Record<string, unknown>;
      let capabilities: Readonly<Record<string, unknown>> | undefined;
      if (typeof query.capabilities === "string" && query.capabilities.length <= 4096) {
        try {
          const parsed = JSON.parse(query.capabilities);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            capabilities = Object.freeze({ ...(parsed as Record<string, unknown>) });
          }
        } catch {
          throw new TypeError("Invalid shell capabilities");
        }
      }
      return shell.config({
        authorizationHeader: request.headers.authorization,
        characterId: text(query.characterId, "characterId", 160),
        ...(typeof query.clientVersion === "string"
          ? { clientVersion: query.clientVersion.slice(0, 64) }
          : {}),
        ...(capabilities ? { capabilities } : {}),
      });
    });

    app.get("/v1/agent/history", async (request) => {
      const query = request.query as Record<string, unknown>;
      return {
        messages: [
          ...(await shell.history({
            authorizationHeader: request.headers.authorization,
            characterId: text(query.characterId, "characterId", 160),
            limit: query.limit === undefined ? 100 : integer(query.limit, "limit", 1, 200),
            ...(typeof query.before === "string" && query.before
              ? { before: query.before.slice(0, 64) }
              : {}),
          })),
        ],
      };
    });

    app.get("/v1/agent/turns/:requestId/status", async (request) => {
      const query = request.query as Record<string, unknown>;
      const params = request.params as Record<string, unknown>;
      return shell.turnStatus({
        authorizationHeader: request.headers.authorization,
        characterId: text(query.characterId, "characterId", 160),
        requestId: parseCanonicalId("request", text(params.requestId, "requestId", 160)),
      });
    });

    app.get("/v1/agent/events", async (request) => {
      const query = request.query as Record<string, unknown>;
      return {
        events: [
          ...(await shell.events({
            authorizationHeader: request.headers.authorization,
            characterId: text(query.characterId, "characterId", 160),
            ...(typeof query.after === "string" && query.after
              ? { after: query.after.slice(0, 64) }
              : {}),
            limit: query.limit === undefined ? 100 : integer(query.limit, "limit", 1, 200),
          })),
        ],
      };
    });

    app.get("/v1/agent/events/stream", async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const characterId = text(query.characterId, "characterId", 160);
      const limit = query.limit === undefined ? 100 : integer(query.limit, "limit", 1, 100);
      let cursor =
        typeof query.after === "string" && query.after ? query.after.slice(0, 64) : undefined;

      reply.hijack();
      reply.raw.statusCode = 200;
      reply.raw.setHeader("content-type", "application/x-ndjson; charset=utf-8");
      reply.raw.setHeader("cache-control", "no-cache, no-transform");
      reply.raw.setHeader("x-content-type-options", "nosniff");

      let closed = false;
      reply.raw.once("close", () => {
        closed = true;
      });
      const until = Date.now() + 25_000;
      while (!closed && Date.now() < until) {
        const events = await shell.events({
          authorizationHeader: request.headers.authorization,
          characterId,
          ...(cursor ? { after: cursor } : {}),
          limit,
        });
        for (const event of events) {
          cursor = event.cursor;
          if (!reply.raw.destroyed && !reply.raw.writableEnded) {
            reply.raw.write(JSON.stringify(event) + "\n");
          }
        }
        if (events.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
      }
      if (!reply.raw.writableEnded) reply.raw.end();
    });

    app.post("/v1/agent/sessions/:characterSessionId/actions", async (request) => {
      const body = request.body as Record<string, unknown>;
      const params = request.params as Record<string, unknown>;
      return shell.dispatchAction({
        authorizationHeader: request.headers.authorization,
        characterId: text(body.characterId, "characterId", 160),
        characterSessionId: parseCanonicalId(
          "character-session",
          text(params.characterSessionId, "characterSessionId", 180),
        ),
        action: {
          documentId: text(body.documentId, "documentId", 128),
          revision: integer(body.revision, "revision", 0, 2_147_483_647),
          nodeId: text(body.nodeId, "nodeId", 128),
          actionId: text(body.actionId, "actionId", 128),
          token: text(body.token, "token", 2048),
          values: values(body.values),
        },
      });
    });

    app.post("/v1/agent/presence", async (request) => {
      const body = request.body as Record<string, unknown>;
      const state = text(body.state, "state", 32);
      if (!["available","listening","working","on_call","offline"].includes(state)) {
        throw new TypeError("Invalid presence state");
      }
      return shell.setPresence({
        authorizationHeader: request.headers.authorization,
        characterId: text(body.characterId, "characterId", 160),
        state: state as "available" | "listening" | "working" | "on_call" | "offline",
        durationMs: integer(body.durationMs, "durationMs", 5000, 86400000),
      });
    });

    app.get("/v1/agent/actions/status", async (request) => {
      const query = request.query as Record<string, unknown>;
      return {
        record: await shell.actionStatus({
          authorizationHeader: request.headers.authorization,
          characterId: text(query.characterId, "characterId", 160),
          documentId: text(query.documentId, "documentId", 128),
          revision: integer(query.revision, "revision", 0, 2_147_483_647),
        }),
      };
    });
  }

  if (options.liveVoiceTokens) {
    app.post("/v1/agent/live/token", async (request) => {
      const body = request.body as Record<string, unknown>;
      return options.liveVoiceTokens!.mint({
        authorizationHeader: request.headers.authorization,
        characterId: text(body.characterId, "characterId", 160),
      });
    });
  }

  if (options.mobilePush) {
    app.post("/v1/agent/push/register", async (request) => {
      const body = request.body as Record<string, unknown>;
      const platform = text(body.platform, "platform", 16);
      if (platform !== "android" && platform !== "ios") {
        throw new TypeError("Invalid push platform");
      }
      return options.mobilePush!.register({
        authorizationHeader: request.headers.authorization,
        characterId: text(body.characterId, "characterId", 160),
        installationId: text(body.installationId, "installationId", 128),
        platform,
        token: text(body.token, "token", 4096),
      });
    });

    app.post("/v1/agent/push/unregister", async (request) => {
      const body = request.body as Record<string, unknown>;
      return options.mobilePush!.unregister({
        authorizationHeader: request.headers.authorization,
        characterId: text(body.characterId, "characterId", 160),
        installationId: text(body.installationId, "installationId", 128),
      });
    });
  }
}
