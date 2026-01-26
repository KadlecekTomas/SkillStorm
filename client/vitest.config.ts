import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./setup-tests.ts"],
    include: [
      "src/tests/**/*.spec.ts",
      "src/tests/**/*.spec.tsx",
      "tests/fe-policy/components/**/*.test.ts",
      "tests/fe-policy/components/**/*.test.tsx",
      "tests/fe-policy/**/*.spec.ts",
      "tests/fe-policy/**/*.spec.tsx",
    ],
    exclude: [
      "**/e2e/**",
      "**/node_modules/**",
      "**/dist/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
