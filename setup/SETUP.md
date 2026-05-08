# NUSAÉ HitPay checkout — setup steps

The Cloudflare Pages site, Functions, form, and webhook handler are all deployed.
There are 3 steps remaining before the live checkout flow works end-to-end.

## 1. Complete HitPay business verification (BLOCKING)

Current status: HitPay API returns
> "This store is not yet verified to accept online orders. Please check again later."

Action: log into the HitPay dashboard (affy@autolabclick.com) → complete the
**Business Verification** flow under *Settings → Business Profile* (NRIC / business
registration / bank account). Cards + PayNow online activation typically takes 3-5
business days after document submission.

You can confirm activation by re-running:
```bash
curl -s -X POST "https://shopnusae.com/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com",
       "contact":"+6591234567","address":"Test addr","items":[{"colour":"white","qty":1}]}'
```
When verified, the response will return `{"url":"https://securecheckout.hitpayapp.com/..."}`
instead of the forbidden error.

## 2. Deploy the Google Apps Script handler

The site logs orders to a Google Sheet and emails Natalia via a Google Apps Script
web app. The script source is at `setup/apps-script.gs`. To deploy:

1. Go to https://script.google.com → New project
2. Replace the default code with the contents of `setup/apps-script.gs`
3. Edit the `SHARED_SECRET` field — set to a long random string (e.g. run
   `openssl rand -hex 32` and paste the output). Save the same string to give to
   the agent for the Cloudflare side.
4. Click **Deploy → New deployment** → Type: *Web app*
   - Description: `NUSAÉ orders handler`
   - Execute as: **Me** (affy@autolabclick.com)
   - Who has access: **Anyone**
5. Authorize when prompted (it needs Sheets + Mail scopes)
6. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfyc.../exec`)

Hand both values back so they can be set as Cloudflare secrets:
```bash
printf 'PASTE_WEB_APP_URL'   | npx wrangler pages secret put GAS_WEBHOOK_URL   --project-name=nusae
printf 'PASTE_SHARED_SECRET' | npx wrangler pages secret put GAS_SHARED_SECRET --project-name=nusae
npx wrangler pages deploy . --project-name=nusae --branch=main --commit-dirty=true
```

## 3. Register the webhook URL on HitPay

In the HitPay dashboard → **Developers → Webhook Endpoints** → add:
```
https://shopnusae.com/api/hitpay-webhook
```
Make sure the Salt shown there matches the value already saved as `HITPAY_SALT`
on Cloudflare. If HitPay rotates the salt, run:
```bash
printf 'NEW_SALT' | npx wrangler pages secret put HITPAY_SALT --project-name=nusae
```
…then redeploy.

## Sanity-check end-to-end

After all 3 steps:
1. Visit https://shopnusae.com → click **Order & Pay Now**
2. Fill in the form with a real test order
3. Click *Continue to payment* → should redirect to HitPay's hosted checkout
4. Pay (try a $35 PayNow charge — refund yourself afterwards in HitPay dashboard)
5. Land on `/thank-you?order=NUS-...` — order ID should display
6. Within ~30 seconds:
   - Order row appears in the **NUSAÉ Orders** Google Sheet (status = Paid)
   - Email arrives at `nataliarazali@gmail.com` (cc `affy@autolabclick.com`)

## Files & where they live

- `index.html` — order modal + checkout JS
- `styles.css` — modal/form styles
- `thank-you.html` — post-payment page
- `functions/api/checkout.js` — creates HitPay payment-request, logs order
- `functions/api/hitpay-webhook.js` — verifies HMAC + notifies Apps Script
- `setup/apps-script.gs` — Apps Script source for sheet+email
- Cloudflare Pages secrets in use: `HITPAY_API_KEY`, `HITPAY_SALT`, `GAS_WEBHOOK_URL`, `GAS_SHARED_SECRET`
- Sheet: `NUSAÉ Orders` (ID `1gpsl31zsZSPRppM0M3FuDtDZibEd6es_txJo3-PFdt8`)
