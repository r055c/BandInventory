# Band Kit (BandInventory)

Instrument, uniform and music management for a volunteer-run youth band. An installable web app (PWA) that works on a phone, tablet or laptop, offline.

## What it does

- **Sections you choose:** Instruments, Uniforms, Music and Accessories/equipment. Switch each on or off in Settings, so a band only tracks what it needs.
- **QR codes:** every item gets a code (`INS-001`, `UNI-004`, `MUS-012`). Print labels from an item page or from Settings. Instruments get a second label for the case (`INS-001-C`) that opens the same record.
- **Scan with the phone camera:** opens the item straight away. There is a type-the-code fallback.
- **Issue and return:** who has what, since when, with which extras (case, mouthpiece, hat and so on), and the condition each way.
- **Records:** make, model, serial number, size, notes, full history, damage reports and repairs (with cost).
- **Overdue flag:** items out longer than a set number of days are flagged on Home.
- **Music library:** pieces with composer, grade, copy count and missing copies.
- **Members:** the people who borrow kit, and what each has out.
- **Settings:** band name, custom logo, sections, overdue days, usual extras, and backup/restore.

## Two ways to run it

**Local only (GitHub Pages).** The `public/` folder is plain HTML, CSS and JavaScript with no build step. Data stays in the browser on that device (use Settings → Export/Import backup to move it). The included workflow publishes `public/` on every push to `main`.

**Shared online (Cloudflare Worker + D1).** The same code, plus `worker/index.js`, runs as one Worker with its own D1 database per band. Each band gets its own address, database, settings, logo, band name and one shared admin password, and every volunteer who signs in sees the same live inventory. The app still works offline and syncs when the connection returns. The app detects which mode it is in, so there is nothing to switch.

### Add a new band

1. Create a D1 database for the band (dashboard: Storage & Databases → D1, or `npx wrangler d1 create bandkit-<slug>`). Tables are created automatically on first visit.
2. In `wrangler.jsonc`, copy the commented example under `env`, set `name` to `bandkit-<slug>` and paste the new database id.
3. Deploy it: `npx wrangler deploy --env <slug>` (or in the Cloudflare dashboard create a Workers Build from this repo with deploy command `npx wrangler deploy --env <slug>`).
4. Open the Worker's address. The first visit asks for a band name and password, and that person becomes the band's admin. Share the address and password with the volunteers.

The top-level block deploys the default `bandkit` Worker against the `bandkit-trial` database.

### Local development

```sh
npm install
npx wrangler dev        # app plus API on http://localhost:8787, with a local D1
```

Camera scanning needs HTTPS (or localhost). Open the address on a phone and use "Add to Home Screen" to install it.

## Layout

```
public/               the app (static files)
  index.html, css/, js/, vendor/, icons/, sw.js
  js/store.js         data model, local storage and cloud sync
  js/api.js, gate.js  Worker client, sign-in and first-time setup screens
worker/index.js       the API over D1 (auth, records, backup/restore)
wrangler.jsonc        Worker config, one block per band
mockups/              the original design mockups
```

Security notes: passwords are stored as PBKDF2 hashes, sessions are signed tokens that last 30 days, and changing the password signs out every other device. All band data lives only in that band's own D1 database.

## Design mockups

The original phone mockups are in `mockups/` (JPGs and clickable HTML pages).
