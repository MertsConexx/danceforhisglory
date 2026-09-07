import {
  json, clean, isBot, normalisePhone, verifyTurnstile, notifyWhatsApp, notifyEmail,
} from "./_lib.js";

const KIND = {
  donation: "A significant donation",
  sponsor: "Sponsorship of the evening",
  seats: "Seats or a table",
};

const USE_NAME = {
  yes: "May mention who suggested them",
  no: "Keep the referrer anonymous",
  intro: "Referrer will introduce us themselves",
};

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Bad request" }, 400);
  }

  if (isBot(body)) return json({ ok: true });

  const ip = request.headers.get("cf-connecting-ip") || "";
  if (!(await verifyTurnstile(env, body["cf-turnstile-response"], ip))) {
    return json({ ok: false, error: "Verification failed" }, 403);
  }

  const referrer = clean(body.referrer_name, 120);
  const prospect = clean(body.prospect_name, 160);
  if (!referrer || !prospect) {
    return json({ ok: false, error: "Your name and their name are required" }, 400);
  }

  const record = {
    created_at: new Date().toISOString(),
    referrer_name: referrer,
    referrer_phone: body.referrer_phone ? normalisePhone(body.referrer_phone) : "",
    prospect_name: prospect,
    prospect_phone: body.prospect_phone ? normalisePhone(body.prospect_phone) : "",
    prospect_email: clean(body.prospect_email, 160),
    prospect_type: clean(body.prospect_type, 20),
    context: clean(body.context, 1500),
    use_name: clean(body.use_name, 20),
    ip,
  };

  let id = null;
  if (env.DB) {
    try {
      const res = await env.DB.prepare(
        `INSERT INTO referrals
         (created_at,referrer_name,referrer_phone,prospect_name,prospect_phone,
          prospect_email,prospect_type,context,use_name,ip)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
        .bind(
          record.created_at, record.referrer_name, record.referrer_phone,
          record.prospect_name, record.prospect_phone, record.prospect_email,
          record.prospect_type, record.context, record.use_name, record.ip
        )
        .run();
      id = res.meta?.last_row_id ?? null;
    } catch (e) {
      console.error("D1 insert failed", e);
    }
  }

  const text = [
    "*New person to approach* — Merton & Chanelle",
    `Suggested by: ${record.referrer_name}` +
      (record.referrer_phone ? ` (${record.referrer_phone})` : ""),
    `Approach: ${record.prospect_name}`,
    record.prospect_phone ? `Their phone: ${record.prospect_phone}` : null,
    record.prospect_email ? `Their email: ${record.prospect_email}` : null,
    KIND[record.prospect_type] ? `Open to: ${KIND[record.prospect_type]}` : null,
    USE_NAME[record.use_name] ? `Naming: ${USE_NAME[record.use_name]}` : null,
    record.context ? `Context: ${record.context}` : null,
    id ? `Ref: R#${id}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await notifyWhatsApp(env, text);
  await notifyEmail(env, `Referral: ${record.prospect_name}`, text);

  return json({ ok: true, id });
}

export const onRequestGet = () => json({ ok: false, error: "Use POST" }, 405);
