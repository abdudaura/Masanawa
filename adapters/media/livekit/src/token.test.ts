import { describe, expect, it } from "vitest";
import { CredentialSecret } from "@masanawa/security";
import {
  createLiveKitPresenceTokenService,
  liveKitParticipantIdentity,
  parseLiveKitParticipantIdentity,
  type LiveKitTokenSignerInput,
} from "./token.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const presenceSessionId =
  "presence-session_00000000-0000-7000-8000-000000000002" as never;

describe("LiveKit Presence token adapter", () => {
  it("mints only short-lived room-scoped participant grants", async () => {
    let captured: LiveKitTokenSignerInput | null = null;
    const service = createLiveKitPresenceTokenService({
      credentials: {
        async resolve() {
          return {
            serverUrl: "wss://presence.example.test",
            apiKey: "test-key",
            apiSecret: CredentialSecret.fromString("test-secret"),
          };
        },
      },
      signer: {
        async mint(input) {
          captured = input;
          return "header.payload.signature";
        },
      },
    });

    const result = await service.mintJoinToken({
      tenantId,
      presenceSessionId,
      role: "user",
      connectionGeneration: 3,
      ttlSeconds: 120,
    });

    expect(result).toEqual({
      serverUrl: "wss://presence.example.test",
      roomName: presenceSessionId,
      participantIdentity: "user:g3",
      token: "header.payload.signature",
      ttlSeconds: 120,
      connectionGeneration: 3,
      role: "user",
    });
    expect(captured?.grant).toEqual({
      roomJoin: true,
      room: presenceSessionId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
    expect(captured).not.toHaveProperty("roomAdmin");
    expect(captured).not.toHaveProperty("roomRecord");
  });

  it("uses generation-scoped participant identity for stale callback fencing", () => {
    expect(
      liveKitParticipantIdentity({
        role: "character",
        connectionGeneration: 42,
      }),
    ).toBe("character:g42");
    expect(parseLiveKitParticipantIdentity("character:g42")).toEqual({
      role: "character",
      connectionGeneration: 42,
    });
    expect(() => parseLiveKitParticipantIdentity("character")).toThrow(
      "invalid",
    );
  });

  it("rejects insecure endpoints and long-lived tokens before signing", async () => {
    let calls = 0;
    const service = createLiveKitPresenceTokenService({
      credentials: {
        async resolve() {
          return {
            serverUrl: "https://presence.example.test",
            apiKey: "test-key",
            apiSecret: CredentialSecret.fromString("test-secret"),
          };
        },
      },
      signer: {
        async mint() {
          calls += 1;
          return "header.payload.signature";
        },
      },
    });

    await expect(
      service.mintJoinToken({
        tenantId,
        presenceSessionId,
        role: "user",
        connectionGeneration: 1,
        ttlSeconds: 601,
      }),
    ).rejects.toThrow("ttlSeconds");
    expect(calls).toBe(0);

    await expect(
      service.mintJoinToken({
        tenantId,
        presenceSessionId,
        role: "user",
        connectionGeneration: 1,
        ttlSeconds: 60,
      }),
    ).rejects.toThrow("must use wss");
  });

  it("never surfaces the API secret in the client join descriptor", async () => {
    const service = createLiveKitPresenceTokenService({
      credentials: {
        async resolve() {
          return {
            serverUrl: "wss://presence.example.test/",
            apiKey: "test-key",
            apiSecret: CredentialSecret.fromString("super-secret"),
          };
        },
      },
      signer: {
        async mint() {
          return "header.payload.signature";
        },
      },
    });
    const result = await service.mintJoinToken({
      tenantId,
      presenceSessionId,
      role: "character",
      connectionGeneration: 1,
    });
    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(result.serverUrl).toBe("wss://presence.example.test");
  });
});
