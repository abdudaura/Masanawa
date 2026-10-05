import type { FastifyInstance } from "fastify";
import type { PaidVoiceService } from "./paid_voice.js";

function text(value: unknown, name: string, max = 256): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    throw new TypeError(`Invalid ${name}`);
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

export function registerPaidVoiceRoutes(
  app: FastifyInstance,
  service: PaidVoiceService,
): void {
  app.post("/agent/twin/voice/quote", async (request) => {
    const body = request.body as Record<string, unknown>;
    return service.quote({
      authorizationHeader: request.headers.authorization,
      characterId: text(body.characterId, "characterId", 180),
      expectedSeconds: integer(body.expectedSeconds, "expectedSeconds", 30, 3600),
    });
  });

  app.post("/agent/twin/voice/start", async (request) => {
    const body = request.body as Record<string, unknown>;
    return service.start({
      authorizationHeader: request.headers.authorization,
      characterId: text(body.characterId, "characterId", 180),
      quoteId: text(body.quoteId, "quoteId", 256),
      accepted: body.accepted === true,
    });
  });
}


export interface PaidVoiceSettlementService {
  complete(input: {
    readonly authorizationHeader: string | undefined;
    readonly admissionId: string;
    readonly outcome: "completed" | "interrupted";
  }): Promise<Readonly<Record<string, unknown>>>;
}

export function registerPaidVoiceSettlementRoutes(
  app: FastifyInstance,
  service: PaidVoiceSettlementService,
): void {
  app.post("/agent/twin/voice/:admissionId/complete", async (request) => {
    const params = request.params as Record<string, unknown>;
    const body = request.body as Record<string, unknown>;
    const outcome =
      body.outcome === "interrupted" ? "interrupted" : "completed";
    return service.complete({
      authorizationHeader: request.headers.authorization,
      admissionId: text(params.admissionId, "admissionId", 256),
      outcome,
    });
  });
}
