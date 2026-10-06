import {
  isCanonicalId,
  type ApprovalId,
  type AuthorityContextId,
  type DeviceId,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";

export const approvedAndroidAutomationKinds = [
  "app-launch",
  "browser-open",
  "notification-observe",
  "notification-reply",
] as const;

export type ApprovedAndroidAutomationKind =
  (typeof approvedAndroidAutomationKinds)[number];

export interface AndroidAutomationPolicySnapshot {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly revision: string;
  readonly allowedKinds: readonly ApprovedAndroidAutomationKind[];
  readonly allowedPackages: readonly string[];
  readonly allowedBrowserHosts: readonly string[];
  readonly notificationReplyRequiresApproval: boolean;
}

interface BaseAutomationRequest {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly operationId: OperationId;
  readonly authorityContextId: AuthorityContextId;
  readonly policyRevision: string;
  readonly idempotencyKey: string;
}

export type AndroidAutomationRequest =
  | (BaseAutomationRequest & {
      readonly kind: "app-launch";
      readonly packageName: string;
    })
  | (BaseAutomationRequest & {
      readonly kind: "browser-open";
      readonly url: string;
    })
  | (BaseAutomationRequest & {
      readonly kind: "notification-observe";
      readonly packageName: string;
    })
  | (BaseAutomationRequest & {
      readonly kind: "notification-reply";
      readonly packageName: string;
      readonly notificationKey: string;
      readonly replyText: string;
      readonly approvalId: ApprovalId | null;
    });

export interface ApprovedAndroidAutomationPlan {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly operationId: OperationId;
  readonly authorityContextId: AuthorityContextId;
  readonly policyRevision: string;
  readonly dispatchKey: string;
  readonly kind: ApprovedAndroidAutomationKind;
  readonly target:
    | { readonly packageName: string }
    | { readonly url: string; readonly host: string }
    | {
        readonly packageName: string;
        readonly notificationKey: string;
        readonly replyText: string;
        readonly approvalId: ApprovalId | null;
      };
}

const packagePattern = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/u;

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0\r\n]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function normalizePackageName(value: string): string {
  const normalized = bounded(value, "packageName", 3, 220);
  if (!packagePattern.test(normalized)) {
    throw new TypeError("packageName is invalid");
  }
  return normalized;
}

function normalizeHost(value: string): string {
  const host = bounded(value, "browser host", 1, 253).toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) ||
    !host.includes(".")
  ) {
    throw new TypeError("browser host must be a public DNS hostname");
  }
  return host;
}

function normalizeBrowserUrl(value: string): {
  readonly url: string;
  readonly host: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(bounded(value, "browser url", 1, 2048));
  } catch {
    throw new TypeError("browser url is invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== ""
  ) {
    throw new TypeError("browser url must be clean HTTPS");
  }
  return Object.freeze({
    url: parsed.toString(),
    host: normalizeHost(parsed.hostname),
  });
}

function normalizePolicy(
  input: AndroidAutomationPolicySnapshot,
): AndroidAutomationPolicySnapshot {
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("policy tenantId is invalid");
  }
  if (!isCanonicalId("device", input.deviceId)) {
    throw new TypeError("policy deviceId is invalid");
  }
  const allowedKinds = [...new Set(input.allowedKinds)];
  if (
    allowedKinds.some(
      (kind) => !approvedAndroidAutomationKinds.includes(kind),
    )
  ) {
    throw new TypeError("policy automation kind is invalid");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    revision: bounded(input.revision, "policyRevision", 1, 160),
    allowedKinds: Object.freeze(allowedKinds.sort()),
    allowedPackages: Object.freeze(
      [...new Set(input.allowedPackages.map(normalizePackageName))].sort(),
    ),
    allowedBrowserHosts: Object.freeze(
      [...new Set(input.allowedBrowserHosts.map(normalizeHost))].sort(),
    ),
    notificationReplyRequiresApproval:
      input.notificationReplyRequiresApproval === true,
  });
}

function assertBase(request: AndroidAutomationRequest): void {
  if (!isCanonicalId("tenant", request.tenantId)) {
    throw new TypeError("tenantId is invalid");
  }
  if (!isCanonicalId("device", request.deviceId)) {
    throw new TypeError("deviceId is invalid");
  }
  if (!isCanonicalId("operation", request.operationId)) {
    throw new TypeError("operationId is invalid");
  }
  if (!isCanonicalId("authority-context", request.authorityContextId)) {
    throw new TypeError("authorityContextId is invalid");
  }
  bounded(request.policyRevision, "policyRevision", 1, 160);
  bounded(request.idempotencyKey, "idempotencyKey", 1, 256);
}

export function createApprovedAndroidAutomationPlan(input: {
  readonly request: AndroidAutomationRequest;
  readonly currentPolicy: AndroidAutomationPolicySnapshot;
  readonly readyKinds: readonly ApprovedAndroidAutomationKind[];
}): ApprovedAndroidAutomationPlan {
  const request = input.request;
  assertBase(request);
  const policy = normalizePolicy(input.currentPolicy);

  if (
    policy.tenantId !== request.tenantId ||
    policy.deviceId !== request.deviceId
  ) {
    throw new Error("Android automation policy scope mismatch");
  }
  if (policy.revision !== request.policyRevision) {
    throw new Error("Android automation policy revision is stale");
  }
  if (!policy.allowedKinds.includes(request.kind)) {
    throw new Error("Android automation kind is not policy-allowed");
  }
  if (!input.readyKinds.includes(request.kind)) {
    throw new Error("Android automation kind is not currently ready");
  }

  let target: ApprovedAndroidAutomationPlan["target"];
  if (request.kind === "browser-open") {
    const normalized = normalizeBrowserUrl(request.url);
    if (!policy.allowedBrowserHosts.includes(normalized.host)) {
      throw new Error("Android automation browser host is not allowlisted");
    }
    target = normalized;
  } else {
    const packageName = normalizePackageName(request.packageName);
    if (!policy.allowedPackages.includes(packageName)) {
      throw new Error("Android automation package is not allowlisted");
    }

    if (request.kind === "notification-reply") {
      if (
        policy.notificationReplyRequiresApproval &&
        (request.approvalId === null ||
          !isCanonicalId("approval", request.approvalId))
      ) {
        throw new Error("Android notification reply requires canonical approval");
      }
      target = Object.freeze({
        packageName,
        notificationKey: bounded(
          request.notificationKey,
          "notificationKey",
          1,
          512,
        ),
        replyText: bounded(request.replyText, "replyText", 1, 4096),
        approvalId: request.approvalId,
      });
    } else {
      target = Object.freeze({ packageName });
    }
  }

  return Object.freeze({
    tenantId: request.tenantId,
    deviceId: request.deviceId,
    operationId: request.operationId,
    authorityContextId: request.authorityContextId,
    policyRevision: request.policyRevision,
    dispatchKey: [
      request.operationId,
      encodeURIComponent(
        bounded(request.idempotencyKey, "idempotencyKey", 1, 256),
      ),
    ].join(":"),
    kind: request.kind,
    target,
  });
}
