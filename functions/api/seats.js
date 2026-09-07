import { json } from "./_lib.js";

/** Seats at the couple's table. Override with the SEAT_CAPACITY variable. */
export const capacity = (env) => {
  const n = parseInt(env.SEAT_CAPACITY, 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
};

/** Seats already committed. "Not sure yet" bookings count as 0 until confirmed. */
export async function seatsTaken(env) {
  if (!env.DB) return 0;
  try {
    const row = await env.DB.prepare(
      "SELECT COALESCE(SUM(seats),0) AS taken FROM bookings"
    ).first();
    return Number(row?.taken) || 0;
  } catch {
    return 0;
  }
}

export async function onRequestGet({ env }) {
  const cap = capacity(env);
  const taken = await seatsTaken(env);
  return new Response(
    JSON.stringify({
      ok: true,
      capacity: cap,
      taken,
      remaining: Math.max(0, cap - taken),
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}
