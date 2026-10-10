import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "adapters/**/*.test.ts",
      "infra/**/*.test.ts",
      "services/**/*.test.ts",
      "apps/**/*.test.ts",
      "test/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    environment: "node",
    // Integration suites share one disposable PostgreSQL database. Several
    // independently reset schemas in beforeEach; parallel files corrupt each
    // other's migrations and produce nondeterministic 42P07/23505 failures.
    // Run all test files, but never reset a second file's live test schema.
    fileParallelism: false,
    passWithNoTests: false,
    restoreMocks: true,
    clearMocks: true,
  },
});
