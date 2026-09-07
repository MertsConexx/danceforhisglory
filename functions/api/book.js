import {
  json, clean, isBot, normalisePhone, verifyTurnstile, notifyWhatsApp, notifyEmail,
} from "./_lib.js";
import { capacity, seatsTaken } from "./seats.js";

// This page belongs to one couple only. Every response is attributed to them.
const COUPLE_CODE = "07";
const COUPLE_NAME = "Merton & Chanelle Pheiffer";

const INTENT = {
  give_and_come: { label: "Giving and attending", attending: true },
  give_only: { label: "Giving, cannot attend", attending: false },
};

const WHEN = {
  before: "Before the event, by EFT",
  night: "On the night",
  both: "Some now, more on the night",
  done: "Has already given",
};

// Edit these to match how you want the bands reported.
const BAND = {
  lt5: "Up to R5 000",
  "5-15": "R5 000 – R15 000",
  "15-50": "R15 000 – R50 000",
  "50-100": "R50 000 – R100 000",
  "100+": "More than R100 000",
  talk: "Prefers to discuss in person",
};

// Bands that deserve a personal call rather than a WhatsApp reply.
const HIGH = new Set(["15-50", "50-100", "100+", "talk"]);

// "Jan van der Merwe" -> 07_VANDERMERWE. Everything after the first name counts
// as the surname, so Afrikaans compound surnames are not truncated.
const surnameRef = (name) => {
  const parts = name.trim().split(/\s+/);
  const surname = (parts.length > 1 ? parts.slice(1).join("") : parts[0])
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return `${COUPLE_CODE}_${surname}`;
};

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Bad request" }, 400);
  }

  if (isBot(body)) return json({ ok: true }); // silently accept and drop

  const ip = request.headers.get("cf-connecting-ip") || "";
  if (!(await verifyTurnstile(env, body["cf-turnstile-response"], ip))) {
    return json({ ok: false, error: "Verification failed" }, 403);
  }

  const name = clean(body.name, 120);
  const phone = normalisePhone(body.phone);
  if (!name || phone.length < 8) {
    return json({ ok: false, error: "Name and WhatsApp number are required" }, 400);
  }

  const intentKey = INTENT[body.intent] ? body.intent : "give_and_come";
  const intent = INTENT[intentKey];

  // Fields the browser hid are ignored server-side rather than trusted.
  const seats = intent.attending
    ? Math.max(0, Math.min(10, parseInt(body.seats, 10) || 0))
    : 0;
  const giveWhen = WHEN[body.give_when] ? body.give_when : "";
  const band = BAND[body.amount_band] ? body.amount_band : "";
  const taxCert = body.tax_cert === "yes" ? "yes" : "no";

  // The table has a hard limit. Check it here as well as in the browser, so a
  // stale page or a second person mid-form cannot push us past capacity.
  if (seats > 0) {
    const cap = capacity(env);
    const remaining = Math.max(0, cap - (await seatsTaken(env)));
    if (seats > remaining) {
      return json(
        {
          ok: false,
          soft: true,
          error:
            remaining === 0
              ? "Our table filled up while you were typing. You can still give without attending — choose the second option above."
              : `Only ${remaining} seat${remaining === 1 ? "" : "s"} are left at our table. Please lower the number and send again.`,
          remaining,
        },
        409
      );
    }
  }

  const record = {
    created_at: new Date().toISOString(),
    name,
    phone,
    email: clean(body.email, 160),
    organisation: clean(body.organisation, 160),
    intent: intentKey,
    seats,
    give_when: giveWhen,
    amount_band: band,
    tax_cert: taxCert,
    couple_code: COUPLE_CODE,
    dietary: intent.attending ? clean(body.dietary, 300) : "",
    message: clean(body.message, 1500),
    ip,
    user_agent: clean(request.headers.get("user-agent"), 250),
  };

  // 1. Store first — the record must survive even if notification fails.
  let id = null;
  if (env.DB) {
    try {
      const res = await env.DB.prepare(
        `INSERT INTO bookings
         (created_at,name,phone,email,organisation,intent,seats,give_when,
          amount_band,tax_cert,couple_code,dietary,message,ip,user_agent)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
        .bind(
          record.created_at, record.name, record.phone, record.email,
          record.organisation, record.intent, record.seats, record.give_when,
          record.amount_band, record.tax_cert, record.couple_code,
          record.dietary, record.message, record.ip, record.user_agent
        )
        .run();
      id = res.meta?.last_row_id ?? null;
    } catch (e) {
      console.error("D1 insert failed", e);
    }
  }

  // 2. Notify, leading with whatever needs your attention first.
  const headline = HIGH.has(band)
    ? `*Call this one* — ${COUPLE_NAME}`
    : `*New response* — ${COUPLE_NAME}`;

  const text = [
    headline,
    `Name: ${record.name}${record.organisation ? ` (${record.organisation})` : ""}`,
    `WhatsApp: ${record.phone}`,
    record.email ? `Email: ${record.email}` : null,
    intent.label,
    band ? `Considering: ${BAND[band]}` : null,
    giveWhen ? `Timing: ${WHEN[giveWhen]}` : null,
    `18A certificate: ${taxCert === "yes" ? "yes" : "no"}`,
    intent.attending
      ? seats === 0
        ? "Seats: not sure yet, wants a call"
        : `Seats: ${seats}`
      : "Not attending",
    `EFT reference: ${surnameRef(record.name)}`,
    record.dietary ? `Dietary: ${record.dietary}` : null,
    record.message ? `Note: ${record.message}` : null,
    id ? `Ref: #${id}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await notifyWhatsApp(env, text);
  await notifyEmail(
    env,
    `${HIGH.has(band) ? "[Call] " : ""}${record.name} — ${intent.label}`,
    text
  );

  return json({ ok: true, id });
}

export const onRequestGet = () => json({ ok: false, error: "Use POST" }, 405);
