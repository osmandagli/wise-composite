# Wise Composite web sitesi

Corporate site for Wise Composite (BMC/SMC composite parts manufacturer, Sincan/Ankara).
All visitor-facing text is Turkish. Code comments in this repo are Turkish too; keep that style.

## Architecture

- Plain static HTML/CSS/JS, no build step: `index.html`, `hakkimizda.html`, `kara-araclari.html`,
  `rayli-sistemler.html`, `ozel-projeler.html`, `iletisim.html`, `admin.html`. Shared styles in
  `assets/css/site.css`, shared JS in `assets/js/site.js`. Header/footer/WhatsApp button are
  duplicated in every page; change all pages together.
- Hosted on **Cloudflare Workers** (static assets + a small Worker), deployed by Cloudflare's Git
  integration on every push to `main` (`npx wrangler deploy`). Config: `wrangler.jsonc`.
- No own domain yet: the site runs on `wise-composite.<account>.workers.dev`. `og:url` meta tags
  still point to the old `wisecomposite.duckdns.org` address; update them once a domain exists.
- `.assetsignore` keeps non-public files (worker code, config, `content.md`, `photos/`, this file)
  off the website. Add new private files there.
- The Worker only runs for `/api/*` (`run_worker_first`); everything else is served as static files.
  - `worker/index.js`: router
  - `worker/iletisim.js`: contact form, `POST /api/iletisim` (Turnstile check, then email via Resend)
  - `worker/urunler.js`: public catalog `GET /api/urunler?kategori=…` and photos `GET /api/gorsel/:id`
  - `worker/admin.js`: admin API `/api/admin/*` (password login, add/edit/delete parts)
  - `worker/ortak.js`: helpers and D1 schema (tables are created on first request, no migrations)
- Parts live in **Cloudflare D1** (database `wise-composite`, binding `DB`), photos as BLOBs in the
  same table (the admin page shrinks them to max 1200 px JPEG before upload). There is no
  `database_id` in `wrangler.jsonc` on purpose: wrangler ≥ 4.45 creates and links the database on
  the first deploy. Don't add a static parts list back; the catalog pages read from `/api/urunler`.

## Admin panel (for the owner's mother, keep it simple)

- URL: `/admin` (not linked from the site, `noindex`). One password = `ADMIN_PASSWORD` secret.
  Session lasts 30 days; changing the password logs everyone out. 10 wrong passwords per IP in
  15 minutes lock login for 15 minutes.
- Part fields: page (Kara Araçları / Raylı Sistemler), name (required), and for Kara Araçları also
  brand (MAN / Mercedes-Benz / other), compatible models (each becomes a blue tag, e.g. 1840, 3240),
  several OEM numbers (they differ by country), product code. Raylı Sistemler: name + OEM only.
  Photo optional. No "model" field and no "Teklif İsteyin" link on part cards (client decision).
- UI rules: plain Turkish, big buttons, no jargon, confirm before delete, show a success message.

## One-time setup still needed (owner does this in the Cloudflare / Resend dashboards)

Secrets go to Cloudflare → Workers & Pages → wise-composite → Settings → Variables and Secrets
(type **Secret**). Without them the site works but the form/admin answer "not configured".
Pitfall: Settings → **Builds** also has a "Variables and secrets" box; those are build-time only
and invisible to the running Worker. Use the runtime one (near Bindings), not the Builds one.

1. **Admin password**: add secret `ADMIN_PASSWORD` (a long password). Then open `/admin`.
2. **Turnstile (form CAPTCHA)**: Cloudflare → Turnstile → Add widget; hostname = the
   `….workers.dev` address (and later the real domain). Done: Site Key `0x4AAAAAAFYsLYNzzBbYDz-2`
   is in `iletisim.html` (`data-sitekey`). The **Secret Key** must be added as secret
   `TURNSTILE_SECRET_KEY`.
