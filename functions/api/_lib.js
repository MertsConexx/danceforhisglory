// Shared helpers for the Dance for His Glory booking endpoints.
// Runs on Cloudflare Pages Functions (Workers runtime).

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const clean = (v, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Normalise a South African number to E.164, e.g. "082 123 4567" -> "+27821234567". */
export function normalisePhone(input) {
  let d = String(input || "").replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith("27")) return "+" + d;
  if (d.startsWith("0")) return "+27" + d.slice(1);
  return "+27" + d;
}

/** Reject obvious bots: hidden honeypot field must stay empty. */
export const isBot = (body) => Boolean(clean(body.website));

/** Optional Cloudflare Turnstile check. Skipped entirely if no secret is set. */
export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token || "");
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );
    const j = await r.json();
    return j.success === true;
  } catch {
    return false;
  }
}

/**
 * Send a WhatsApp notification to the organiser.
 * Provider is chosen with env.WA_PROVIDER: "callmebot" (default) | "meta" | "twilio".
 * Never throws — a notification failure must not lose the booking.
 */
export async function notifyWhatsApp(env, text) {
  const to = normalisePhone(env.WA_TO || "+27781740616");
  const provider = (env.WA_PROVIDER || "callmebot").toLowerCase();

  try {
    if (provider === "callmebot") {
      if (!env.CALLMEBOT_APIKEY) return { sent: false, reason: "no CALLMEBOT_APIKEY" };
      const url =
        "https://api.callmebot.com/whatsapp.php?phone=" +
        encodeURIComponent(to) +
        "&apikey=" +
        encodeURIComponent(env.CALLMEBOT_APIKEY) +
        "&text=" +
        encodeURIComponent(text);
      const r = await fetch(url);
      return { sent: r.ok, status: r.status };
    }

    if (provider === "meta") {
      // Official WhatsApp Cloud API. Outside the 24-hour service window Meta only
      // delivers approved template messages, so we send a template with one body
      // variable holding the whole notification text.
      const r = await fetch(
        `https://graph.facebook.com/v20.0/${env.META_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${env.META_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace("+", ""),
            type: "template",
            template: {
              name: env.META_TEMPLATE || "booking_alert",
              language: { code: env.META_TEMPLATE_LANG || "en" },
              components: [
                { type: "body", parameters: [{ type: "text", text }] },
              ],
            },
          }),
        }
      );
      return { sent: r.ok, status: r.status };
    }

    if (provider === "twilio") {
      const body = new URLSearchParams({
        From: env.TWILIO_FROM, // e.g. whatsapp:+14155238886
        To: "whatsapp:" + to,
        Body: text,
      });
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            authorization:
              "Basic " + btoa(`${env.TWILIO_SID}:${env.TWILIO_AUTH_TOKEN}`),
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
        }
      );
      return { sent: r.ok, status: r.status };
    }

    return { sent: false, reason: "unknown provider" };
  } catch (e) {
    return { sent: false, reason: String(e) };
  }
}

/** Optional email copy via Resend. Skipped if RESEND_API_KEY is not set. */
export async function notifyEmail(env, subject, text) {
  if (!env.RESEND_API_KEY || !env.EMAIL_TO) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "bookings@danceforhisglory.co.za",
        to: [env.EMAIL_TO],
        subject,
        text,
      }),
    });
  } catch {
    /* non-fatal */
  }
}
