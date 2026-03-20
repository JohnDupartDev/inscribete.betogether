// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node"; // El motor para el servidor

export default defineConfig({
  // 1. ACTIVAR SSR: Permite procesar APIs y formularios en el servidor
  output: 'server', 
  
  adapter: node({
    mode: 'standalone',
  }),

  integrations: [tailwind()],

  // 2. SEGURIDAD DE RED Y CABECERAS
  server: {
    port: 4321,
    host: true, // Permite ver la web en otros dispositivos de tu red local
  },

  // 3. PROTECCIÓN DE ORIGEN (Evita que otros sitios usen tu API)
  security: {
    checkOrigin: true, // Solo acepta peticiones de tu propio dominio
  },

  // 4. OPTIMIZACIÓN DE ASSETS (Evita robo de imágenes/archivos pesados)
  build: {
    inlineStylesheets: 'always',
  }
});