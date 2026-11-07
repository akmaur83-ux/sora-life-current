# SORA LIFESTYLE brand assets

Three marks, each with a job. All are transparent; none sits on a white box.

| File | Mark | Where | Notes |
|---|---|---|---|
| `sora-lifestyle-header.webp` | Two leaves + wordmark, horizontal | Header below 1100px, every store | 661x138, ~34 KB. The built-in default for `branding.logoUrl` (`src/lib/settings.js`); an upload in Admin → Branding overrides both header files. |
| `sora-lifestyle-header-stacked.webp` | Two leaves above the wordmark | Header from 1100px | 244x162, ~18 KB. From 1100px the store links share the bar, which never grows past ~1190px, so the centre column has ~80px; the stacked mark fits it at 54px tall. Swapped in by a `<picture>` source in `Logo.jsx`, only while the built-in logo is in use. |
| `sora-lifestyle-footer.webp` | Sea-buckthorn branch, stacked, cream lettering | Footer (`src/components/Footer.jsx`) | For the dark footer only — the lettering is cream. |
| `sora-lifestyle-invoice.webp` | Himalayan sun and mountains, stacked | Invoice and Purchase Passport | Dark lettering, for light paper. 4x its on-page size so it prints crisp. |
| `favicon-32.png`, `favicon-192.png` | The two leaves on a cream tile | Browser tab (`index.html`) | The tile keeps the dark-green leaf visible on dark tab strips. |
| `apple-touch-icon.png` | Same, opaque | iOS home screen | iOS fills transparency with black, so this one is opaque. |

`sora-life-logo.png` is the previous sparrow mark, kept so old links to it still resolve.

Files under `/assets/` are cached by browsers for 7 days (`vercel.json`). To change a
mark, add it under a **new filename** and point the code at it; overwriting a file in
place leaves returning visitors on the old one for up to a week.
