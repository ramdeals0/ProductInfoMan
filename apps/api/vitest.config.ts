import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

config({ path: resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    env: {
      IMPORT_SYNC: "true",
      SEARCH_SYNC: "true",
      PUBLISH_SYNC: "true",
      EVENT_SYNC: "true",
      VITEST: "true",
      NODE_ENV: "test",
    },
  },
});
