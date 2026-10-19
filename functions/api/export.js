// GET /api/export?token=...&table=bookings|referrals|guest_details|answers  ->  CSV download
// Set ADMIN_TOKEN as a secret in Pages. Without it the endpoint stays closed.

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!env.ADMIN_TOKEN || url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.DB) return new Response("No database bound", { status: 500 });

  const allowed = ["bookings", "referrals", "guest_details", "answers"];
  const asked = url.searchParams.get("table");
  const table = allowed.includes(asked) ? asked : "bookings";
  let results;
  try {
    ({ results } = await env.DB.prepare(
      table === "answers" ? "SELECT * FROM answers ORDER BY seat" : `SELECT * FROM ${table} ORDER BY id DESC`
    ).all());
  } catch {
    return new Response("No rows yet\n", { status: 200 });
  }

  if (!results.length) return new Response("No rows yet\n", { status: 200 });

  const cols = Object.keys(results[0]);
  const csv = [
    cols.join(","),
    ...results.map((r) => cols.map((c) => cell(r[c])).join(",")),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${table}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
