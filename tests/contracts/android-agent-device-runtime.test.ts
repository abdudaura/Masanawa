import { describe, expect, it } from "vitest";
import {
  beginAndroidCapabilityProbe,
  completeAndroidCapabilityProbe,
  createAndroidAgentDeviceRuntime,
  disableAndroidAgentDeviceRuntime,
  projectAndroidRuntimeHealth,
  stopAndroidAgentDeviceRuntime,
} from "../../adapters/devices/android/src/runtime.js";

const deviceId = "device_00000000-0000-4000-8000-000000000001" as never;

function boot() {
  return createAndroidAgentDeviceRuntime({
    deviceId,
    bootId: "boot-session-001",
    appVersion: "1.0.0",
    androidSdk: 35,
    abi: "arm64-v8a",
    rootState: "available",
    startedAt: "2026-10-06T11:30:00.000Z" as never,
  });
}

describe("Task 124 minimal Android Agent Device runtime", () => {
  it("does not infer any capability from Android/root/app metadata", () => {
    const runtime = boot();

    expect(runtime.state).toBe("booting");
    expect(runtime.capabilities).toEqual([]);
    expect(runtime.rootState).toBe("available");
    expect(projectAndroidRuntimeHealth(runtime)).toEqual({
      state: "degraded",
      reason: "runtime-booting",
      observedAt: "2026-10-06T11:30:00.000Z",
    });

    const serialized = JSON.stringify(runtime);
    expect(serialized).not.toContain("characterId");
    expect(serialized).not.toContain("relationshipId");
    expect(serialized).not.toContain("memory");
    expect(serialized).not.toContain("workflow");
  });

  it("becomes ready only after an explicit all-ready capability probe", () => {
    const probing = beginAndroidCapabilityProbe({
      runtime: boot(),
      now: "2026-10-06T11:30:01.000Z" as never,
    });

    expect(probing.probeGeneration).toBe(1);
    expect(probing.state).toBe("probing");

    const ready = completeAndroidCapabilityProbe({
      runtime: probing,
      expectedGeneration: 1,
      now: "2026-10-06T11:30:02.000Z" as never,
      capabilities: [
        {
          key: "device.network.status",
          readiness: "ready",
          reason: null,
          observedAt: "2026-10-06T11:30:02.000Z" as never,
        },
        {
          key: "microphone.stream",
          readiness: "ready",
          reason: null,
          observedAt: "2026-10-06T11:30:02.000Z" as never,
        },
      ],
    });

    expect(ready.state).toBe("ready");
    expect(ready.capabilities.map((item) => item.key)).toEqual([
      "device.network.status",
      "microphone.stream",
    ]);
    expect(projectAndroidRuntimeHealth(ready)).toEqual({
      state: "healthy",
      reason: null,
      observedAt: "2026-10-06T11:30:02.000Z",
    });
  });

  it("projects degraded health when any explicitly probed capability is not ready", () => {
    const probing = beginAndroidCapabilityProbe({
      runtime: boot(),
      now: "2026-10-06T11:31:00.000Z" as never,
    });

    const degraded = completeAndroidCapabilityProbe({
      runtime: probing,
      expectedGeneration: 1,
      now: "2026-10-06T11:31:01.000Z" as never,
      capabilities: [
        {
          key: "device.network.status",
          readiness: "ready",
          reason: null,
          observedAt: "2026-10-06T11:31:01.000Z" as never,
        },
        {
          key: "telephony.call.place",
          readiness: "unavailable",
          reason: "no-active-sim",
          observedAt: "2026-10-06T11:31:01.000Z" as never,
        },
        {
          key: "screen.observe",
          readiness: "degraded",
          reason: "accessibility-service-limited",
          observedAt: "2026-10-06T11:31:01.000Z" as never,
        },
      ],
    });

    expect(degraded.state).toBe("degraded");
    expect(projectAndroidRuntimeHealth(degraded)).toEqual({
      state: "degraded",
      reason: "capabilities-not-ready:1 unavailable,1 degraded",
      observedAt: "2026-10-06T11:31:01.000Z",
    });
  });

  it("rejects stale probe generations so old callbacks cannot overwrite current truth", () => {
    const first = beginAndroidCapabilityProbe({
      runtime: boot(),
      now: "2026-10-06T11:32:00.000Z" as never,
    });
    const firstResult = completeAndroidCapabilityProbe({
      runtime: first,
      expectedGeneration: 1,
      now: "2026-10-06T11:32:01.000Z" as never,
      capabilities: [
        {
          key: "camera.capture",
          readiness: "ready",
          reason: null,
          observedAt: "2026-10-06T11:32:01.000Z" as never,
        },
      ],
    });
    const second = beginAndroidCapabilityProbe({
      runtime: firstResult,
      now: "2026-10-06T11:32:02.000Z" as never,
    });

    expect(second.probeGeneration).toBe(2);
    expect(() =>
      completeAndroidCapabilityProbe({
        runtime: second,
        expectedGeneration: 1,
        now: "2026-10-06T11:32:03.000Z" as never,
        capabilities: [
          {
            key: "camera.capture",
            readiness: "unavailable",
            reason: "stale-result",
            observedAt: "2026-10-06T11:32:03.000Z" as never,
          },
        ],
      }),
    ).toThrow("stale capability probe generation");
  });

  it("rejects duplicate capability keys and malformed ready/degraded evidence", () => {
    const probing = beginAndroidCapabilityProbe({
      runtime: boot(),
      now: "2026-10-06T11:33:00.000Z" as never,
    });

    expect(() =>
      completeAndroidCapabilityProbe({
        runtime: probing,
        expectedGeneration: 1,
        now: "2026-10-06T11:33:01.000Z" as never,
        capabilities: [
          {
            key: "camera.capture",
            readiness: "ready",
            reason: null,
            observedAt: "2026-10-06T11:33:01.000Z" as never,
          },
          {
            key: "camera.capture",
            readiness: "unavailable",
            reason: "permission-denied",
            observedAt: "2026-10-06T11:33:01.000Z" as never,
          },
        ],
      }),
    ).toThrow("duplicate keys");

    expect(() =>
      completeAndroidCapabilityProbe({
        runtime: probing,
        expectedGeneration: 1,
        now: "2026-10-06T11:33:01.000Z" as never,
        capabilities: [
          {
            key: "camera.capture",
            readiness: "ready",
            reason: "should-not-have-reason",
            observedAt: "2026-10-06T11:33:01.000Z" as never,
          },
        ],
      }),
    ).toThrow("ready capability cannot carry a reason");
  });

  it("remote disable is terminal, clears readiness, and blocks future probes", () => {
    const probing = beginAndroidCapabilityProbe({
      runtime: boot(),
      now: "2026-10-06T11:34:00.000Z" as never,
    });
    const ready = completeAndroidCapabilityProbe({
      runtime: probing,
      expectedGeneration: 1,
      now: "2026-10-06T11:34:01.000Z" as never,
      capabilities: [
        {
          key: "device.network.status",
          readiness: "ready",
          reason: null,
          observedAt: "2026-10-06T11:34:01.000Z" as never,
        },
      ],
    });

    const disabled = disableAndroidAgentDeviceRuntime({
      runtime: ready,
      reason: "device-revoked",
      now: "2026-10-06T11:34:02.000Z" as never,
    });

    expect(disabled.state).toBe("disabled");
    expect(disabled.capabilities).toEqual([]);
    expect(projectAndroidRuntimeHealth(disabled)).toEqual({
      state: "unavailable",
      reason: "device-revoked",
      observedAt: "2026-10-06T11:34:02.000Z",
    });
    expect(() =>
      beginAndroidCapabilityProbe({
        runtime: disabled,
        now: "2026-10-06T11:34:03.000Z" as never,
      }),
    ).toThrow("runtime is disabled");

    expect(
      disableAndroidAgentDeviceRuntime({
        runtime: disabled,
        reason: "device-revoked",
        now: "2026-10-06T11:34:03.000Z" as never,
      }),
    ).toBe(disabled);

    expect(() =>
      disableAndroidAgentDeviceRuntime({
        runtime: disabled,
        reason: "different-reason",
        now: "2026-10-06T11:34:03.000Z" as never,
      }),
    ).toThrow("cannot change terminal reason");
  });

  it("supports ordinary local stop without inventing a new persistent identity", () => {
    const stopped = stopAndroidAgentDeviceRuntime({
      runtime: boot(),
      now: "2026-10-06T11:35:00.000Z" as never,
    });

    expect(stopped.state).toBe("stopped");
    expect(stopped.deviceId).toBe(deviceId);
    expect(stopped.bootId).toBe("boot-session-001");
    expect(projectAndroidRuntimeHealth(stopped).state).toBe("unavailable");
    expect(stopAndroidAgentDeviceRuntime({
      runtime: stopped,
      now: "2026-10-06T11:35:01.000Z" as never,
    })).toBe(stopped);
  });
});
