export const prerender = false;
export const runtime = 'edge'; // VITAL para Cloudflare

import type { APIRoute } from "astro";

// --- FUNCIÓN DE HASHING COMPATIBLE CON CLOUDFLARE EDGE ---
// Sustituye a node:crypto para evitar errores de compilación
async function hashData(message: string) {
  const msgUint8 = new TextEncoder().encode(message.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // 1. Validación de Cabeceras
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
       return new Response(JSON.stringify({ error: "Formato no permitido" }), { status: 403 });
    }

    // 2. Extracción de Datos
    const formData = await request.formData();
    const nombre = formData.get("nombre")?.toString() || "";
    const email = formData.get("email")?.toString() || "";
    const tel = formData.get("tel")?.toString() || "";
    const categoria = formData.get("categoria")?.toString() || "";
    const userAgent = request.headers.get("user-agent") || "";
    const ip = clientAddress || "127.0.0.1";

    // 3. Carga de Variables de Entorno (Importante: Cloudflare las lee así)
    const GOOGLE_WEBHOOK = import.meta.env.GOOGLE_WEBHOOK_URL;
    const PIXEL_ID = import.meta.env.META_PIXEL_ID;
    const ACCESS_TOKEN = import.meta.env.META_ACCESS_TOKEN;
    const TELEGRAM_TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = import.meta.env.TELEGRAM_CHAT_ID;

    // Hashear datos para Meta CAPI (ahora es async)
    const emailHash = await hashData(email);
    const telHash = await hashData(tel);

    // --- PROCESO 1: GOOGLE SHEETS ---
    if (GOOGLE_WEBHOOK) {
      try {
        await fetch(GOOGLE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email, tel, categoria })
        });
        console.log("✅ Google Sheets: Datos sincronizados.");
      } catch (e) {
        console.error("❌ Error en Sheets:", e);
      }
    }

    // --- PROCESO 2: META CAPI ---
    if (ACCESS_TOKEN && PIXEL_ID) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [{
              event_name: "CompleteRegistration",
              event_time: Math.floor(Date.now() / 1000),
              action_source: "website",
              user_data: {
                em: [emailHash],
                ph: [telHash],
                client_ip_address: ip,
                client_user_agent: userAgent,
              },
              custom_data: {
                content_name: "Registro Club de Pioneros - BeTogether",
                content_category: categoria
              }
            }],
            test_event_code: "TEST6866" 
          })
        });

        const metaData = await metaRes.json();
        console.log("📊 Respuesta Meta CAPI:", JSON.stringify(metaData));
      } catch (e) {
        console.error("❌ Error en Meta CAPI:", e);
      }
    }

    // --- PROCESO 3: NOTIFICACIÓN TELEGRAM ---
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const text = `🚀 *NUEVO LEAD EN BETOGETHER*\n\n` +
                     `👤 *Nombre:* ${nombre}\n` +
                     `📧 *Email:* ${email}\n` +
                     `📱 *WhatsApp:* ${tel}\n` +
                     `🏷️ *Categoría:* ${categoria}\n\n` +
                     `🌐 _IP: ${ip}_`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: "Markdown"
          })
        });
        console.log("📤 Notificación de Telegram enviada.");
      } catch (e) {
        console.error("❌ Error en Telegram:", e);
      }
    }

    return new Response(JSON.stringify({ message: "Registro procesado con éxito" }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("❌ Error crítico:", error.message);
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
  }
};