# Setup guide — danceforhisglory.co.za

Written for where you actually are. No command line anywhere in it.

## Already done

- ✅ Cloudflare account, with danceforhisglory.co.za added to it
- ✅ D1 database `danceforhisglory` created
- ✅ Both tables created — `bookings` and `referrals` confirmed present

## Still to do

**Part 1 — get the site working** (about 45 minutes). Steps 1 to 9. Ends with a fully working site on a `.pages.dev` address that you can test properly.

**Part 2 — put your domain on it** (ten minutes plus a wait). Steps 10 to 15.

Do Part 1 first. Fixing the domain first would leave you with a well-named page whose buttons still do nothing.

---

# Part 1 — Get the site working

## Step 1. Delete the old Pages project

If a `danceforhisglory` project still exists under **Workers & Pages**, delete it: open it → **Settings** → scroll to the bottom → **Delete project**.

Nothing real is stored in it, and deleting frees up the `danceforhisglory.pages.dev` name. A project created by dragging files in cannot be converted to a Git-connected one, so starting fresh is the right call rather than a workaround.

Leave the D1 database alone — that stays.

## Step 2. Create the GitHub repository

You already have the GitHub account `MertsConexx`. Signed in there:

1. Click the **+** top right → **New repository**
2. Name it `danceforhisglory`
3. Public or Private, either works
4. Do **not** tick "Add a README file" — you want it empty
5. **Create repository**

## Step 3. Upload the project files

On the empty repository page, click the **uploading an existing file** link.

Open your project folder, select these four items, and drag them onto the page:

```
public
functions
schema.sql
README.md
```

Dragged folders keep their structure. Scroll down and click **Commit changes**.

**Check this before moving on.** The repository should list `functions`, `public`, `README.md` and `schema.sql`. Click into `functions` — you should see `api`, and inside it five `.js` files.

If `functions` is missing, or ended up inside `public`, delete the repository and redo this step. That structure is the single reason your forms returned 404 last time.

## Step 4. Create the Pages project

**Workers & Pages** → **Create**.

Cloudflare pushes you towards its newer Workers app builder. **Do not use it.** Find the line "Need to use the legacy Pages workflow?" and click **Continue to Pages**, then **Connect to Git**.

This matters. The project is built the Pages way, where every file in `functions/api/` automatically becomes an endpoint. Workers uses a single entry point instead, so building it there means `/api/book` and `/api/seats` never exist and you are back to 404.

Pick the `danceforhisglory` repository. If it does not appear, GitHub granted Cloudflare access to selected repositories only — add this one in your GitHub settings.

Build settings:

- **Framework preset:** None
- **Build command:** leave completely empty
- **Build output directory:** `public`

**Save and Deploy.** You get a URL ending in `.pages.dev`.

## Step 5. Connect the database

In the new project: **Settings** → **Bindings** → **Add** → **D1 database**.

- Variable name: `DB` — exactly that, capitals, nothing else
- Database: `danceforhisglory`

Add it to **both Production and Preview**.

This one trips people up badly. With the binding missing, the form succeeds, the WhatsApp still arrives, and everything looks right — but nothing is saved and the seat counter never moves. You would only find out when you went looking for the list of who is coming.

## Step 6. Set up the WhatsApp notification

First, on the phone that will receive the alerts (+27 78 174 0616):

1. Save `+34 621 331 709` as a contact
2. Send it exactly this on WhatsApp: `I allow callmebot to send me messages`
3. It replies with an API key — keep that message

Then in **Settings** → **Variables and secrets**, add:

| Name | Value | Type |
|---|---|---|
| `WA_PROVIDER` | `callmebot` | Text |
| `WA_TO` | `+27781740616` | Text |
| `CALLMEBOT_APIKEY` | the key from step 3 | **Secret** |

Set the last as Secret, not Text, so the key stays hidden afterwards.

For a table other than 20 seats, add `SEAT_CAPACITY` as Text with your number.

## Step 7. Redeploy

Settings only apply to deployments made *after* they were added, so it needs to build once more.

**Deployments** tab → the most recent deployment → **⋯** menu → **Retry deployment**.

## Step 8. Test it

Open your `.pages.dev` URL with `/api/seats` on the end. You want:

```
{"ok":true,"capacity":20,"taken":0,"remaining":20}
```

That one line confirms the back end is live *and* the database is connected. A "page not found" means the `functions` folder is not where it should be — back to Step 3.

Then on the site itself:

1. The hero should read "0 of 20 seats at our table are taken"
2. Fill in the booking form with your own name and number, choose 2 seats, submit
3. You should get the thank-you message, not a red error
4. Check the WhatsApp arrives
5. Reload — the counter should now read "2 of 20 seats are taken"
6. Try the "Suggest someone" tab too

If anything fails, the red message names the actual error code. The table at the end of this guide says what each one means.

## Step 9. Clear your test data

In the D1 console, run these two, one at a time:

```sql
DELETE FROM bookings;
```

```sql
DELETE FROM referrals;
```

The counter returns to 0 of 20. Do this before sending the link to anyone.

> **Note on the D1 console:** it runs one statement per click. If you paste several and it says "Executed 1/1", only the first ran.

---

# Part 2 — Point your domain at it

Only start once Part 1 works.

## Step 10. Clear out the old Axxess records

The domain currently points at Axxess web hosting and Axxess mail. You are keeping neither.

Open danceforhisglory.co.za → **DNS** → **Records** in Cloudflare. When the domain was added, Cloudflare scanned the existing setup and may have imported records automatically.

