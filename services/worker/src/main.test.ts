import { describe, expect, it } from "vitest";
import { safeWorkerStartupReason } from "./main.js";

describe("worker startup diagnostics", () => {
  it("reports only explicitly allowlisted configuration and lifecycle errors", () => {
    for (const reason of [
      "rooms_ai.credentials_required",
      "rooms_ai.models_invalid",
      "rooms_teacher_postgres_pool_required",
      "Missing required environment variable: DATABASE_URL",
      "service.start_failed",
    ]) {
      expect(safeWorkerStartupReason(new Error(reason))).toBe(reason);
    }
  });

  it("does not print secrets, database URLs, or untrusted provider messages", () => {
    for (const failure of [
      new Error("Gemini secret key=AIzaHighlySensitiveExample"),
      new Error("connect ECONNRESET postgresql://user:password@host/db"),
      new Error("Unauthorized provider response with private prompt"),
      null,
      { message: "secret" },
    ]) {
      expect(safeWorkerStartupReason(failure)).toBe("worker_startup_unknown");
    }
  });
});
