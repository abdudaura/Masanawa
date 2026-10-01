import {
  parseRuntimeEnvironment,
  readIntegerEnv,
  readOptionalEnv,
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

export function readNodeServiceRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
  defaults: NodeServiceRuntimeDefaults,
): NodeServiceRuntimeConfig {
  const host = readOptionalEnv(env, "HOST", defaults.host ?? "0.0.0.0");
  if (host.length > 255 || /[\r\n\0]/u.test(host)) {
    throw new TypeError("HOST is invalid");
  }

  return Object.freeze({
    environment: parseRuntimeEnvironment(env.NODE_ENV),
    host,
    port: readIntegerEnv(env, "PORT", {
      defaultValue: defaults.port,
      min: 1,
      max: 65_535,
    }),
    shutdownTimeoutMs: readIntegerEnv(env, "MASANAWA_SHUTDOWN_TIMEOUT_MS", {
      defaultValue: defaults.shutdownTimeoutMs ?? 15_000,
      min: 100,
      max: 300_000,
    }),
  });
}
