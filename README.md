# danceforhisglory.co.za

> **Setting this up for the first time? Follow `SETUP.md` instead.** It is an
> ordered walkthrough from an empty Cloudflare account to a live site, done
> entirely in a browser with no command line. This file is the reference: what
> each setting does, the alternative WhatsApp providers, and how the code behaves.
>
> There is deliberately no `wrangler.toml` in this folder. Cloudflare reads that
> file in preference to your dashboard settings, which causes confusing failures
> on a GitHub-deployed project. Only add one if you switch to the command-line
> route, and then fill in a real `database_id`.

Landing page for **Merton & Chanelle Pheiffer** (couple code 07) at the Strictly Come Dancing fundraiser, George Civic Centre, Saturday 7 November 2026, in aid of George Royal Academy.

Two tabs on one page:

- **Give and attend** — the person first says whether they are giving and coming, or giving without being able to come. Seats and dietary needs appear only for those attending; everyone is asked about timing, an optional amount band, and a Section 18A certificate. Every response is attributed to couple 07 automatically.
- **Suggest someone** — a supporter tells you who to approach, how to reach them, what they might be open to, and whether you may use their name.

Both write to a Cloudflare D1 database and fire a WhatsApp message to the organiser.

---

## Before you deploy — five things to confirm

1. **The WhatsApp number.** You wrote `+78 174 0616`. I have used **+27 78 174 0616** throughout (`+27781740616`), assuming a South African mobile. If that is wrong, change it in `functions/api/_lib.js` (the `WA_TO` default), and in the two `wa.me/27781740616` links in `public/index.html`.
2. **The surname spelling.** The academy site spells it **Merton & Chanelle Pheiffer** and I have used that throughout. If Pheiffer/Pfeiffer or Chanelle/Chanel is wrong, it appears in `public/index.html` (title, meta description, hero kicker, invite strip) and as `COUPLE_NAME` in `functions/api/book.js` and the alert header in `refer.js`.
3. **The table size.** The counter and the limit are both set to **20 seats**. Change it with the `SEAT_CAPACITY` variable in Pages — no code edit needed. The fallback in `functions/api/seats.js` is 20 if the variable is missing.
4. **The amount bands.** The giving question offers Up to R5 000 / R5 000–R15 000 / R15 000–R50 000 / R50 000–R100 000 / More than R100 000, plus an in-kind option and "prefer to discuss in person". I guessed these. They should match the level you are actually asking at — if your real range starts at R25 000, bands that start at R5 000 anchor people downwards. Change them in `public/index.html` (the `b-amount` select) and in the `BAND` map in `functions/api/book.js`; keep the two in step.
5. **Seat price.** The academy page does not publish one, so the page does not either. If seats carry a set price, add it to the label on the seats field.

---

## Deploy

### 1. Create the Pages project

Push this folder to GitHub, then in the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.

- Build command: *(leave blank)*
- Build output directory: `public`

Or from your machine:

```bash
npm i -g wrangler
wrangler login
wrangler pages project create danceforhisglory --production-branch main
```

### 2. Create the database

```bash
wrangler d1 create danceforhisglory
```

Copy the `database_id` it prints. Create a `wrangler.toml` at the project root containing:

```toml
name = "danceforhisglory"
compatibility_date = "2026-01-01"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "danceforhisglory"
database_id = "THE_ID_YOU_JUST_COPIED"
```

Then create the tables:

```bash
wrangler d1 execute danceforhisglory --remote --file=./schema.sql
```

In the dashboard, bind it: **your Pages project → Settings → Bindings → D1 → Add**, variable name `DB`, database `danceforhisglory`. Add it to **both** Production and Preview.

### 3. Set up the WhatsApp notification

Pick one provider and set `WA_PROVIDER` accordingly.

**Option A — CallMeBot (free, five minutes, best for a one-off event)**

Messages arrive from a bot on your personal WhatsApp. Setup, done once on the receiving phone:

