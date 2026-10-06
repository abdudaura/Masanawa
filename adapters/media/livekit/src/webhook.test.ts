import { describe, expect, it } from "vitest";
import { CredentialSecret } from "@masanawa/security";
import {
  createLiveKitPresenceWebhookVerifier,
  type DecodedLiveKitWebhook,
} from "./webhook.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const room =
  "presence-session_00000000-0000-7000-8000-000000000002";

function verifier(event: DecodedLiveKitWebhook) {
  return createLiveKitPresenceWebhookVerifier({
    credentials: {
      async resolve() {
        return {
          serverUrl: "wss://presence.example.test",
          apiKey: "fixture-key",
          apiSecret: CredentialSecret.fromString("fixture-material"),
        };
      },
    },
    decoder: {
      async decode(input) {
        expect(input.rawBody).toBe('{"event":"signed"}');
        expect(input.authorization).toBe("Bearer fixture");
        return event;
      },
    },
  });
}

describe("LiveKit Presence webhook adapter", () => {
  it.each([
    ["participant_joined", "participant-joined"],
    ["participant_left", "participant-left"],
    ["participant_connection_aborted", "participant-connection-aborted"],
  ] as const)("normalizes authenticated %s lifecycle evidence", async (eventName, expected) => {
    const result = await verifier({
      event: eventName,
      id: "EV_0001",
      room: { name: room },
      participant: { identity: "user:g7" },
    }).verify({
      tenantId,
      rawBody: '{"event":"signed"}',
      authorization: "Bearer fixture",
    });

    expect(result).toEqual({
      kind: expected,
      providerEventId: "EV_0001",
      presenceSessionId: room,
      role: "user",
      connectionGeneration: 7,
    });
  });

  it("normalizes room-finished without inventing a participant", async () => {
    await expect(
      verifier({
        event: "room_finished",
        id: "EV_0002",
        room: { name: room },
      }).verify({
        tenantId,
        rawBody: '{"event":"signed"}',
        authorization: "Bearer fixture",
      }),
    ).resolves.toEqual({
      kind: "room-finished",
      providerEventId: "EV_0002",
      presenceSessionId: room,
      role: null,
      connectionGeneration: null,
    });
  });

  it("ignores unrelated transport events", async () => {
    await expect(
      verifier({
        event: "track_published",
        id: "EV_0003",
        room: { name: room },
        participant: { identity: "character:g1" },
      }).verify({
        tenantId,
        rawBody: '{"event":"signed"}',
        authorization: "Bearer fixture",
      }),
    ).resolves.toBeNull();
  });

  it("rejects non-Presence rooms and malformed generation identities", async () => {
    await expect(
      verifier({
        event: "participant_joined",
        id: "EV_0004",
        room: { name: "other-room" },
        participant: { identity: "user:g1" },
      }).verify({
        tenantId,
        rawBody: '{"event":"signed"}',
        authorization: "Bearer fixture",
      }),
    ).rejects.toThrow("presence-session");

    await expect(
      verifier({
        event: "participant_joined",
        id: "EV_0005",
        room: { name: room },
        participant: { identity: "user:old" },
      }).verify({
        tenantId,
        rawBody: '{"event":"signed"}',
        authorization: "Bearer fixture",
      }),
    ).rejects.toThrow("identity");
  });

  it("requires raw body before decoder invocation", async () => {
    let called = false;
    const service = createLiveKitPresenceWebhookVerifier({
      credentials: {
        async resolve() {
          return {
            serverUrl: "wss://presence.example.test",
            apiKey: "fixture-key",
            apiSecret: CredentialSecret.fromString("fixture-material"),
          };
        },
      },
      decoder: {
        async decode() {
          called = true;
          return {};
        },
      },
    });

    await expect(
      service.verify({
        tenantId,
        rawBody: "",
        authorization: "Bearer fixture",
      }),
    ).rejects.toThrow("raw body");
    expect(called).toBe(false);
  });
});
