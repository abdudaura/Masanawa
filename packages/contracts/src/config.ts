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
