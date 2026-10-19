// Pheiffer's Table — guest answers (Cloudflare Pages Function, served at /api/table)
// Uses the site's existing D1 database (binding DB).
// The table is created automatically on first use.

const SEATS = new Set(Array.from({ length: 20 }, (_, i) => 101 + i));
const DANCES = new Set(["Waltz", "Foxtrot", "Quickstep", "Tango", "Viennese Waltz", "Cha-cha", "Rumba",
  "Samba", "Jive", "Paso Doble", "Salsa", "Langarm", "Sokkie", "Swing"]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const fail = (status, error) => json({ ok: false, error }, status);

const clean = (s, max) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max);

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS answers (seat INTEGER PRIMARY KEY, dance TEXT NOT NULL DEFAULT '', hope TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL)"
  ).run();
}

async function allAnswers(db) {
  const { results } = await db.prepare("SELECT seat, dance, hope, updated FROM answers").all();
  const out = {};
  for (const r of results || []) out[String(r.seat)] = { dance: r.dance, hope: r.hope, updated: r.updated };
  return out;
}

function getDb(env) {
  if (!env.DB) throw new Error("The answers database is not connected yet. In Cloudflare, bind a D1 database to this project as DB.");
  return env.DB;
}

export async function onRequestGet({ env }) {
  try {
    const db = getDb(env);
    await ensureTable(db);
    return json({ ok: true, answers: await allAnswers(db) });
  } catch (e) {
    return fail(500, e.message || "Could not load answers.");
  }
}

export async function onRequestPost({ request, env }) {
  let db;
  try { db = getDb(env); } catch (e) { return fail(500, e.message); }

  const raw = await request.text();
  if (raw.length > 4000) return fail(413, "That answer is too long.");
  let input;
  try { input = JSON.parse(raw); } catch { return fail(400, "The answer could not be read. Please try again."); }
  if (!input || typeof input !== "object") return fail(400, "The answer could not be read. Please try again.");

  // Spam trap: real visitors never fill this hidden field
  if (input.website) return json({ ok: true });

  const seat = Number(input.seat);
  if (!SEATS.has(seat)) return fail(400, "Please choose your name from the list.");

  let dance = clean(input.dance, 40);
  const other = clean(input.other, 40);
  if (dance === "Other") {
    if (!other) return fail(400, "Please type the dance style you would choose.");
    dance = other;
  } else if (dance && !DANCES.has(dance)) {
    return fail(400, "Please pick a dance style from the list.");
  }

  const hope = clean(input.hope, 280);
  if (!dance && !hope) return fail(400, "Please choose a dance style or write what you hope for.");

  try {
    await ensureTable(db);
    await db.prepare(
      "INSERT INTO answers (seat, dance, hope, updated) VALUES (?1, ?2, ?3, ?4) " +
      "ON CONFLICT(seat) DO UPDATE SET dance = excluded.dance, hope = excluded.hope, updated = excluded.updated"
    ).bind(seat, dance, hope, new Date().toISOString()).run();
    return json({ ok: true, answers: await allAnswers(db) });
  } catch (e) {
    return fail(500, "Your answer could not be saved. Please try again in a moment.");
  }
}

export async function onRequest({ request }) {
  return fail(405, "Only GET and POST are allowed.");
}
