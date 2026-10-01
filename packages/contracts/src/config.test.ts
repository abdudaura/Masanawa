import { describe, expect, it } from "vitest";
import {
  parseRuntimeEnvironment,
  readIntegerEnv,
  readOptionalEnv,
  readRequiredEnv,
} from "./config.js";

describe("runtime config helpers", () => {
  it("parses runtime environment and trimmed required values", () => {
    expect(parseRuntimeEnvironment(undefined)).toBe("development");
    expect(parseRuntimeEnvironment(" PRODUCTION ")).toBe("production");
    expect(readRequiredEnv({ TOKEN: " value " }, "TOKEN")).toBe("value");
  });

  it("parses bounded integers and rejects malformed or out-of-range values", () => {
    expect(readIntegerEnv({ PORT: " 3000 " }, "PORT", { min: 1, max: 65535 })).toBe(3000);
    expect(readIntegerEnv({}, "PORT", { defaultValue: 3000 })).toBe(3000);
    expect(() => readIntegerEnv({ PORT: "3.5" }, "PORT")).toThrow(
      "Invalid integer environment variable",
    );
    expect(() =>
      readIntegerEnv({ PORT: "70000" }, "PORT", { max: 65535 }),
    ).toThrow("PORT must be <= 65535");
  });

  it("uses explicit optional values or a safe default", () => {
    expect(readOptionalEnv({ HOST: " 127.0.0.1 " }, "HOST", "0.0.0.0")).toBe(
      "127.0.0.1",
    );
    expect(readOptionalEnv({}, "HOST", "0.0.0.0")).toBe("0.0.0.0");
  });
});
