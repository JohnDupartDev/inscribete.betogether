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

export const POST: APIRoute = async ({ request, clientAddress, locals }) => {
  try {
    // ☁️ ACCESO A VARIABLES EN CLOUDFLARE EDGE
    // Astro inyecta las variables de entorno en locals.runtime.env en producción
    const env = (locals as any).runtime?.env || {};

    const GOOGLE_WEBHOOK_LEGACY =
      env.GOOGLE_WEBHOOK_URL || import.meta.env.GOOGLE_WEBHOOK_URL;

    const GOOGLE_WEBHOOK_V2 =
      env.GOOGLE_WEBHOOK_URL_V2 || import.meta.env.GOOGLE_WEBHOOK_URL_V2;

    const GOOGLE_WEBHOOK =
      GOOGLE_WEBHOOK_V2 || GOOGLE_WEBHOOK_LEGACY;

    const GOOGLE_WEBHOOK_SECRET =
      env.GOOGLE_WEBHOOK_SECRET || import.meta.env.GOOGLE_WEBHOOK_SECRET;
    const PIXEL_ID = env.META_PIXEL_ID || import.meta.env.META_PIXEL_ID;
    const ACCESS_TOKEN = env.META_ACCESS_TOKEN || import.meta.env.META_ACCESS_TOKEN;
    const TELEGRAM_TOKEN = env.TELEGRAM_BOT_TOKEN || import.meta.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID || import.meta.env.TELEGRAM_CHAT_ID;

    const contentType = request.headers.get("content-type") || "";

    // ✅ ACEPTAR TODOS LOS FORMATOS
    let nombre = "";
    let email = "";
    let tel = "";
    let categoria = "";
    let honeypot = "";

    let tipo = "";
    let online = "";
    let festival = "";
    let redes_sociales = "";
    let red_social = "";
    let participar_eventos = "";
    let mensaje_adicional = "";
    let terms = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      nombre = formData.get("nombre")?.toString() || "";
      email = formData.get("email")?.toString() || "";
      tel =
        formData.get("tel")?.toString() ||
        formData.get("whatsapp")?.toString() ||
        "";
      categoria = formData.get("categoria")?.toString() || "";
      honeypot = formData.get("company")?.toString() || "";

      tipo = formData.get("tipo")?.toString() || "";
      online = formData.get("online")?.toString() || "";
      festival = formData.get("festival")?.toString() || "";
      redes_sociales = formData.get("redes_sociales")?.toString() || "";
      red_social = formData.get("red_social")?.toString() || "";
      participar_eventos =
        formData.get("participar_eventos")?.toString() || "";
      mensaje_adicional =
        formData.get("mensaje_adicional")?.toString() || "";
      terms = formData.get("terms")?.toString() || "";
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      nombre = body.nombre || "";
      email = body.email || "";
      tel = body.tel || body.whatsapp || "";
      categoria = body.categoria || "";
      honeypot = body.company || "";

      tipo = body.tipo || "";
      online = body.online || "";
      festival = body.festival || "";
      redes_sociales = body.redes_sociales || "";
      red_social = body.red_social || "";
      participar_eventos = body.participar_eventos || "";
      mensaje_adicional = body.mensaje_adicional || "";
      terms = body.terms || "";
    } else {
      return new Response(JSON.stringify({ error: "Formato no soportado" }), { status: 400 });
    }

    // ✅ ANTIBOT (Opcional - Descomentar si es necesario)
    // if (honeypot) {
    //   return new Response(JSON.stringify({ error: "Bot detectado" }), { status: 403 });
    // }

    // ✅ VALIDACIÓN
    if (!email.includes("@") || nombre.length < 2) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
    }

    console.log("📥 DATA RECIBIDA EN API:", {
      nombre: !!nombre,
      email: !!email,
      tel: !!tel,
      categoria: !!categoria,
      tipo: !!tipo,
      online: !!online,
      festival: !!festival,
      redes_sociales: !!redes_sociales,
      red_social: !!red_social,
      participar_eventos: !!participar_eventos,
      mensaje_adicional: !!mensaje_adicional,
      terms: !!terms
    });

    // CONTEXTO PARA META
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      clientAddress ||
      "0.0.0.0";

    const userAgent = request.headers.get("user-agent") || "unknown";

    // 🔥 DEBUG DE VARIABLES (Crucial para ver en Cloudflare Logs)
    console.log("🔍 ENV CHECK (Production):", {
      hasSheets: !!GOOGLE_WEBHOOK,
      hasSheetsV2: !!GOOGLE_WEBHOOK_V2,
      hasSheetsSecret: !!GOOGLE_WEBHOOK_SECRET,
      hasPixel: !!PIXEL_ID,
      hasTelegram: !!TELEGRAM_TOKEN
    });

    const emailHash = await hashData(email);
    const telHash = tel.trim() ? await hashData(tel) : "";

    const leadPayload = {
      nombre,
      email,
      tel,
      whatsapp: tel,
      categoria,
      tipo,
      online,
      festival,
      redes_sociales,
      red_social,
      participar_eventos,
      mensaje_adicional,
      terms,
      fecha: new Date().toISOString()
    };

    const sheetsPayload = GOOGLE_WEBHOOK_V2
      ? {
          ...leadPayload,
          webhook_secret: GOOGLE_WEBHOOK_SECRET || ""
        }
      : leadPayload;

    const metaUserData: {
      em: string[];
      ph?: string[];
      client_ip_address: string;
      client_user_agent: string;
    } = {
      em: [emailHash],
      client_ip_address: ip,
      client_user_agent: userAgent
    };

    if (telHash) {
      metaUserData.ph = [telHash];
    }

    const tasks: Promise<any>[] = [];

    // =========================
    // 📊 GOOGLE SHEETS
    // =========================
    if (GOOGLE_WEBHOOK) {
      tasks.push(
        fetch(GOOGLE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sheetsPayload)
        })
          .then(res => res.text())
          .then(txt => console.log("✅ Sheets OK:", txt))
          .catch(err => console.error("❌ Sheets Error:", err))
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
              user_data: metaUserData
            }],
            test_event_code: "TEST65918"
          })
        })
          .then(res => res.json())
          .then(data => console.log("✅ Meta OK:", data))
          .catch(err => console.error("❌ Meta Error:", err))
      );
    }

    // =========================
    // 🤖 TELEGRAM
    // =========================
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      const telegramValue = (value: string, maxLength = 500) =>
        escapeMarkdown(
          (value.trim() || "No informado").slice(0, maxLength)
        );

      const termsLabel =
        terms === "1"
          ? "Sí"
          : terms || "No informado";

      const text =
        `🚀 *Nuevo Lead*\n\n` +
        `👤 Nombre: ${telegramValue(nombre, 120)}\n` +
        `📧 Email: ${telegramValue(email, 254)}\n` +
        `📱 WhatsApp: ${telegramValue(tel, 40)}\n` +
        `🏷️ Categoría: ${telegramValue(categoria, 100)}\n` +
        `🏢 Tipo: ${telegramValue(tipo, 100)}\n` +
        `🛒 Vende online: ${telegramValue(online, 30)}\n` +
        `🎪 Festivales: ${telegramValue(festival, 30)}\n` +
        `🌐 Red social: ${telegramValue(red_social, 80)}\n` +
        `🔗 Perfil social: ${telegramValue(redes_sociales, 500)}\n` +
        `🎟️ Eventos: ${telegramValue(participar_eventos, 100)}\n` +
        `💬 Mensaje: ${telegramValue(mensaje_adicional, 1000)}\n` +
        `✅ Términos: ${telegramValue(termsLabel, 30)}`;

      tasks.push(
        fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "MarkdownV2"
          })
        })
          .then(() => console.log("✅ Telegram OK"))
          .catch(err => console.error("❌ Telegram Error:", err))
      );
    }

    // 🚀 CRÍTICO: Esperamos a que todas las promesas se resuelvan antes de cerrar la conexión Edge
    await Promise.allSettled(tasks);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("❌ ERROR CRÍTICO API:", error.message);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
  }
};