import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    // Tiap berkas tes memakai database SQLite di memori yang dimigrasi ulang.
    env: { DATABASE_PATH: ":memory:" },
    include: ["src/**/*.test.ts"],
  },
});
