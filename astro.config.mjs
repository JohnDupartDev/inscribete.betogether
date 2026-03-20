// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  // 1. ACTIVAR SSR: Permite procesar APIs y formularios en el servidor
  output: 'server', 
  
  // 2. ADAPTADOR CLOUDFLARE (Versión Moderna)
  adapter: cloudflare(), // En la v13 ya no se necesita el objeto 'mode'

  integrations: [tailwind()],

  // 3. SEGURIDAD DE RED Y CABECERAS
  server: {
    port: 4321,
    host: true, // Permite ver la web en otros dispositivos de tu red local
  },

  // 4. PROTECCIÓN DE ORIGEN (Solo acepta peticiones de tu propio dominio)
  security: {
    checkOrigin: true, 
  },

  // 5. OPTIMIZACIÓN DE ASSETS
  build: {
    inlineStylesheets: 'always',
  }
});