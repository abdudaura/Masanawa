import { describe, expect, it, vi } from "vitest";
import {
  createWhatsAppCloudApiHttpEdge,
  type ChannelHttpTransport,
  type RedactedCredentialSecret,
} from "./whatsapp-http-edge.js";

const token = "wa-secret-token-123";
const secret: RedactedCredentialSecret = {
  use(callback) {
    return callback(token);
  },
};

describe("WhatsApp Cloud API HTTP edge", () => {
  it("sends through versioned Graph messages endpoint with bearer secret", async () => {
    const request = vi.fn(async () => ({
      statusCode: 200,
      body: { messages: [{ id: "wamid.1" }] },
    }));
    const edge = createWhatsAppCloudApiHttpEdge({
      accessToken: secret,
      transport: { request },
      apiVersion: "v24.0",
    });

    await expect(
      edge.call({
        phoneNumberId: "123456789",
        body: { messaging_product: "whatsapp", to: "2348012345678" },
      }),
    ).resolves.toMatchObject({ status: "accepted" });

    const sent = request.mock.calls[0]![0];
    expect(sent.url).toBe(
      "https://graph.facebook.com/v24.0/123456789/messages",
    );
    expect(sent.headers.authorization).toBe(`Bearer ${token}`);
    expect(JSON.stringify(await edge.call({
      phoneNumberId:"123456789",
      body:{messaging_product:"whatsapp",to:"2348012345678"},
    }))).not.toContain(token);
  });

  it("maps explicit Graph rejection to a bounded safe code", async () => {
    const edge = createWhatsAppCloudApiHttpEdge({
      accessToken: secret,
      transport: {
        async request() {
          return {
            statusCode: 400,
            body: { error: { code: 131047, message: "private provider detail" } },
          };
        },
      },
      apiVersion: "v24.0",
    });

    await expect(
      edge.call({ phoneNumberId: "123", body: { test: true } }),
    ).resolves.toEqual({
      status: "rejected",
      safeCode: "graph_131047",
    });
  });

  it("redacts ambiguous transport errors including token-bearing request details", async () => {
    const transport: ChannelHttpTransport = {
      async request(input) {
        throw new Error(`failed request ${input.url} ${input.headers.authorization}`);
      },
    };
    const edge = createWhatsAppCloudApiHttpEdge({
      accessToken: secret,
      transport,
      apiVersion: "v24.0",
    });

    try {
      await edge.call({ phoneNumberId: "123", body: { test: true } });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toBe("Error: WhatsApp Cloud API request failed");
      expect(String(error)).not.toContain(token);
    }
  });

  it("rejects invalid Graph API versions and malformed HTTP status values", async () => {
    expect(() =>
      createWhatsAppCloudApiHttpEdge({
        accessToken: secret,
        transport: { async request(){ return {statusCode:200,body:{}}; } },
        apiVersion: "latest",
      }),
    ).toThrow(/version is invalid/);

    const edge = createWhatsAppCloudApiHttpEdge({
      accessToken: secret,
      transport: { async request(){ return {statusCode:999,body:{}}; } },
      apiVersion: "v24.0",
    });
    await expect(edge.call({phoneNumberId:"123",body:{}}))
      .rejects.toThrow(/invalid HTTP status/);
  });
});
