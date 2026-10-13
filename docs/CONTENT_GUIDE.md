# Content guide

Everything a visitor reads comes from **one file**: `src/content/business.ts`.
You don't need to touch any component to change text, numbers, hours or links.

## Placeholders

Any value written like `{{PHONE}}` is a placeholder:

- it shows on the page **highlighted in gold**, so it can't go live unnoticed;
- it is automatically **left out** of Google's structured data (JSON-LD) and links (no broken `tel:`);
- `npm run build` prints a `NOTICE` listing every placeholder still on the page.

Replace each one with the real value (keep the quotes):

```ts
phoneDisplay: '+91 98765 43210',
phoneE164: '+919876543210',   // digits only, with country code
whatsapp: '919876543210',     // digits only, no '+'
```

## Field reference

| Field | Shown where | Notes |
|---|---|---|
| `tagline` | Hero, under the name | One short line. |
| `doctorCredentials` | About card | e.g. degrees, registration. Only verifiable facts. |
| `phoneDisplay` / `phoneE164` | Call buttons, contact | Both must be filled for the Call button to dial. |
| `whatsapp` | WhatsApp buttons | Opens `wa.me` with a pre-filled "book an appointment" message. |
| `email` | Structured data | Not shown on the page. |
| `address.*` | Location section, footer, Google data | `country` is `IN`. |
| `geo`, `mapsUrl` | Map + "Get directions" | Already set from the hospital's Google Maps listing. |
| `hours` | Location + footer | `label` / `time` are shown. Add `schema` to also publish hours to Google, e.g. `schema: { days: ['Monday','Tuesday'], opens: '09:00', closes: '19:00' }`. |
| `about` | About section | One string per paragraph. |
| `services` | Services cards | Title + one-sentence description. **No prices** unless the hospital wants them published. |
| `facts` | "Why choose us" | Use `value: 15, suffix: '+'` for an animated number, or `text: '…'` for words. **Only real, verifiable facts.** |
| `socials` | Footer | Full URLs. |

## Photos

1. Put JPG / PNG / WebP files in `assets-src/images/` (largest size you have; they're resized automatically).
2. Add a description for **every** photo to `assets-src/images/alt.json` — the build stops if one is missing:

   ```json
   {
     "reception.jpg": "Reception desk at Drishti Eye Hospital",
     "exam-room.jpg": "Eye examination room with slit lamp"
   }
   ```
3. Run `npm run build`. Photos become AVIF + WebP at 480 / 960 / 1600 px and appear in the Gallery in
   file-name order (prefix names with `01-`, `02-` … to control order).

Photos of patients need their written consent.

## Medical content rules

- No outcome guarantees ("100% success", "painless", "permanent cure").
- No testimonials, ratings, review counts or patient numbers unless supplied and verifiable.
- Keep the disclaimer lines (Services section and footer) and the emergency note in Contact.

## After editing

```bash
npm run build      # must end with "verify-dist: all checks passed"
npm run preview    # check it at http://localhost:4173
```

Push to `main` — CI re-runs every check, and (once the repo is connected) Netlify redeploys.
