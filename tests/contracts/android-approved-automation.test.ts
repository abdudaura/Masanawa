import { describe, expect, it } from "vitest";
import {
  createApprovedAndroidAutomationPlan,
  type AndroidAutomationPolicySnapshot,
} from "../../adapters/devices/android/src/approved-automation.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const deviceId = "device_00000000-0000-7000-8000-000000000002" as never;
const operationId =
  "operation_00000000-0000-7000-8000-000000000003" as never;
const authorityContextId =
  "authority-context_00000000-0000-7000-8000-000000000004" as never;
const approvalId =
  "approval_00000000-0000-7000-8000-000000000005" as never;

const policy: AndroidAutomationPolicySnapshot = {
  tenantId,
  deviceId,
  revision: "policy-7",
  allowedKinds: [
    "app-launch",
    "browser-open",
    "notification-observe",
    "notification-reply",
  ],
  allowedPackages: ["com.example.chat"],
  allowedBrowserHosts: ["example.com"],
  notificationReplyRequiresApproval: true,
};

function base() {
  return {
    tenantId,
    deviceId,
    operationId,
    authorityContextId,
    policyRevision: "policy-7",
    idempotencyKey: "automation:0001",
  } as const;
}

describe("approved Android automation planning", () => {
  it("creates a bounded app-launch plan only for allowlisted packages", () => {
    expect(
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "app-launch",
          packageName: "com.example.chat",
        },
        currentPolicy: policy,
        readyKinds: ["app-launch"],
      }),
    ).toMatchObject({
      operationId,
      authorityContextId,
      kind: "app-launch",
      target: { packageName: "com.example.chat" },
    });

    expect(() =>
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "app-launch",
          packageName: "com.other.app",
        },
        currentPolicy: policy,
        readyKinds: ["app-launch"],
      }),
    ).toThrow("not allowlisted");
  });

  it("allows only clean HTTPS URLs on an exact public-host allowlist", () => {
    expect(
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "browser-open",
          url: "https://example.com/account",
        },
        currentPolicy: policy,
        readyKinds: ["browser-open"],
      }),
    ).toMatchObject({
      kind: "browser-open",
      target: {
        host: "example.com",
        url: "https://example.com/account",
      },
    });

    expect(() =>
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "browser-open",
          url: "https://evil.example/account",
        },
        currentPolicy: policy,
        readyKinds: ["browser-open"],
      }),
    ).toThrow("not allowlisted");

    expect(() =>
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "browser-open",
          url: "http://example.com/account",
        },
        currentPolicy: policy,
        readyKinds: ["browser-open"],
      }),
    ).toThrow("clean HTTPS");
  });

  it("requires a canonical approval for notification reply when policy says so", () => {
    expect(() =>
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "notification-reply",
          packageName: "com.example.chat",
          notificationKey: "notification-1",
          replyText: "Thanks",
          approvalId: null,
        },
        currentPolicy: policy,
        readyKinds: ["notification-reply"],
      }),
    ).toThrow("requires canonical approval");

    expect(
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "notification-reply",
          packageName: "com.example.chat",
          notificationKey: "notification-1",
          replyText: "Thanks",
          approvalId,
        },
        currentPolicy: policy,
        readyKinds: ["notification-reply"],
      }),
    ).toMatchObject({
      kind: "notification-reply",
      target: {
        packageName: "com.example.chat",
        notificationKey: "notification-1",
        replyText: "Thanks",
        approvalId,
      },
    });
  });

  it("rejects stale policy and missing runtime readiness", () => {
    expect(() =>
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          policyRevision: "policy-6",
          kind: "notification-observe",
          packageName: "com.example.chat",
        },
        currentPolicy: policy,
        readyKinds: ["notification-observe"],
      }),
    ).toThrow("stale");

    expect(() =>
      createApprovedAndroidAutomationPlan({
        request: {
          ...base(),
          kind: "notification-observe",
          packageName: "com.example.chat",
        },
        currentPolicy: policy,
        readyKinds: [],
      }),
    ).toThrow("currently ready");
  });

  it("keeps the exact canonical operation/authority and stable dispatch identity", () => {
    const plan = createApprovedAndroidAutomationPlan({
      request: {
        ...base(),
        kind: "notification-observe",
        packageName: "com.example.chat",
      },
      currentPolicy: policy,
      readyKinds: ["notification-observe"],
    });

    expect(plan.tenantId).toBe(tenantId);
    expect(plan.deviceId).toBe(deviceId);
    expect(plan.operationId).toBe(operationId);
    expect(plan.authorityContextId).toBe(authorityContextId);
    expect(plan.dispatchKey).toContain(operationId);
  });
});
