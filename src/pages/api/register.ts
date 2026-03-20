export const prerender = false;
export const runtime = 'edge';

import type { APIRoute } from "astro";

// --- UTILIDADES ---
const escapeMarkdown = (text: string) =>
  text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

async function hashData(message: string) {
  const msgUint8 = new TextEncoder().encode(message.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const contentType = request.headers.get("content-type") || "";

    // ✅ ACEPTAR TODOS LOS FORMATOS
    let nombre = "", email = "", tel = "", categoria = "", honeypot = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      nombre = formData.get("nombre")?.toString() || "";
      email = formData.get("email")?.toString() || "";
      tel = formData.get("tel")?.toString() || "";
      categoria = formData.get("categoria")?.toString() || "";
      honeypot = formData.get("company")?.toString() || "";
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      nombre = body.nombre || "";
      email = body.email || "";
      tel = body.tel || "";
      categoria = body.categoria || "";
      honeypot = body.company || "";
    } else {
      return new Response(JSON.stringify({ error: "Formato no soportado" }), { status: 400 });
    }

    // ✅ ANTIBOT
    if (honeypot) {
      return new Response(JSON.stringify({ error: "Bot detectado" }), { status: 403 });
    }

    // ✅ VALIDACIÓN
    if (!email.includes("@") || nombre.length < 2) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
    }
console.log("📥 DATA RECIBIDA EN API:", { nombre, email, tel, categoria });
    // CONTEXTO
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      clientAddress ||
      "0.0.0.0";

    const userAgent = request.headers.get("user-agent") || "unknown";

    // ✅ ENV VARIABLES (CRÍTICO)
    const GOOGLE_WEBHOOK = import.meta.env.GOOGLE_WEBHOOK_URL;
    const PIXEL_ID = import.meta.env.META_PIXEL_ID;
    const ACCESS_TOKEN = import.meta.env.META_ACCESS_TOKEN;
    const TELEGRAM_TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = import.meta.env.TELEGRAM_CHAT_ID;

    // 🔥 DEBUG (ver en Cloudflare logs)
    console.log("ENV CHECK:", {
      GOOGLE_WEBHOOK,
      PIXEL_ID,
      TELEGRAM_TOKEN
    });

    const emailHash = await hashData(email);
    const telHash = await hashData(tel);

    const tasks: Promise<any>[] = [];

    // =========================
    // 📊 GOOGLE SHEETS
    // =========================
    if (GOOGLE_WEBHOOK) {
      tasks.push(
        fetch(GOOGLE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email, tel, categoria, fecha: new Date().toISOString() })
        })
          .then(res => res.text())
          .then(txt => console.log("Sheets OK:", txt))
          .catch(err => console.error("Sheets Error:", err))
      );
    }

    // =========================
    // 📈 META CAPI
    // =========================
    if (PIXEL_ID && ACCESS_TOKEN) {
      tasks.push(
        fetch(`https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
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
              }
            }],
            test_event_code: "TEST6866"
          })
        })
          .then(res => res.json())
          .then(data => console.log("Meta OK:", data))
          .catch(err => console.error("Meta Error:", err))
      );
    }

    // =========================
    // 🤖 TELEGRAM
    // =========================
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      const text =
        `🚀 *Nuevo Lead*\n\n` +
        `👤 ${escapeMarkdown(nombre)}\n` +
        `📧 ${escapeMarkdown(email)}\n` +
        `📱 ${escapeMarkdown(tel)}\n` +
        `🏷️ ${escapeMarkdown(categoria)}`;

      tasks.push(
        fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "MarkdownV2"
          })
        }).catch(err => console.error("Telegram Error:", err))
      );
    }

    // 🚀 MEJORA: AWAIT PARA ASEGURAR EJECUCIÓN EN CLOUDFLARE EDGE
    await Promise.allSettled(tasks);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("ERROR API:", error.message);
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
  }
};