1. Save `+34 621 331 709` as a contact.
2. Send it: `I allow callmebot to send me messages`
3. It replies with your API key.

Then set:

| Variable | Value |
|---|---|
| `WA_PROVIDER` | `callmebot` |
| `WA_TO` | `+27781740616` |
| `CALLMEBOT_APIKEY` | *(secret — the key from step 3)* |

Caveat: it is a free hobby service with no delivery guarantee and a rate limit. Fine for a fundraiser, not for anything you cannot afford to miss. Set `EMAIL_TO` as well (below) so you have a second copy.

**Option B — Meta WhatsApp Cloud API (official)**

Create an app at developers.facebook.com, add the WhatsApp product, and get a phone number ID plus a permanent token. Because notifications land outside the 24-hour service window, you must submit a **template** with one body variable — the code sends the whole message as that variable.

| Variable | Value |
|---|---|
| `WA_PROVIDER` | `meta` |
| `META_PHONE_NUMBER_ID` | your number ID |
| `META_TOKEN` | *(secret)* |
| `META_TEMPLATE` | template name, default `booking_alert` |
| `META_TEMPLATE_LANG` | default `en` |

**Option C — Twilio**

| Variable | Value |
|---|---|
| `WA_PROVIDER` | `twilio` |
| `TWILIO_SID` | your account SID |
| `TWILIO_AUTH_TOKEN` | *(secret)* |
| `TWILIO_FROM` | `whatsapp:+14155238886` |

Set these under **Settings → Variables and secrets**. Mark tokens and keys as *Secret*, not plain text.

### 4. Optional extras

| Variable | Why |
|---|---|
| `EMAIL_TO`, `RESEND_API_KEY`, `EMAIL_FROM` | Emails a copy of every submission via Resend. Strongly recommended as a backup to CallMeBot. Note that `EMAIL_FROM` defaults to `bookings@danceforhisglory.co.za`; since this domain no longer sends mail, either verify it in Resend by adding their DNS records to Cloudflare, or set `EMAIL_FROM` to an address on a domain you have verified. |
| `TURNSTILE_SECRET` | Turns on bot protection. Add a Turnstile widget in Cloudflare, drop its script and `<div class="cf-turnstile" data-sitekey="...">` into each form, and the server will start enforcing it. Without the secret, verification is skipped and the hidden honeypot field is the only defence. |
| `SEAT_CAPACITY` | Seats at your table. Defaults to 20. |
| `ADMIN_TOKEN` | Enables the CSV export at `/api/export?token=...`. Without it that URL returns 404. |

### 5. Point the domain

**Your Pages project → Custom domains → Set up a domain** → `danceforhisglory.co.za`. Repeat for `www.danceforhisglory.co.za`. Cloudflare adds the DNS records itself as long as the zone is already on your account, and issues the certificate within a few minutes.

### 6. If you already created the tables

The `bookings` table has changed shape. If you have no real submissions yet, the simplest path is to start clean:

```bash
wrangler d1 execute danceforhisglory --remote --command "DROP TABLE bookings"
wrangler d1 execute danceforhisglory --remote --file=./schema.sql
```

If you already have submissions worth keeping, add the new columns instead:

```bash
wrangler d1 execute danceforhisglory --remote --command "
ALTER TABLE bookings ADD COLUMN organisation TEXT;
ALTER TABLE bookings ADD COLUMN intent TEXT;
ALTER TABLE bookings ADD COLUMN give_when TEXT;
ALTER TABLE bookings ADD COLUMN amount_band TEXT;
ALTER TABLE bookings ADD COLUMN tax_cert TEXT;"
```

### 7. Test

```bash
wrangler pages dev            # local, at http://localhost:8788
```

Then on the live site, submit one booking with your own details and check the WhatsApp arrives.

---

## If a form says "This form is not connected yet (error 404)"

