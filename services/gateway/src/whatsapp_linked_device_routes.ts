import type { FastifyInstance } from "fastify";
import type { LinkedWhatsAppController } from "./whatsapp_linked_device.js";

export interface LinkedWhatsAppAdminAuthorization {
  readonly adminToken?: string;
  readonly authorizeSession?: (
    authorizationHeader: string | undefined,
  ) => Promise<boolean>;
}

export function registerLinkedWhatsAppAdminRoutes(
  app: FastifyInstance,
  input: Readonly<{
    controller: LinkedWhatsAppController;
  }> & LinkedWhatsAppAdminAuthorization,
): void {
  const authorized = async (header: string | undefined): Promise<boolean> => {
    if (input.adminToken && header === `Bearer ${input.adminToken}`) {
      return true;
    }
    return await input.authorizeSession?.(header) === true;
  };

  app.get("/admin/channels/whatsapp/status", async (request, reply) => {
    if (!await authorized(request.headers.authorization)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const state = input.controller.snapshot();
    return {
      mode: state.mode,
      status: state.status,
      connected: state.connected,
      phone: state.phone,
      lastEvent: state.lastEvent,
      reconnectAttempt: state.reconnectAttempt,
      qrReady: Boolean(state.qrDataUrl),
    };
  });

  app.get("/admin/channels/whatsapp/qr", async (request, reply) => {
    if (!await authorized(request.headers.authorization)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const state = input.controller.snapshot();
    if (!state.qrDataUrl) {
      return reply.code(409).send({
        error: "qr_not_ready",
        status: state.status,
        connected: state.connected,
      });
    }
    return { qrDataUrl: state.qrDataUrl, status: state.status };
  });

  app.post("/admin/channels/whatsapp/reset", async (request, reply) => {
    if (!await authorized(request.headers.authorization)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    await input.controller.reset();
    return { success: true, status: input.controller.snapshot().status };
  });
}
