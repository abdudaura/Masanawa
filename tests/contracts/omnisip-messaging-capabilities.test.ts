import { describe, expect, it } from "vitest";
import {
  createOmniSipMessagingExecutor,
  type OmniSipMessagingStatusSnapshot,
} from "../../adapters/devices/android/src/omnisip-messaging.js";

const operationId =
  "operation_018f6b2e-7c00-7004-8000-000000000004" as never;
const deadlineAt = "2026-10-06T12:10:00.000Z" as never;

function status(
  overrides: Partial<OmniSipMessagingStatusSnapshot> = {},
): OmniSipMessagingStatusSnapshot {
  return {
    smsPermissionGranted: true,
    ussdPermissionGranted: true,
    smsReadySims: ["SIM1", "SIM2"],
    ussdReadySims: ["SIM1", "SIM2"],
    observedAt: "2026-10-06T12:00:00.000Z" as never,
    ...overrides,
  };
}

function executor(input?: {
  readonly status?: OmniSipMessagingStatusSnapshot;
  readonly sendSms?: (
    input: {
      readonly destination: string;
      readonly body: string;
      readonly sim: "SIM1" | "SIM2";
    },
  ) => Promise<string | null>;
  readonly requestUssd?: (
    input: { readonly code: string; readonly sim: "SIM1" | "SIM2" },
  ) => Promise<string>;
}) {
  return createOmniSipMessagingExecutor({
    status: {
      async read() {
        return input?.status ?? status();
      },
    },
    edge: {
      sendSms:
        input?.sendSms ??
        (async () => "omnisip-sms-request-001"),
      requestUssd:
        input?.requestUssd ??
        (async () => "omnisip-ussd-request-001"),
    },
    now: () => "2026-10-06T12:00:05.000Z" as never,
  });
}

describe("Task 128 OmniSIP SMS/USSD Device capabilities", () => {
  it("sends SMS through the explicitly selected ready SIM and returns pending reconciliation", async () => {
    let seen:
      | { destination: string; body: string; sim: "SIM1" | "SIM2" }
      | undefined;

    const result = await executor({
      sendSms: async (input) => {
        seen = input;
        return "omnisip-sms-request-001";
      },
    }).execute({
      operationId,
      capability: "sms.send",
      payload: {
        destination: "+234 (801) 234-5678",
        body: "  Keep exact message whitespace.  ",
        sim: "SIM2",
      },
      deadlineAt,
    });

    expect(seen).toEqual({
      destination: "+2348012345678",
      body: "  Keep exact message whitespace.  ",
      sim: "SIM2",
    });
    expect(result).toMatchObject({
      status: "unknown",
      reasonCode: "omnisip.sms-status-pending",
      evidenceRef: "omnisip:sms.send:omnisip-sms-request-001",
    });
    expect(JSON.stringify(result)).not.toContain("Keep exact message whitespace");
  });

  it("fails before effect when SMS permission or requested SIM readiness is absent", async () => {
    let calls = 0;
    const noPermission = executor({
      status: status({ smsPermissionGranted: false }),
      sendSms: async () => {
        calls += 1;
        return "should-not-run";
      },
    });

    await expect(
      noPermission.execute({
        operationId,
        capability: "sms.send",
        payload: {
          destination: "+2348012345678",
          body: "hello",
          sim: "SIM1",
        },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "failed-before-effect",
      reasonCode: "device.sms-permission-missing",
    });

    const noSim = executor({
      status: status({ smsReadySims: ["SIM1"] }),
      sendSms: async () => {
        calls += 1;
        return "should-not-run";
      },
    });
    await expect(
      noSim.execute({
        operationId,
        capability: "sms.send",
        payload: {
          destination: "+2348012345678",
          body: "hello",
          sim: "SIM2",
        },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "failed-before-effect",
      reasonCode: "device.sms-sim-unavailable",
    });

    expect(calls).toBe(0);
  });

  it("treats null or thrown SMS dispatch edge outcomes as unknown, never success", async () => {
    await expect(
      executor({
        sendSms: async () => null,
      }).execute({
        operationId,
        capability: "sms.send",
        payload: {
          destination: "+2348012345678",
          body: "hello",
          sim: "SIM1",
        },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "unknown",
      reasonCode: "omnisip.sms-dispatch-outcome-unknown",
    });

    await expect(
      executor({
        sendSms: async () => {
          throw new Error("connection died after Android send");
        },
      }).execute({
        operationId,
        capability: "sms.send",
        payload: {
          destination: "+2348012345678",
          body: "hello",
          sim: "SIM1",
        },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "unknown",
      reasonCode: "omnisip.sms-dispatch-outcome-unknown",
    });
  });

  it("executes USSD only through an explicitly qualified SIM and returns callback-pending evidence", async () => {
    let seen: { code: string; sim: "SIM1" | "SIM2" } | undefined;
    const result = await executor({
      requestUssd: async (input) => {
        seen = input;
        return "omnisip-ussd-request-001";
      },
    }).execute({
      operationId,
      capability: "ussd.execute",
      payload: {
        code: " * 3 1 0 # ",
        sim: "SIM1",
      },
      deadlineAt,
    });

    expect(seen).toEqual({ code: "*310#", sim: "SIM1" });
    expect(result).toMatchObject({
      status: "unknown",
      reasonCode: "omnisip.ussd-response-pending",
      evidenceRef: "omnisip:ussd.execute:omnisip-ussd-request-001",
    });
  });

  it("fails before effect for USSD permission/SIM denial and malformed SMS/USSD payloads", async () => {
    let calls = 0;
    const denied = executor({
      status: status({
        ussdPermissionGranted: false,
        ussdReadySims: ["SIM1"],
      }),
      requestUssd: async () => {
        calls += 1;
        return "should-not-run";
      },
    });

    await expect(
      denied.execute({
        operationId,
        capability: "ussd.execute",
        payload: { code: "*310#", sim: "SIM1" },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "failed-before-effect",
      reasonCode: "device.ussd-permission-missing",
    });

    const invalid = executor({
      sendSms: async () => {
        calls += 1;
        return "should-not-run";
      },
      requestUssd: async () => {
        calls += 1;
        return "should-not-run";
      },
    });

    await expect(
      invalid.execute({
        operationId,
        capability: "sms.send",
        payload: {
          destination: "08012345678",
          body: "hello",
          sim: "SIM1",
        },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "failed-before-effect",
      reasonCode: "device.sms-payload-invalid",
    });

    await expect(
      invalid.execute({
        operationId,
        capability: "ussd.execute",
        payload: { code: "not ussd", sim: "SIM1" },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "failed-before-effect",
      reasonCode: "device.ussd-payload-invalid",
    });

    expect(calls).toBe(0);
  });

  it("maps edge/status uncertainty to unknown and rejects unsupported capability before dispatch", async () => {
    const statusFailure = createOmniSipMessagingExecutor({
      status: {
        async read() {
          throw new Error("status unavailable");
        },
      },
      edge: {
        async sendSms() {
          throw new Error("must not run");
        },
        async requestUssd() {
          throw new Error("must not run");
        },
      },
      now: () => "2026-10-06T12:00:05.000Z" as never,
    });

    await expect(
      statusFailure.execute({
        operationId,
        capability: "sms.send",
        payload: {
          destination: "+2348012345678",
          body: "hello",
          sim: "SIM1",
        },
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "unknown",
      reasonCode: "omnisip.messaging-status-unavailable",
    });

    await expect(
      executor().execute({
        operationId,
        capability: "telephony.call.place",
        payload: {},
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      status: "failed-before-effect",
      reasonCode: "device.messaging-capability-unsupported",
    });
  });
});
