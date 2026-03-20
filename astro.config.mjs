// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  // 🔥 Habilita SSR (necesario para APIs como tu /api/register)
  output: "server",

  // ✅ Adapter oficial para Cloudflare Pages / Workers
  adapter: cloudflare(),

  // ✅ Integraciones
  integrations: [
    tailwind(),
  ],

  // ⚠️ IMPORTANTE: server config solo aplica en dev local
  // (Cloudflare lo ignora, pero lo dejamos limpio)
  server: {
    host: true,
    port: 4321,
  },

  // 🔐 Seguridad (válido en SSR)
  security: {
    checkOrigin: true,
  },

  // ⚡ Optimización de build
  build: {
    inlineStylesheets: "always",
  },

  // 🔥 RECOMENDADO: evita problemas de compatibilidad
  vite: {
    build: {
      target: "esnext",
    },
  },
});