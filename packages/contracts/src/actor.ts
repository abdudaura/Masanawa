import type {
  AgentRunId,
  DeviceId,
  ServiceId,
  UserId,
} from "./ids.js";

export type ActorRef =
  | { readonly kind: "user"; readonly id: UserId }
  | { readonly kind: "operator"; readonly id: UserId }
  | { readonly kind: "service"; readonly id: ServiceId }
  | { readonly kind: "device"; readonly id: DeviceId }
  | { readonly kind: "agent-run"; readonly id: AgentRunId }
  | { readonly kind: "system"; readonly id: string };
