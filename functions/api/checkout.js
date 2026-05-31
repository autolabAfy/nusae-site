// POST /api/checkout
// Receives order form, creates HitPay payment-request, logs order to Sheet via Apps Script.
// Returns { url, id } so the browser can redirect to HitPay's hosted checkout.

const PRICE_SGD = 47;
const HITPAY_ENDPOINT = 'https://api.hit-pay.com/v1/payment-requests';
const ALLOWED_COLOURS = new Set(['white', 'beige', 'grey', 'black']);

// Shipping is free to both Singapore and Malaysia. To re-introduce a Malaysia
// fee later, set MY_SHIPPING_MYR back to a positive number (keep it in sync with index.html).
// MYR_PER_SGD is still used for the RM price estimate shown to Malaysian buyers.
const ALLOWED_COUNTRIES = new Set(['SG', 'MY']);
const MYR_PER_SGD = 3.30;            // approximate FX, used for the RM estimate
const MY_SHIPPING_MYR = 0;           // free shipping to Malaysia
const MY_SHIPPING_SGD = +(MY_SHIPPING_MYR / MYR_PER_SGD).toFixed(2);

function shippingSgd(country) {
  return country === 'MY' ? MY_SHIPPING_SGD : 0;
}

export async function onRequestPost(context) {
  try {
    return await handle(context);
  } catch (err) {
    return json({ error: 'Server error', message: String(err && err.message || err), stack: String(err && err.stack || '') }, 500);
  }
}

async function handle({ request, env }) {
  if (!env.HITPAY_API_KEY) return json({ error: 'Missing HITPAY_API_KEY env var' }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const v = validate(payload);
  if (v.error) return json({ error: v.error }, 400);

  const { firstName, lastName, email, contact, country, address, items, discountCode } = v.clean;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const subtotalSgd = totalQty * PRICE_SGD;
  const shippingSgdAmount = shippingSgd(country);

  // Validate discount code, if provided. Stored in KV by /api/popup-signup.
  let discount = null;
  if (discountCode) {
    if (!env.DISCOUNT_CODES) return json({ error: 'Discount system unavailable, please try without code' }, 500);
    const raw = await env.DISCOUNT_CODES.get(`code:${discountCode}`);
    if (!raw) return json({ error: 'Discount code not recognised' }, 400);
    let rec;
    try { rec = JSON.parse(raw); } catch (_) { return json({ error: 'Discount code invalid' }, 400); }
    if (rec.used) return json({ error: 'This discount code has already been used' }, 400);
    const percent = Number(rec.percent) || 15;
    discount = { code: discountCode, percent, record: rec };
  }
  const goodsSgd = discount
    ? +(subtotalSgd * (1 - discount.percent / 100)).toFixed(2)
    : subtotalSgd;
  const totalSgd = +(goodsSgd + shippingSgdAmount).toFixed(2);

  const orderId = newOrderId();
  const itemsSummary = items.map(i => `${i.colour} x ${i.qty}`).join(', ');
  const purposeSuffix = discount ? ` (${discount.percent}% off, ${discount.code})` : '';

  const origin = new URL(request.url).origin;

  // PayNow is Singapore-only; Malaysian buyers pay by card (Apple Pay / Google Pay
  // appear automatically through the card option on HitPay's hosted page).
  const paymentMethods = country === 'SG' ? ['paynow_online', 'card'] : ['card'];

  const hitpayBody = {
    amount: totalSgd.toFixed(2),
    currency: 'SGD',
    email,
    name: `${firstName} ${lastName}`.trim(),
    phone: contact,
    purpose: `NUSAE Ophelia - ${itemsSummary}${purposeSuffix} [${country}]`,
    reference_number: orderId,
    payment_methods: paymentMethods,
    redirect_url: `${origin}/thank-you?order=${encodeURIComponent(orderId)}`,
    webhook: `${origin}/api/hitpay-webhook`,
    send_email: true
  };

  let hitpayRes, hitpayText;
  try {
    hitpayRes = await fetch(HITPAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-BUSINESS-API-KEY': env.HITPAY_API_KEY
      },
      body: JSON.stringify(hitpayBody)
    });
    hitpayText = await hitpayRes.text();
  } catch (err) {
    return json({ error: 'Payment provider unreachable', message: String(err && err.message || err) }, 400);
  }

  let hitpay;
  try { hitpay = JSON.parse(hitpayText); } catch (_) { hitpay = {}; }
  if (!hitpayRes.ok || !hitpay.url) {
    // Return 400 (not 5xx) so Cloudflare doesn't replace the body with a generic edge error.
    const friendly = hitpay && (hitpay.error_message || hitpay.message)
      || 'Could not start payment — please try again or contact us.';
    return json({
      error: friendly,
      hitpay_status: hitpayRes.status,
      detail: hitpay
    }, 400);
  }

  // Mark the discount code as used now that the payment request is created.
  // If the user abandons checkout, the code is still burned — acceptable for this funnel.
  if (discount) {
    try {
      await env.DISCOUNT_CODES.put(`code:${discount.code}`, JSON.stringify({
        ...discount.record,
        used: true,
        usedAt: new Date().toISOString(),
        orderId
      }));
    } catch (_) { /* don't block payment on KV write failure */ }
  }

  // Log the order to the sheet (best-effort; don't block payment if this fails)
  if (env.GAS_WEBHOOK_URL) {
    const orderForSheet = {
      order_id: orderId,
      first_name: firstName,
      last_name: lastName,
      email,
      contact,
      country,
      address,
      items,
      subtotal_sgd: subtotalSgd,
      discount_code: discount ? discount.code : '',
      discount_percent: discount ? discount.percent : 0,
      shipping_sgd: shippingSgdAmount,
      shipping_myr: country === 'MY' ? MY_SHIPPING_MYR : 0,
      total_sgd: totalSgd,
      payment_url: hitpay.url,
      payment_request_id: hitpay.id
    };
    // Fire-and-forget but await so Cloudflare doesn't kill it on response
    try {
      await fetch(env.GAS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.GAS_SHARED_SECRET,
          event: 'order_created',
          order: orderForSheet
        })
      });
    } catch (_) { /* swallow — payment URL still returned */ }
  }

  return json({ url: hitpay.url, id: hitpay.id, order_id: orderId });
}

