// POST /api/details  ->  private guest details for the night (dietary needs and Section 18A certificate info)
//
// These details are never shown on the seating page. Organisers read them with
//   /api/export?token=YOUR_ADMIN_TOKEN&table=guest_details
// Every submission is kept as its own row, so a later submission never wipes an earlier one.

import { json, clean, isBot, normalisePhone, notifyWhatsApp, notifyEmail } from "./_lib.js";

const GUESTS = {
  101: "Mark Miller", 102: "Janelle Miller", 103: "Dale Cornelsons", 104: "Lerita Cornelsons",
  105: "Johan Wassermans", 106: "Jenny Wassermans", 107: "Garth Le Roux", 108: "Tina Le Roux",
  109: "Deon van Heerden", 110: "Corine van Heerden", 111: "Xander Boonzaaier", 112: "Alechia Boonzaaier",
  113: "Pieter Lourens", 114: "Lucinda Lourens", 115: "Andre Theron", 116: "Nicke Theron",
  117: "Tyron Ward", 118: "Carmen Ward", 119: "Sharon van As", 120: "Dirkie van As",
};

const one = (v, max) => clean(typeof v === "string" ? v.replace(/<[^>]*>/g, "") : "", max);
const digits = (v) => String(v || "").replace(/\D/g, "");

async function ensureTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS guest_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      seat INTEGER NOT NULL,
      guest_name TEXT NOT NULL,
      dietary TEXT,
      needs_18a TEXT NOT NULL,
      donor_type TEXT,
      donor_name TEXT,
      id_or_reg TEXT,
      tax_ref TEXT,
      address TEXT,
      email TEXT,
      phone TEXT,
      amount TEXT,
      paid_on TEXT,
      notes TEXT,
      ip TEXT
    )`
  ).run();
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "The form could not be read. Please try again." }, 400); }
  if (!body || typeof body !== "object") return json({ ok: false, error: "The form could not be read. Please try again." }, 400);
  if (isBot(body)) return json({ ok: true });

  const seat = Number(body.seat);
  const guestName = GUESTS[seat];
  if (!guestName) return json({ ok: false, error: "Please choose your name from the list." }, 400);

  const dietary = one(body.dietary, 300);
  const needs = body.needs_18a === "yes" ? "yes" : "no";
  const notes = one(body.notes, 600);

  const row = {
    donor_type: "", donor_name: "", id_or_reg: "", tax_ref: "", address: "",
    email: one(body.email, 160), phone: normalisePhone(one(body.phone, 30)), amount: "", paid_on: "",
  };

  if (needs === "yes") {
    row.donor_type = body.donor_type === "company" ? "company" : "individual";
    row.donor_name = one(body.donor_name, 160);
    row.id_or_reg = one(body.id_or_reg, 40);
    row.tax_ref = digits(body.tax_ref).slice(0, 10);
    row.address = one(body.address, 400);
    row.amount = one(body.amount, 40);
    row.paid_on = one(body.paid_on, 20);

    const missing = [];
    if (!row.donor_name) missing.push(row.donor_type === "company" ? "registered company name" : "full name");
    if (!row.id_or_reg) missing.push(row.donor_type === "company" ? "company registration number" : "ID number");
    if (row.tax_ref.length !== 10) missing.push("10-digit income tax reference number");
    if (!row.address) missing.push("address");
    if (!/.+@.+\..+/.test(row.email)) missing.push("email address");
    if (missing.length) return json({ ok: false, error: "For the Section 18A certificate we still need your " + missing.join(", ") + "." }, 400);
  } else if (!dietary && !notes) {
    return json({ ok: false, error: "Please add your dietary requirements, or choose Yes for a Section 18A certificate." }, 400);
  }

  if (!env.DB) return json({ ok: false, error: "The details could not be saved (database not connected). Please WhatsApp us on +27 78 174 0616." }, 500);

  try {
    await ensureTable(env.DB);
    await env.DB.prepare(
      `INSERT INTO guest_details
        (created_at, seat, guest_name, dietary, needs_18a, donor_type, donor_name, id_or_reg, tax_ref,
         address, email, phone, amount, paid_on, notes, ip)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
    ).bind(
      new Date().toISOString(), seat, guestName, dietary, needs, row.donor_type, row.donor_name, row.id_or_reg,
      row.tax_ref, row.address, row.email, row.phone, row.amount, row.paid_on, notes,
      request.headers.get("CF-Connecting-IP") || ""
    ).run();
  } catch (e) {
    console.error("details insert failed", e);
    return json({ ok: false, error: "Your details could not be saved. Please try again in a moment." }, 500);
  }

  // Short heads-up for the organisers. ID and tax numbers are deliberately left out of messages.
  const lines = [
    `Guest details received: ${guestName} (seat ${seat})`,
    dietary ? `Dietary: ${dietary}` : "Dietary: none given",
    needs === "yes"
      ? `18A certificate: yes, in the name of ${row.donor_name} (${row.donor_type})`
      : "18A certificate: not needed",
  ];
  if (notes) lines.push(`Note: ${notes}`);
  const text = lines.join("\n");
  await notifyWhatsApp(env, text);
  await notifyEmail(env, `Guest details: ${guestName}`, text + "\n\nFull details: /api/export?table=guest_details", row.email);

  return json({ ok: true });
}

export async function onRequest() {
  return json({ ok: false, error: "Only POST is allowed." }, 405);
}
