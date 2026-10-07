import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerLinkedWhatsAppAdminRoutes } from "./whatsapp_linked_device_routes.js";
import type { LinkedWhatsAppController } from "./whatsapp_linked_device.js";

function controller(overrides: Partial<ReturnType<LinkedWhatsAppController["snapshot"]>> = {}) {
  const reset = vi.fn(async () => undefined);
  const value = {
    mode: "linked-device" as const,
    status: "qr" as const,
    connected: false,
    phone: null,
    qrDataUrl: "data:image/png;base64,qr",
    lastEvent: "qr-ready",
    reconnectAttempt: 0,
    ...overrides,
  };
  return {
    controller: {
      snapshot: () => value,
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      reset,
    } satisfies LinkedWhatsAppController,
    reset,
  };
}

describe("linked WhatsApp admin routes", () => {
  it("protects status and QR with the dedicated admin bearer token", async () => {
    const app = Fastify();
    const state = controller();
    registerLinkedWhatsAppAdminRoutes(app, {
      controller: state.controller,
      adminToken: "admin-secret",
    });

    const denied = await app.inject({
      method: "GET",
      url: "/admin/channels/whatsapp/status",
    });
    expect(denied.statusCode).toBe(401);

    const status = await app.inject({
      method: "GET",
      url: "/admin/channels/whatsapp/status",
      headers: { authorization: "Bearer admin-secret" },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({
      mode: "linked-device",
      status: "qr",
      connected: false,
      phone: null,
      lastEvent: "qr-ready",
      reconnectAttempt: 0,
      qrReady: true,
    });

    const qr = await app.inject({
      method: "GET",
      url: "/admin/channels/whatsapp/qr",
      headers: { authorization: "Bearer admin-secret" },
    });
    expect(qr.statusCode).toBe(200);
    expect(qr.json()).toEqual({
      qrDataUrl: "data:image/png;base64,qr",
      status: "qr",
    });

    await app.close();
  });

  it("does not expose a stale QR after the session is connected", async () => {
    const app = Fastify();
    const state = controller({
      status: "connected",
      connected: true,
      phone: "+2348012345678",
      qrDataUrl: null,
      lastEvent: "connected",
    });
    registerLinkedWhatsAppAdminRoutes(app, {
      controller: state.controller,
      adminToken: "admin-secret",
    });

    const qr = await app.inject({
      method: "GET",
      url: "/admin/channels/whatsapp/qr",
      headers: { authorization: "Bearer admin-secret" },
    });
    expect(qr.statusCode).toBe(409);
    expect(qr.json()).toMatchObject({
      error: "qr_not_ready",
      status: "connected",
      connected: true,
    });

    await app.close();
  });

  it("requires authorization before resetting the linked session", async () => {
    const app = Fastify();
    const state = controller();
    registerLinkedWhatsAppAdminRoutes(app, {
      controller: state.controller,
      adminToken: "admin-secret",
    });

    const denied = await app.inject({
      method: "POST",
      url: "/admin/channels/whatsapp/reset",
    });
    expect(denied.statusCode).toBe(401);
    expect(state.reset).not.toHaveBeenCalled();

    const accepted = await app.inject({
      method: "POST",
      url: "/admin/channels/whatsapp/reset",
      headers: { authorization: "Bearer admin-secret" },
    });
    expect(accepted.statusCode).toBe(200);
    expect(state.reset).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
