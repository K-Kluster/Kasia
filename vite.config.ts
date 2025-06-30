import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sri } from "vite-plugin-sri3";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sri()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  esbuild: {
    keepNames: true,
  },
});
