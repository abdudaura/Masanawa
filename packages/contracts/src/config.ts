export type RuntimeEnvironment = "development" | "test" | "production";

export function parseRuntimeEnvironment(value: string | undefined): RuntimeEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized === undefined || normalized === "") {
    return "development";
  }
  if (normalized === "development" || normalized === "test" || normalized === "production") {
    return normalized;
  }
  throw new TypeError(`Invalid runtime environment: ${value}`);
}

export function readRequiredEnv(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new TypeError(`Missing required environment variable: ${name}`);
  }
  return value;
}


export function readIntegerEnv(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
  options: {
    readonly defaultValue?: number;
    readonly min?: number;
    readonly max?: number;
  } = {},
): number {
  const raw = env[name]?.trim();
  if (!raw) {
    if (options.defaultValue !== undefined) {
      return options.defaultValue;
    }
    throw new TypeError(`Missing required environment variable: ${name}`);
  }

  if (!/^-?\d+$/u.test(raw)) {
    throw new TypeError(`Invalid integer environment variable: ${name}`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Invalid integer environment variable: ${name}`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new RangeError(`${name} must be >= ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new RangeError(`${name} must be <= ${options.max}`);
  }
  return value;
}

export function readOptionalEnv(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
  defaultValue: string,
): string {
  const value = env[name]?.trim();
  return value ? value : defaultValue;
}