function validate(p) {
  if (!p || typeof p !== 'object') return { error: 'Empty body' };
  const firstName = str(p.firstName, 60);
  const lastName  = str(p.lastName, 60);
  const email     = str(p.email, 120);
  const contact   = str(p.contact, 30);
  const country   = str(p.country, 2).toUpperCase() || 'SG';
  const address   = str(p.address, 500);
  if (!firstName || !lastName)  return { error: 'Name required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Valid email required' };
  if (contact.replace(/\D/g, '').length < 6) return { error: 'Contact number required' };
  if (!ALLOWED_COUNTRIES.has(country)) return { error: 'Please choose a valid country' };
  if (address.length < 8) return { error: 'Address required' };

  if (!Array.isArray(p.items) || p.items.length === 0) return { error: 'At least one colour line required' };
  if (p.items.length > 8) return { error: 'Too many colour lines' };

  const items = [];
  for (const raw of p.items) {
    const colour = String(raw.colour || '').toLowerCase().trim();
    const qty = parseInt(raw.qty, 10);
    if (!ALLOWED_COLOURS.has(colour)) return { error: `Invalid colour: ${colour}` };
    if (!(qty >= 1 && qty <= 20)) return { error: 'Quantity must be between 1 and 20 per line' };
    items.push({ colour, qty });
  }
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  if (totalQty > 30) return { error: 'Order quantity exceeds limit' };

  const discountCode = str(p.discountCode, 24).toUpperCase();
  if (discountCode && !/^[A-Z0-9-]{3,24}$/.test(discountCode)) return { error: 'Invalid discount code format' };

  return { clean: { firstName, lastName, email, contact, country, address, items, discountCode } };
}

function str(v, max) {
  if (v == null) return '';
  return String(v).trim().slice(0, max);
}

function newOrderId() {
  const d = new Date();
  const ymd = d.toISOString().slice(0,10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `NUS-${ymd}-${rand}`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