The page is live but `functions/` did not deploy. The most common cause is a drag-and-drop deployment: **the Cloudflare dashboard does not compile a functions folder.** Redeploy with Git integration or `wrangler pages deploy public`, run from the project root so Wrangler picks up `functions/`.

Confirm either way by opening `https://danceforhisglory.co.za/api/seats`. JSON means the Functions are live; a 404 page means they are not. The browser console also logs the endpoint and status for every failed submission.

Whatever the error, the message always ends with the WhatsApp number, so a donor who hits a broken form still has a way to reach you.

## If the seat counter looks wrong

The counter always draws immediately using 0 of 20, then corrects itself from `GET /api/seats`. So a counter stuck on "0 of 20 seats taken" means the endpoint is not answering.

- **Opening `index.html` straight from your computer** — expected. There is no server, so there is no `/api/seats`. Run `wrangler pages dev` instead, or check on the deployed site.
- **On the live site** — open `https://danceforhisglory.co.za/api/seats` in a browser. It should return `{"ok":true,"capacity":20,"taken":0,"remaining":20}`. A 404 means the `functions/` folder did not deploy: check that it sits at the repository root, beside `public/`, not inside it.
- **It answers but always says 0 taken** — the D1 binding is missing. Add a binding named exactly `DB` under Settings → Bindings, to Production *and* Preview, then redeploy. Without it, submissions still notify you on WhatsApp but nothing is stored, so nothing can be counted.

## Getting the list out

CSV, in a browser:

```
https://danceforhisglory.co.za/api/export?token=YOUR_ADMIN_TOKEN
https://danceforhisglory.co.za/api/export?token=YOUR_ADMIN_TOKEN&table=referrals
```

Or from the terminal:

```bash
wrangler d1 execute danceforhisglory --remote \
  --command "SELECT created_at,name,organisation,phone,intent,amount_band,give_when,seats FROM bookings ORDER BY id DESC"
```

---

## How it behaves

- The booking is written to D1 **before** the WhatsApp is attempted, and a notification failure never fails the submission. You will not lose a donor because a bot service was down.
- The couple code is fixed at `07` server-side, so a donor cannot mis-attribute their giving. The alert includes the exact EFT reference to expect (`07_VANDERMERWE`), which makes matching payments to responses quick.
- The seat counter in the hero reads live from the database, so it is never a decorative number. `GET /api/seats` returns capacity, taken and remaining.
- Capacity is enforced on the server as well as in the browser. Someone with a stale page open cannot book past 20, and a request for more seats than remain comes back with a plain message telling them how many are left rather than a generic failure. Two people submitting in the same second could in theory overshoot by a seat or two — at this volume that is a phone call, not a bug worth a transaction layer.
- When the table is full the page stops offering seats and steers people to giving without attending, which is the outcome you want anyway.
- The alert headline is **Call this one** rather than **New response** when someone picks R15 000 or more, chooses in-kind, or asks to discuss it in person. Those are the ones worth a phone call the same day rather than a WhatsApp reply.
- The browser hides the fields that do not apply, and the server ignores them too. Someone who says they cannot attend is stored with zero seats even if the hidden seat selector still held a value.
- Phone numbers are normalised to E.164 (`082 123 4567` → `+27821234567`) so they are click-to-WhatsApp ready in the export.
- A hidden honeypot field silently discards bot submissions.
- IP addresses are stored for abuse handling only. If you would rather not keep them, drop the `ip` column from `schema.sql` and the two inserts.

## Files

```
public/index.html          the page — all markup, styles and script
public/_headers            security headers
functions/api/book.js      POST /api/book
functions/api/seats.js     GET  /api/seats — live availability, and the capacity rule
functions/api/refer.js     POST /api/refer
functions/api/export.js    GET  /api/export
functions/api/_lib.js      validation, WhatsApp providers, Turnstile
schema.sql                 D1 tables
wrangler.toml              project + D1 binding
```
