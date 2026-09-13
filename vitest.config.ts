import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Sin este alias los imports de valores con "@/..." fallan (ver PROMPT §12.4).
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["lib/**/*.test.ts", "config/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
