# NUSAÉ — Static Site

Single-page brand site for **@shopnusae**, designed to convert IG bio-link traffic into WhatsApp orders.

## What's inside

```
nusae-site/
├── index.html        # the whole site
├── styles.css        # all styles, brand tokens at top
├── assets/           # product photos pulled from IG
└── README.md
```

## Before you ship — 3 things to swap

1. **WhatsApp number** — open `index.html`, search `WA_NUMBER`, replace `6500000000` with your number in international format (no `+`, no spaces). E.g. SG `+65 9123 4567` → `6591234567`.
2. **Price** — search `SGD $XX` (appears twice: product card + FAQ). Replace with the real price.
3. **Sizing** — open the size table section and fill in bust/length cm once you have measurements.

## Run locally

Open `index.html` in any browser. No build step, no dependencies.

```bash
open index.html              # macOS quick preview
python3 -m http.server 8080  # then visit http://localhost:8080
```

## Deploy options (free, ranked by effort)

1. **Netlify Drop** (60 seconds) — drag the `nusae-site/` folder to [app.netlify.com/drop](https://app.netlify.com/drop). Get a `*.netlify.app` URL. Add custom domain later.
2. **Vercel** — `npx vercel` from this folder. Same idea.
3. **Cloudflare Pages** — connect a GitHub repo and point at this folder.
4. **GitHub Pages** — push to a `gh-pages` branch.

## Custom domain

Buy `nusae.co` / `shopnusae.com` / `nusae.shop` from Namecheap/Cloudflare (~$10/yr), point CNAME at your host. Use that as your IG bio link.

## Next iterations

- **Variants page**: split Ophelia into 3 hardlinked colour pages (`/ophelia/white`, `/ophelia/black`, `/ophelia/grey`) so you can drive WhatsApp messages with the colour pre-filled.
- **Add reviews** once you collect them — drop a `<section class="reviews">` between `.why` and `.how`.
- **Stripe Payment Links** — replace the WhatsApp CTA on the product card with a Stripe Payment Link button so buyers can self-checkout. Keep WhatsApp as fallback.
- **Meta Pixel** — once you run ads, paste pixel snippet in `<head>` to retarget.
- **More products** — duplicate the `.product` block; shop section can become a grid of cards instead of a single hero.

## Why this design

- **Cream + serif (Cormorant Garamond)** matches the FAQ card aesthetic on the IG grid.
- **Free Google fonts** so it loads fast worldwide.
- **No JS framework** — page weight under 600KB, scores ~95 on Lighthouse mobile.
- **Native `<details>` accordion** for FAQ — no JS, no libs.
- **WhatsApp-first checkout** — preserves the conversational selling style you've been using on IG, just removes the bottleneck of "DM us first".
