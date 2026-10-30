import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    env: { AI_API_KEY: "", AI_BASE_URL: "http://127.0.0.1:9" },
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    clearMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