**Delete any of these that are there:**

- A records for `danceforhisglory.co.za`, `www` or `ftp` pointing to `156.155.252.96` — that is the Axxess web server. Leaving them means your domain keeps serving Axxess instead of your landing page. Pages creates its own records for the root and www in Step 14.
- The MX record, and the A record for `mail`
- The TXT record starting `v=spf1` — it only authorises the Axxess mail server

An empty record list at this point is correct.

**One thing to be sure of first:** once the nameservers change, mail to any `@danceforhisglory.co.za` address stops working. You have said you do not want the Axxess mailbox, so this is fine — just confirm that address has not been printed anywhere or given to the academy.

If you want email on this domain later, use Google Workspace, Microsoft 365 or Zoho and add their MX records to Cloudflare. Do not go back to the Axxess mailbox.

## Step 11. Turn off DNSSEC at Axxess

In the Axxess Control Panel, find the DNSSEC setting for this domain. If it is on, turn it off before touching anything else.

This is the one that does real damage. Changing nameservers with DNSSEC still enabled does not leave the domain pending — it stops the domain resolving at all, and it looks like a dead website rather than a settings problem. You can re-enable it through Cloudflare later.

## Step 12. Replace the nameservers

Still at Axxess, find the nameserver settings for the domain. Remove the existing entries and replace them with only these two:

```
carl.ns.cloudflare.com
carla.ns.cloudflare.com
```

**Delete the old ones — do not add Cloudflare's alongside.** Leaving both is the usual reason a domain sits on "Invalid nameservers" indefinitely.

If there is no nameserver field, log a ticket with Axxess hosting support asking them to set the NS records for danceforhisglory.co.za to those two. For .co.za domains this is sometimes only done on their side.

## Step 13. Wait, then check

In Cloudflare, open danceforhisglory.co.za and click **Check nameservers now**.

For .co.za this usually takes a few hours. Cloudflare rechecks on its own anyway; the button just prompts it sooner. Give it until the next day before assuming something is wrong.

When it works, the status changes from "Invalid nameservers" to **Active** and you get an email.

## Step 14. Attach the domain

Only once the status reads **Active**.

**Workers & Pages** → danceforhisglory → **Custom domains** → **Set up a domain**.

Add `danceforhisglory.co.za`, then repeat for `www.danceforhisglory.co.za`. Cloudflare creates the DNS records and issues the certificate itself, usually within minutes.

## Step 15. Final check

Open `https://danceforhisglory.co.za` — the page should load with a padlock in the address bar.

Check `/api/seats` returns the JSON, submit one last test booking, confirm the WhatsApp arrives, then clear the test data as in Step 9.

---

# Living with it

## Changing wording

This is the payoff for using GitHub.

1. Repository → `public` → `index.html`
2. Click the pencil icon
3. Edit, scroll down, **Commit changes**

Cloudflare rebuilds automatically and the change is live in about a minute. Every version is kept, so a mistake can be undone.

## Getting your donor list

Add `ADMIN_TOKEN` as a **Secret** under Variables and secrets, with any long random phrase as its value, then redeploy. Open:

```
https://danceforhisglory.co.za/api/export?token=YOUR_TOKEN
https://danceforhisglory.co.za/api/export?token=YOUR_TOKEN&table=referrals
```

Each downloads a spreadsheet you can open in Excel. Keep that token private — anyone with the link can read your donor list.

You can also read the data any time in the D1 console:

```sql
SELECT created_at, name, organisation, phone, intent, amount_band, seats FROM bookings ORDER BY id DESC;
```

## If something breaks

| What you see | What it means |
|---|---|
| "This form is not connected yet (error 404)" | `functions` is missing from the repository, or nested inside `public`. See Step 3. |
| Forms work but the counter stays at 0 | The `DB` binding is missing, or was added after the last deployment. Add it, then redeploy. |
| "The server had a problem (error 500)" | The tables are missing. Re-run the SQL in the appendix. |
| No WhatsApp arriving | Check all three variables from Step 6 are set and that you redeployed afterwards. Submissions are still saved — check with the export URL. |
| Build fails in Cloudflare | Check the build command is completely empty and the output directory is `public`. |
| The domain shows an Axxess page, not yours | Old A records pointing to `156.155.252.96` still in Cloudflare's DNS. See Step 10. |
| Domain stuck on "Invalid nameservers" after 48 hours | Old nameservers left alongside Cloudflare's, or DNSSEC still on. |

## Appendix — rebuilding the database

You should not need this, but if the tables are ever lost, run these four in the D1 console **one at a time**.

```sql
CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  organisation TEXT,
  intent       TEXT,
  seats        INTEGER NOT NULL DEFAULT 0,
  give_when    TEXT,
  amount_band  TEXT,
  tax_cert     TEXT,
  couple_code  TEXT,
  dietary      TEXT,
  message      TEXT,
  ip           TEXT,
  user_agent   TEXT
);
```

```sql
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
```

```sql
CREATE TABLE IF NOT EXISTS referrals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at     TEXT NOT NULL,
  referrer_name  TEXT NOT NULL,
  referrer_phone TEXT,
  prospect_name  TEXT NOT NULL,
  prospect_phone TEXT,
  prospect_email TEXT,
  prospect_type  TEXT,
  context        TEXT,
  use_name       TEXT,
  ip             TEXT
);
```

```sql
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at);
```

`README.md` has the reference detail: alternative WhatsApp providers, every setting you can change, and how the code behaves.
