// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["pwa-icon.svg"],
        manifest: {
          name: "SEPS — Simetri ERP Store",
          short_name: "SEPS",
          description: "Sistem ERP untuk toko bangunan — POS, inventory, keuangan.",
          theme_color: "#059669",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/pwa-icon.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api",
                networkTimeoutSeconds: 8,
                expiration: { maxEntries: 64, maxAgeSeconds: 3600 },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
              handler: "StaleWhileRevalidate",
              options: { cacheName: "static-images" },
            },
          ],
        },
        devOptions: { enabled: process.env.NODE_ENV !== "production" },
      }),
    ],
  },
});
