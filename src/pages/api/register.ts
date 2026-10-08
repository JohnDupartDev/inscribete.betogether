export const prerender = false;
export const runtime = "edge";

import type { APIRoute } from "astro";

const escapeMarkdown = (text: string) =>
  text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

async function hashData(message: string) {
  const msgUint8 =
    new TextEncoder().encode(
      message.trim().toLowerCase()
    );

  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      msgUint8
    );

  return Array
    .from(new Uint8Array(hashBuffer))
    .map((b) =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
}

const normalizePhone = (value: string) => {
  const digits =
    String(value || "").replace(/\D/g, "");

  if (
    digits.length === 12 &&
    digits.startsWith("57")
  ) {
    return digits.slice(2);
  }

  return digits;
};

export const POST: APIRoute = async ({
  request,
  clientAddress,
  locals
}) => {
  try {
    const env =
      (locals as any).runtime?.env || {};

    const GOOGLE_WEBHOOK_LEGACY =
      env.GOOGLE_WEBHOOK_URL ||
      import.meta.env.GOOGLE_WEBHOOK_URL;

    const GOOGLE_WEBHOOK_V2 =
      env.GOOGLE_WEBHOOK_URL_V2 ||
      import.meta.env.GOOGLE_WEBHOOK_URL_V2;

    const GOOGLE_WEBHOOK =
      GOOGLE_WEBHOOK_V2 ||
      GOOGLE_WEBHOOK_LEGACY;

    const GOOGLE_WEBHOOK_SECRET =
      env.GOOGLE_WEBHOOK_SECRET ||
      import.meta.env.GOOGLE_WEBHOOK_SECRET;

    const PIXEL_ID =
      env.META_PIXEL_ID ||
      import.meta.env.META_PIXEL_ID;

    const ACCESS_TOKEN =
      env.META_ACCESS_TOKEN ||
      import.meta.env.META_ACCESS_TOKEN;

    const TELEGRAM_TOKEN =
      env.TELEGRAM_BOT_TOKEN ||
      import.meta.env.TELEGRAM_BOT_TOKEN;

    const TELEGRAM_CHAT_ID =
      env.TELEGRAM_CHAT_ID ||
      import.meta.env.TELEGRAM_CHAT_ID;

    const contentType =
      request.headers.get("content-type") || "";

    let nombre = "";
    let tel = "";
    let terms = "";
    let honeypot = "";

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      nombre =
        formData
          .get("nombre")
          ?.toString() || "";

      tel =
        formData
          .get("tel")
          ?.toString() ||
        formData
          .get("telefono")
          ?.toString() ||
        formData
          .get("whatsapp")
          ?.toString() ||
        "";

      terms =
        formData
          .get("terms")
          ?.toString() || "";

      honeypot =
        formData
          .get("company")
          ?.toString() || "";
    } else if (
      contentType.includes(
        "application/json"
      )
    ) {
      const body =
        await request.json();

      nombre =
        String(body.nombre || "");

      tel =
        String(
          body.tel ||
          body.telefono ||
          body.whatsapp ||
          ""
        );

      terms =
        String(body.terms || "");

      honeypot =
        String(body.company || "");
    } else {
      return new Response(
        JSON.stringify({
          error: "Formato no soportado"
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    nombre =
      nombre
        .trim()
        .replace(/\s+/g, " ");

    tel =
      normalizePhone(tel);

    if (honeypot) {
      return new Response(
        JSON.stringify({
          error:
            "No fue posible procesar el registro."
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    if (
      nombre.length < 2 ||
      nombre.length > 120
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Ingresa un nombre válido."
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    if (!/^3\d{9}$/.test(tel)) {
      return new Response(
        JSON.stringify({
          error:
            "Ingresa un número celular colombiano válido de 10 dígitos."
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    if (terms !== "1") {
      return new Response(
        JSON.stringify({
          error:
            "Debes aceptar los términos y la política de privacidad."
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    if (!GOOGLE_WEBHOOK) {
      console.error(
        "❌ Sheets webhook no configurado"
      );

      return new Response(
        JSON.stringify({
          error:
            "El registro no está disponible temporalmente. Intenta nuevamente."
        }),
        {
          status: 503,
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    console.log(
      "📥 LEAD VALIDADO:",
      {
        nombre: true,
        tel: true
      }
    );

    const ip =
      request.headers.get(
        "cf-connecting-ip"
      ) ||
      request.headers.get(
        "x-forwarded-for"
      ) ||
      clientAddress ||
      "0.0.0.0";

    const userAgent =
      request.headers.get(
        "user-agent"
      ) || "unknown";

    const eventId =
      crypto.randomUUID();

    /*
     * Google Sheets recibe únicamente:
     * - nombre
     * - telefono
     *
     * webhook_secret es autenticación interna
     * y no debe almacenarse como dato del lead.
     */
    const leadPayload = {
      nombre,
      telefono: tel
    };

    const sheetsPayload =
      GOOGLE_WEBHOOK_V2
        ? {
            ...leadPayload,
            webhook_secret:
              GOOGLE_WEBHOOK_SECRET || ""
          }
        : leadPayload;

    /*
     * Sheets es crítico.
     * No confirmamos el lead ni redirigimos
     * a /gracias/ si el webhook falla.
     */
    try {
      const sheetsResponse =
        await fetch(
          GOOGLE_WEBHOOK,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(
                sheetsPayload
              )
          }
        );

      const sheetsText =
        await sheetsResponse.text();

      if (!sheetsResponse.ok) {
        throw new Error(
          `HTTP ${sheetsResponse.status}`
        );
      }

      try {
        const sheetsData =
          JSON.parse(sheetsText);

        if (
          sheetsData &&
          sheetsData.ok === false
        ) {
          throw new Error(
            sheetsData.error ||
            "Sheets rejected lead"
          );
        }
      } catch (parseError) {
        /*
         * Compatibilidad temporal con el
         * Apps Script actual si responde texto.
         * Un HTTP 2xx sigue siendo válido.
         */
        if (
          parseError instanceof Error &&
          parseError.message !==
            "Unexpected end of JSON input" &&
          sheetsText
            .trim()
            .startsWith("{")
        ) {
          throw parseError;
        }
      }

      console.log(
        "✅ Sheets confirmed lead"
      );
    } catch (error) {
      console.error(
        "❌ Sheets critical error:",
        error
      );

      return new Response(
        JSON.stringify({
          error:
            "No pudimos guardar tus datos. Intenta nuevamente."
        }),
        {
          status: 502,
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    /*
     * Meta recibe únicamente los dos datos
     * proporcionados por el usuario:
     *
     * - nombre
     * - teléfono
     *
     * Todos los identificadores personales
     * se envían con SHA-256.
     */
    const metaPhone =
      `57${tel}`;

    const telHash =
      await hashData(metaPhone);

    const nameParts =
      nombre
        .trim()
        .split(/\\s+/)
        .filter(Boolean);

    const firstName =
      nameParts.length
        ? nameParts[0]
        : "";

    const lastName =
      nameParts.length > 1
        ? nameParts[nameParts.length - 1]
        : "";

    const metaUserData: {
      ph: string[];
      fn?: string[];
      ln?: string[];
      client_ip_address: string;
      client_user_agent: string;
    } = {
      ph: [telHash],
      client_ip_address: ip,
      client_user_agent: userAgent
    };

    if (firstName) {
      metaUserData.fn = [
        await hashData(firstName)
      ];
    }

    if (lastName) {
      metaUserData.ln = [
        await hashData(lastName)
      ];
    }

    const secondaryTasks:
      Promise<unknown>[] = [];

    if (
      PIXEL_ID &&
      ACCESS_TOKEN
    ) {
      secondaryTasks.push(
        fetch(
          `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              data: [
                {
                  event_name:
                    "CompleteRegistration",
                  event_time:
                    Math.floor(
                      Date.now() / 1000
                    ),
                  event_id:
                    eventId,
                  action_source:
                    "website",
                  user_data:
                    metaUserData
                }
              ]
            })
          }
        ).then(
          async (response) => {
            const data =
              await response.json();

            if (!response.ok) {
              throw new Error(
                `Meta HTTP ${response.status}: ${JSON.stringify(data)}`
              );
            }

            console.log(
              "✅ Meta CAPI OK"
            );

            return data;
          }
        )
      );
    }

    if (
      TELEGRAM_TOKEN &&
      TELEGRAM_CHAT_ID
    ) {
      const text =
        `🚀 *Nuevo Lead*\n\n` +
        `👤 Nombre: ${escapeMarkdown(nombre)}\n` +
        `📱 Teléfono: ${escapeMarkdown(tel)}`;

      secondaryTasks.push(
        fetch(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              chat_id:
                TELEGRAM_CHAT_ID,
              text,
              parse_mode:
                "MarkdownV2"
            })
          }
        ).then(
          async (response) => {
            if (!response.ok) {
              throw new Error(
                `Telegram HTTP ${response.status}`
              );
            }

            console.log(
              "✅ Telegram OK"
            );
          }
        )
      );
    }

    const secondaryResults =
      await Promise.allSettled(
        secondaryTasks
      );

    secondaryResults.forEach(
      (result) => {
        if (
          result.status ===
          "rejected"
        ) {
          console.error(
            "❌ Secondary integration error:",
            result.reason
          );
        }
      }
    );

    return new Response(
      JSON.stringify({
        ok: true,
        event_id: eventId
      }),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  } catch (error: any) {
    console.error(
      "❌ ERROR CRÍTICO API:",
      error?.message || error
    );

    return new Response(
      JSON.stringify({
        error:
          "Error interno del servidor"
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};
