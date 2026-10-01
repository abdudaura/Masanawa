import type {
  AgentRunId,
  DeviceId,
  ServiceId,
  UserId,
} from "@masanawa/contracts";

export type Principal =
  | { readonly kind: "user"; readonly userId: UserId }
  | { readonly kind: "operator"; readonly userId: UserId }
  | { readonly kind: "service"; readonly serviceId: ServiceId }
  | { readonly kind: "device"; readonly deviceId: DeviceId }
  | { readonly kind: "agent-run"; readonly agentRunId: AgentRunId }
  | { readonly kind: "system"; readonly systemKind: string };

export function principalKey(principal: Principal): string {
  switch (principal.kind) {
    case "user":
    case "operator":
      return `${principal.kind}:${principal.userId}`;
    case "service":
      return `service:${principal.serviceId}`;
    case "device":
      return `device:${principal.deviceId}`;
    case "agent-run":
      return `agent-run:${principal.agentRunId}`;
    case "system":
      return `system:${principal.systemKind}`;
  }
}
