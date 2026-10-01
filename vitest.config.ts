import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
    restoreMocks: true,
    clearMocks: true
  }
});
