import type { ProviderExecutionObservation } from "./failures.js";
import {
  privacySafeAttributes,
  type PrivacySafeTelemetryAttributes,
} from "@masanawa/telemetry";

export function providerExecutionTelemetryAttributes(
  observation: ProviderExecutionObservation,
): PrivacySafeTelemetryAttributes {
  return privacySafeAttributes({
    "masanawa.operation.id": observation.operationId,
    "masanawa.provider.id": observation.providerId,
    "masanawa.provider.key": observation.providerKey,
    "masanawa.provider.version": observation.providerVersion,
    "masanawa.provider.capability": observation.capability,
    "masanawa.provider.outcome": observation.outcome,
    "masanawa.provider.duration_ms": observation.durationMs,
    ...(observation.costUnits === null
      ? {}
      : { "masanawa.provider.cost_units": observation.costUnits }),
    ...(observation.failure === null
      ? {}
      : {
          "error.code": `provider.${observation.failure.code}`,
          "masanawa.provider.failure_kind": observation.failure.kind,
          "masanawa.provider.retryable": observation.failure.retryable,
          "masanawa.provider.dispatched": observation.failure.dispatched,
          ...(observation.failure.retryAfterMs === null
            ? {}
            : {
                "masanawa.provider.retry_after_ms":
                  observation.failure.retryAfterMs,
              }),
        }),
  });
}
