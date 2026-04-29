# NUSAÉ — Bio & Linktree Structure

Goal: turn every profile-tap into either a tap-to-shop, a tap-to-WhatsApp, or a follow.

---

## 1. Instagram bio (replace current)

```
NUSAÉ
Effortless modest pieces, made simple ✿
🌍 Worldwide shipping  ·  🇸🇬🇲🇾 ships from SG/MY
↓ Shop · Sizing · WhatsApp ↓
```

**Why this works**
- Line 1: brand mark (so the Display Name reads NUSAÉ).
- Line 2: positioning in 6 words.
- Line 3: trust + ship origins (clarifies "worldwide" while keeping the SG/MY signal that local buyers want).
- Line 4: tells the eye where to go — points to the bio link below.

**Profile category** (set in IG → Edit profile → Category): **Clothing (Brand)**.
**Contact options**: turn on Email + WhatsApp. This adds the green WhatsApp button on profile.

---

## 2. Bio link — Linktree (or your own site)

Use either:
- **Option A — Your site** (recommended): `https://nusae.co` (or your chosen domain) — the static site we just built.
- **Option B — Linktree** (zero-cost backup): `linktr.ee/shopnusae` with the structure below.

### Linktree page structure

| Order | Button | Link target | Why |
|---|---|---|---|
| 1 | **🛍️ Shop Ophelia** | site `/#shop` or Stripe Payment Link | Highest-intent button at top |
| 2 | **💬 Order on WhatsApp** | `https://wa.me/65XXXX?text=Hi%20NUSAÉ%20%F0%9F%A4%8D%20I'd%20like%20to%20order` | Pre-filled message removes typing friction |
| 3 | **📏 Sizing guide** | site `/#sizing` | Self-qualification = faster orders |
| 4 | **🤍 FAQ** | site `/#faq` | Pre-empts the "is it real?" worry |
| 5 | **📦 Track my order** | tracking portal (Easyparcel, J&T, etc.) | Reduces "where's my parcel?" DMs |
| 6 | **🌟 Reviews** | highlight URL once you build it | Social proof |
| 7 | **📬 Threads** | `threads.com/@shopnusae` | Soft cross-promo, low priority |

**Linktree styling** to match brand:
- Theme: Custom
- Background: `#F5EFE6` (cream)
- Text: `#1F1A14` (ink)
- Buttons: outline style, border `#1F1A14`, fill on hover `#C9A977`
- Font: Serif (Cormorant or DM Serif Display if Cormorant unavailable)

---

## 3. WhatsApp deep-link cheatsheet

Anywhere you want a "tap to WhatsApp" button, use this URL pattern:

```
https://wa.me/<NUMBER>?text=<URL_ENCODED_MESSAGE>
```

Where `<NUMBER>` is the international format with **no +, no spaces, no dashes**.
Example for SG `+65 9123 4567`:

```
https://wa.me/6591234567?text=Hi%20NUSA%C3%89%20%F0%9F%A4%8D%20I'd%20like%20to%20order%20Ophelia
```

### Pre-filled messages worth saving

| Use case | Message text (URL-encode it) |
|---|---|
| Generic "I want to order" | `Hi NUSAÉ 🤍 I'd like to order Ophelia.` |
| Specific colour | `Hi NUSAÉ 🤍 Ophelia in [white / black / grey] please. What's available and the total?` |
| Sizing question | `Hi NUSAÉ — I'm usually a UK [size]. Will Ophelia fit?` |
| International order | `Hi NUSAÉ 🤍 I'm in [country]. Could you share the total inclusive of shipping?` |
| Restock notify | `Hi NUSAÉ 🤍 Please notify me when [piece + colour] is back in stock.` |

**Tip**: encode messages once at [urlencoder.org](https://www.urlencoder.org/) then paste into your link.

---

## 4. IG Story Highlights — restructure

Replace the current **single FAQ highlight** with these **6 covers**, in this order:

| # | Cover label | Slides inside |
|---|---|---|
| 1 | **PRICES** | One slide per piece with price + name + colour |
| 2 | **HOW TO ORDER** | 4 screenshots: choose → DM → pay → ship |
| 3 | **SIZING** | Free-size measurements, model height + size worn, fit on different body types |
| 4 | **REVIEWS** | Screenshot DMs (with permission), star reviews from buyers, repost UGC |
| 5 | **FAQ** | The current 3 slides + add: PRICING, RETURNS, PAYMENT METHODS |
| 6 | **SHIPPED** | Photos of packed orders going out — proof of activity, builds trust |

**Highlight cover style**: same cream + serif aesthetic as the FAQ card you already have. Keep all 6 visually identical so the row reads as a "store sidebar".

---

## 5. Profile housekeeping

- **Trim Following from 216 → under 100.** Unfollow accounts that aren't customers, suppliers, or peers.
- **Pin 3 posts** in this order on the grid:
  1. Best lifestyle Reel (once you make one) — emotional hook
  2. FAQ carousel — trust
  3. Welcome / brand intro post — context for newcomers
- **Profile photo**: keep the current NUSAÉ wordmark, but ensure it has a transparent or matching cream background so it doesn't clash with the gradient ring.
- **Threads**: post 2-3x weekly. Even one-line musings ("the perfect Sunday in Ophelia ✿") keep the cross-channel signal alive.
