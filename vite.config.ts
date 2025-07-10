import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sri } from "vite-plugin-sri3";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sri(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Kasia",
        short_name: "Kasia",
        description: "Kasia: Encrypted Messaging Platform",
        theme_color: "#1e293b",
        background_color: "#1e293b",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/kasia-logo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/kasia-logo-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // 13 mb
        maximumFileSizeToCacheInBytes: 13000000,
      },
    }),
  ],
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
