import { describe, expect, it } from "vitest";
import {
  dispatchOmniSipSms,
  dispatchOmniSipUssd,
  readOmniSipUssdStatus,
  type OmniSipMessagingCapabilitySnapshot,
} from "../../adapters/devices/android/src/omnisip-messaging.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const deviceId = "device_00000000-0000-7000-8000-000000000002" as never;
const operationId =
  "operation_00000000-0000-7000-8000-000000000003" as never;

const ready: OmniSipMessagingCapabilitySnapshot = {
  sms: { readiness: "ready", reason: null },
  ussd: { readiness: "ready", reason: null },
  availableSims: ["SIM1", "SIM2"],
};

describe("OmniSIP SMS/USSD Device capabilities", () => {
  it("dispatches SMS through explicit SIM with canonical Operation identity", async () => {
    const result = await dispatchOmniSipSms({
      command: {
        tenantId,
        deviceId,
        operationId,
        idempotencyKey: "sms:0001",
        sim: "SIM2",
        destination: "+2348012345678",
        body: "Hello",
      },
      capability: ready,
      edge: {
        async sendSms(input) {
          expect(input.sim).toBe("SIM2");
          return { accepted: true, providerReference: "sms-local-1" };
        },
        async requestUssd() {
          throw new Error("unused");
        },
        async readUssd() {
          return { status: "pending" };
        },
      },
    });

    expect(result).toMatchObject({
      outcome: "accepted",
      operationId,
      providerReference: "sms-local-1",
    });
  });

  it("fails before dispatch when SMS capability or SIM is unavailable", async () => {
    let calls = 0;
    await expect(
      dispatchOmniSipSms({
        command: {
          tenantId,
          deviceId,
          operationId,
          idempotencyKey: "sms:0002",
          sim: "SIM2",
          destination: "+2348012345678",
          body: "Hello",
        },
        capability: {
          sms: { readiness: "ready", reason: null },
          ussd: { readiness: "ready", reason: null },
          availableSims: ["SIM1"],
        },
        edge: {
          async sendSms() {
            calls += 1;
            return { accepted: true, providerReference: "should-not-run" };
          },
          async requestUssd() {
            throw new Error("unused");
          },
          async readUssd() {
            return { status: "pending" };
          },
        },
      }),
    ).rejects.toThrow("SIM");
    expect(calls).toBe(0);
  });

  it("accepts USSD request identity then reconciles asynchronous response", async () => {
    const edge = {
      async sendSms() {
        throw new Error("unused");
      },
      async requestUssd() {
        return { accepted: true as const, requestId: "ussd-local-1" };
      },
      async readUssd() {
        return {
          status: "success" as const,
          response: "Your balance is 123",
        };
      },
    };

    const dispatched = await dispatchOmniSipUssd({
      command: {
        tenantId,
        deviceId,
        operationId,
        idempotencyKey: "ussd:0001",
        sim: "SIM1",
        code: "*123#",
      },
      capability: ready,
      edge,
    });
    expect(dispatched).toMatchObject({
      outcome: "accepted",
      providerReference: "ussd-local-1",
    });

    await expect(
      readOmniSipUssdStatus({
        requestId: "ussd-local-1",
        edge,
      }),
    ).resolves.toEqual({
      requestId: "ussd-local-1",
      status: "success",
      response: "Your balance is 123",
    });
  });

  it("turns ambiguous SMS/USSD edge exceptions into outcome-unknown", async () => {
    const edge = {
      async sendSms() {
        throw new Error("lost response");
      },
      async requestUssd() {
        throw new Error("lost response");
      },
      async readUssd() {
        return { status: "pending" as const };
      },
    };

    await expect(
      dispatchOmniSipSms({
        command: {
          tenantId,
          deviceId,
          operationId,
          idempotencyKey: "sms:0003",
          sim: "SIM1",
          destination: "+2348012345678",
          body: "Hello",
        },
        capability: ready,
        edge,
      }),
    ).resolves.toMatchObject({
      outcome: "unknown",
      reasonCode: "dispatch-outcome-unknown",
    });

    await expect(
      dispatchOmniSipUssd({
        command: {
          tenantId,
          deviceId,
          operationId,
          idempotencyKey: "ussd:0003",
          sim: "SIM1",
          code: "*123#",
        },
        capability: ready,
        edge,
      }),
    ).resolves.toMatchObject({
      outcome: "unknown",
      reasonCode: "dispatch-outcome-unknown",
    });
  });

  it("rejects invalid destination, USSD syntax and unqualified capability", async () => {
    await expect(
      dispatchOmniSipSms({
        command: {
          tenantId,
          deviceId,
          operationId,
          idempotencyKey: "sms:bad",
          sim: "SIM1",
          destination: "08012345678",
          body: "Hello",
        },
        capability: ready,
        edge: {
          async sendSms() {
            return { accepted: true, providerReference: "unused" };
          },
          async requestUssd() {
            throw new Error("unused");
          },
          async readUssd() {
            return { status: "pending" };
          },
        },
      }),
    ).rejects.toThrow("E.164");

    await expect(
      dispatchOmniSipUssd({
        command: {
          tenantId,
          deviceId,
          operationId,
          idempotencyKey: "ussd:bad",
          sim: "SIM1",
          code: "123",
        },
        capability: ready,
        edge: {
          async sendSms() {
            throw new Error("unused");
          },
          async requestUssd() {
            return { accepted: true, requestId: "unused" };
          },
          async readUssd() {
            return { status: "pending" };
          },
        },
      }),
    ).rejects.toThrow("USSD code");

    await expect(
      dispatchOmniSipUssd({
        command: {
          tenantId,
          deviceId,
          operationId,
          idempotencyKey: "ussd:not-ready",
          sim: "SIM1",
          code: "*123#",
        },
        capability: {
          ...ready,
          ussd: { readiness: "unavailable", reason: "permission-missing" },
        },
        edge: {
          async sendSms() {
            throw new Error("unused");
          },
          async requestUssd() {
            return { accepted: true, requestId: "unused" };
          },
          async readUssd() {
            return { status: "pending" };
          },
        },
      }),
    ).rejects.toThrow("not ready");
  });
});
