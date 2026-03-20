// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  // 🔥 Habilita SSR (OBLIGATORIO para que /api/register funcione en Cloudflare)
  output: "server",

  // ✅ Adapter oficial para Cloudflare Pages / Workers
  adapter: cloudflare({
    // 🔥 IMPORTANTE: habilita edge runtime correctamente
    platformProxy: {
      enabled: true
    }
  }),

  // ✅ Integraciones
  integrations: [
    tailwind(),
  ],

  // ⚠️ Solo para desarrollo local
  server: {
    host: true,
    port: 4321,
  },

  // 🔐 Seguridad
  security: {
    checkOrigin: true,
  },

  // ⚡ Optimización de build
  build: {
    inlineStylesheets: "always",
  },

  // 🔥 FIX para problemas con import.meta.env y edge runtime
  vite: {
    define: {
      "process.env": {}
    },
    build: {
      target: "esnext",
    },
  },
});