import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base: "./" — ścieżki względne, dzięki temu strona działa pod dowolnym adresem
// (GitHub Pages: https://<login>.github.io/<nazwa-repo>/, własna domena, plik lokalny).
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
