import { describe, expect, it } from "vitest";
import {
  assertOmniSipVoiceAdmission,
  dispatchOmniSipVoiceCall,
  omniSipDispatchKey,
  projectOmniSipTelephonyProvider,
  type OmniSipStatusSnapshot,
} from "../../adapters/devices/android/src/omnisip-telephony.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const deviceId = "device_00000000-0000-7000-8000-000000000002" as never;
const operationId =
  "operation_00000000-0000-7000-8000-000000000003" as never;

function status(overrides: Partial<OmniSipStatusSnapshot> = {}): OmniSipStatusSnapshot {
  return {
    readiness: "ready",
    sip: {
      registered: true,
      transport: "TLS",
      secureMedia: "REQUIRED",
    },
    activeCalls: 0,
    sims: [
      { slot: 1, subscriptionId: 10, voiceCapable: true },
      { slot: 2, subscriptionId: 11, voiceCapable: true },
    ],
    audio: {
      status: "BIDIRECTIONAL_VERIFIED",
      profileId: "qualified-profile",
    },
    concurrency: {
      status: "VERIFIED",
      maxConcurrentCalls: 2,
    },
    deviceHealth: {
      allowsNewCalls: true,
      blockReason: null,
    },
    ...overrides,
  };
}

const command = {
  tenantId,
  deviceId,
  operationId,
  idempotencyKey: "call:customer:0001",
  destination: "+2348012345678",
  callerId: "+2348098765432",
  sim: "SIM1" as const,
};

describe("OmniSIP Android Device Provider", () => {
  it("projects only runtime-qualified telephony capabilities", () => {
    expect(projectOmniSipTelephonyProvider(status())).toMatchObject({
      state: "ready",
      reasonCode: null,
      readySims: ["SIM1", "SIM2"],
      maxConcurrentCalls: 2,
      activeCalls: 0,
    });
    expect(
      projectOmniSipTelephonyProvider(
        status({ audio: { status: "CAPTURE_VERIFIED", profileId: "partial" } }),
      ),
    ).toMatchObject({
      state: "unavailable",
      reasonCode: "audio-not-qualified",
    });
  });

  it("fails closed for SIP, device-health, SIM and capacity readiness", () => {
    expect(
      projectOmniSipTelephonyProvider(
        status({ readiness: "sip-started" }),
      ).reasonCode,
    ).toBe("sip-not-ready");

    expect(
      projectOmniSipTelephonyProvider(
        status({
          deviceHealth: {
            allowsNewCalls: false,
            blockReason: "thermal-high",
          },
        }),
      ).reasonCode,
    ).toBe("device-health-thermal-high");

    expect(() =>
      assertOmniSipVoiceAdmission({
        command: { ...command, sim: "SIM2" },
        status: status({
          sims: [{ slot: 1, subscriptionId: 10, voiceCapable: true }],
        }),
      }),
    ).toThrow("SIM");

    expect(
      projectOmniSipTelephonyProvider(status({ activeCalls: 2 })).state,
    ).toBe("degraded");
  });

  it("dispatches voice through the injected IP/SIP edge with stable Operation identity", async () => {
    let called = 0;
    const receipt = await dispatchOmniSipVoiceCall({
      command,
      status: status(),
      edge: {
        async originate(input) {
          called += 1;
          expect(input).toEqual({
            destination: "+2348012345678",
            callerId: "+2348098765432",
            sim: "SIM1",
            dispatchKey: omniSipDispatchKey(command),
          });
          return { accepted: true, callId: "omnisip-call-1" };
        },
      },
    });

    expect(called).toBe(1);
    expect(receipt).toEqual({
      outcome: "accepted",
      operationId,
      dispatchKey: omniSipDispatchKey(command),
      callId: "omnisip-call-1",
    });
  });

  it("returns explicit rejection without pretending provider success", async () => {
    await expect(
      dispatchOmniSipVoiceCall({
        command,
        status: status(),
        edge: {
          async originate() {
            return { accepted: false, reasonCode: "busy" };
          },
        },
      }),
    ).resolves.toMatchObject({
      outcome: "rejected",
      operationId,
      reasonCode: "busy",
    });
  });

  it("turns ambiguous dispatch exceptions into unknown instead of blind retry authority", async () => {
    const result = await dispatchOmniSipVoiceCall({
      command,
      status: status(),
      edge: {
        async originate() {
          throw new Error("connection lost after dispatch");
        },
      },
    });

    expect(result).toEqual({
      outcome: "unknown",
      operationId,
      dispatchKey: omniSipDispatchKey(command),
      reasonCode: "dispatch-outcome-unknown",
    });
  });

  it("requires canonical Operation identity, E.164 numbers and explicit SIM selection", () => {
    expect(() =>
      omniSipDispatchKey({
        ...command,
        destination: "08012345678",
      }),
    ).toThrow("E.164");

    expect(() =>
      omniSipDispatchKey({
        ...command,
        operationId: "not-an-operation" as never,
      }),
    ).toThrow("operationId");
  });
});
