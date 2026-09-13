import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Sin este alias los imports de valores con "@/..." fallan (ver PROMPT §12.4).
    alias: { "@": raiz },
  },
  test: {
    include: ["lib/**/*.test.ts", "config/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
