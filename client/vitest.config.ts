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
      "tests/fe-policy/**/*.test.ts",
      "tests/fe-policy/**/*.test.tsx",
      "tests/fe-policy/**/*.spec.ts",
      "tests/fe-policy/**/*.spec.tsx",
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
