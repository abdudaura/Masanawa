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
    passWithNoTests: false,
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 15000,
  },
});
