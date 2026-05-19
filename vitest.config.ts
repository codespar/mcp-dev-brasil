import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "packages/**/src/__tests__/**/*.test.ts",
      "test-utils/**/__tests__/**/*.test.ts",
    ],
    testTimeout: 10000,
  },
});
