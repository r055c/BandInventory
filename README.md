# BandInventory

Instrument management for a volunteer-run youth band: QR codes on every instrument and case, a phone app to scan them, and a record of who has what, instrument details, repairs and accessories.

## Status

Design mockups only, with sample data. No application code yet.

## Mockups

Seven phone screens in `mockups/`:

| Screen | Image | Page |
| --- | --- | --- |
| Home | `images/1-home.jpg` | `html/1-home.html` |
| Scan QR | `images/2-scan.jpg` | `html/2-scan.html` |
| Instrument record | `images/3-instrument-record.jpg` | `html/3-instrument-record.html` |
| Issue to member | `images/4-issue-to-member.jpg` | `html/4-issue-to-member.html` |
| Uniforms | `images/5-uniforms.jpg` | `html/5-uniforms.html` |
| Music | `images/6-music.jpg` | `html/6-music.html` |
| Settings | `images/7-settings.jpg` | `html/7-settings.html` |

Sections (Instruments, Uniforms, Music, and optional Accessories and equipment) can each be switched on or off in Settings, which also holds the band name and logo.

The HTML pages are standalone and link to each other, so you can open `1-home.html` in a browser and click through. They are sized for a 390×844 phone screen.