3. **Resend (email delivery)**: create the Resend account **with info@wisecomposite.com.tr**.
   (Oct 2026: the owner has no access to that mailbox yet. Until then the Resend account can use
   another address the owner controls, with `MAIL_TO` temporarily set to that same address.)
   Without a verified domain Resend can only send from `onboarding@resend.dev` to the account's own
   address, which is exactly where form mail must go (`MAIL_TO` in `wrangler.jsonc`). Create an API
   key and add it as secret `RESEND_API_KEY`.
4. **Database**: nothing to do; created automatically on deploy. To inspect it:
   Cloudflare → Storage & Databases → D1 → wise-composite.

### When a domain is bought later

- Workers → wise-composite → Domains → add `wisecomposite.com.tr` (domain must be on Cloudflare).
- Add that hostname to the Turnstile widget.
- Verify the domain in Resend (DNS records), then change `MAIL_FROM` in `wrangler.jsonc` to e.g.
  `Wise Composite Web <web@wisecomposite.com.tr>`.
- Update `og:url` / `og:image` URLs in every page's `<head>`.

## Content decisions (client instructions, Oct 2026)

- Phone: **0540 308 10 10** (`tel:+905403081010`). WhatsApp button on every page → `wa.me/905403081010`.
- Email: info@wisecomposite.com.tr. Hours: Hafta içi 08.00–18.00, Cumartesi–Pazar kapalı.
- No breadcrumbs. No "01 —/02 —/03 —" numbering on page eyebrows.
- Calls to action say **"Bize Ulaşın"** and link to `iletisim.html#iletisim-formu`; no "Teklif İsteyin"
  wording anywhere. No duplicate CTA button in the header (the "İletişim" menu item is enough).
- No "Kalite ve Belgeler" section or footer link (no certificates yet), no "Ekibimiz" section.
- Ana Sayfa "Referanslar" section is commented out in `index.html` until the client sends customer logos.
- Figures on Ana Sayfa and Hakkımızda (illustrative): founded 2024, 4.000 m² indoor, 25 employees, 45 projects.
- No "Presli Seri Üretim • Boya & Yüzey İşlemleri • Kalite Kontrol • Sevkiyat" strip on any page.
- Yellow `.todo` markers and the draft bar at the top of each page mark content still to be supplied
  (KVKK text, trade name/MERSİS, founder quote, photos). Remove the draft bar before the official launch.

## Bulk import from Excel

The first 43 Kara Araçları parts (Mercedes-Benz, MAN, Ford, Isuzu) were loaded on 2026-10-16 from the
client's `oem_listesi.xlsx` with `araclar/excel_iceaktar.py`. Pictures in such files are floating
images anchored to the row (some webp/jfif, which openpyxl ignores), so the script reads them from the
xlsx zip directly. Photos are cut to ≤45 KB JPEG because one D1 SQL statement may not exceed 100 KB.
Spreadsheets contain prices: never commit them (`*.xlsx` is git- and asset-ignored) and never show prices.

```
python araclar/excel_iceaktar.py liste.xlsx /tmp/import.sql      # check the printed table first
npx wrangler d1 execute DB --local --file /tmp/import.sql         # test with `wrangler dev`
CLOUDFLARE_ACCOUNT_ID=e5d69f07bbbe43dcf72eae7e716aab70 npx wrangler d1 execute wise-composite --remote --file /tmp/import.sql
```
Check the live table for duplicates before importing. Wrangler login under WSL: the browser callback
from `wrangler login` may not reach WSL; logging in from a normal terminal works. The OAuth token
lacks `account:read`, so always pass `CLOUDFLARE_ACCOUNT_ID` (above).

## Working locally

```
printf 'ADMIN_PASSWORD=test\nTURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA\nRESEND_API_KEY=re_test\n' > .dev.vars
npx wrangler dev        # http://localhost:8787, local D1 in .wrangler/ (both git-ignored)
```
The Turnstile secret above is Cloudflare's always-pass test key. Email sending fails locally
without a real Resend key; everything else works.
