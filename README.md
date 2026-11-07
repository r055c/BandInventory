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

## Running it

It is plain HTML, CSS and JavaScript with no build step.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Camera scanning needs HTTPS (or localhost), so for real use put it on any static host. A GitHub Pages workflow is included: in the repo go to **Settings → Pages → Build and deployment → Source: GitHub Actions**, then every push to `main` publishes the app. Open the published address on a phone and use "Add to Home Screen" to install it.

## Where the data lives

Everything is stored in the browser on the device in use (`localStorage`). That keeps it free and private, but it means:

- Each device has its own copy. Use **Settings → Export backup** and **Import backup** to move data between devices.
- Clearing browser data erases it. Export a backup regularly.

If the band wants several volunteers sharing live data, the next step is a small shared backend (for example Supabase). All data access goes through `js/store.js`, so that is the one file to change.

## Layout

```
index.html            app shell
css/styles.css        styles
js/app.js             router
js/views.js           every screen
js/store.js           data model and storage
js/ui.js, util.js     shared helpers, dialogs, icons
vendor/               qrcode-generator (MIT) and jsQR (Apache-2.0)
sw.js                 offline cache
mockups/              the original design mockups
```

## Design mockups

The original phone mockups are in `mockups/` (JPGs and clickable HTML pages).
