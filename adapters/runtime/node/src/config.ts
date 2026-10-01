import {
  parseRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@masanawa/contracts";

export interface NodeServiceRuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly shutdownTimeoutMs: number;
}

export interface NodeServiceRuntimeDefaults {
  readonly host?: string;
  readonly port: number;
  readonly shutdownTimeoutMs?: number;
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max: number,
): number {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }
  if (!/^[0-9]+$/u.test(normalized)) {
    throw new TypeError(`${name} must be an integer`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

export function readNodeServiceRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
  defaults: NodeServiceRuntimeDefaults,
): NodeServiceRuntimeConfig {
  const host = env.HOST?.trim() || defaults.host || "0.0.0.0";
  if (host.length > 255 || /[\r\n\0]/u.test(host)) {
    throw new TypeError("HOST is invalid");
  }

  return Object.freeze({
    environment: parseRuntimeEnvironment(env.NODE_ENV),
    host,
    port: parseBoundedInteger(env.PORT, defaults.port, "PORT", 1, 65_535),
    shutdownTimeoutMs: parseBoundedInteger(
      env.MASANAWA_SHUTDOWN_TIMEOUT_MS,
      defaults.shutdownTimeoutMs ?? 15_000,
      "MASANAWA_SHUTDOWN_TIMEOUT_MS",
      100,
      300_000,
    ),
  });
}
