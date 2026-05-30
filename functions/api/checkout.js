// POST /api/checkout
// Receives order form, creates HitPay payment-request, logs order to Sheet via Apps Script.
// Returns { url, id } so the browser can redirect to HitPay's hosted checkout.

const PRICE_SGD = 47;
const HITPAY_ENDPOINT = 'https://api.hit-pay.com/v1/payment-requests';
const ALLOWED_COLOURS = new Set(['white', 'beige', 'grey', 'black']);

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

  const { firstName, lastName, email, contact, address, items } = v.clean;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalSgd = totalQty * PRICE_SGD;
  const orderId = newOrderId();
  const itemsSummary = items.map(i => `${i.colour} x ${i.qty}`).join(', ');

  const origin = new URL(request.url).origin;

  const hitpayBody = {
    amount: totalSgd.toFixed(2),
    currency: 'SGD',
    email,
    name: `${firstName} ${lastName}`.trim(),
    phone: contact,
    purpose: `NUSAE Ophelia - ${itemsSummary}`,
    reference_number: orderId,
    payment_methods: ['paynow_online', 'card'],
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

  // Log the order to the sheet (best-effort; don't block payment if this fails)
  if (env.GAS_WEBHOOK_URL) {
    const orderForSheet = {
      order_id: orderId,
      first_name: firstName,
      last_name: lastName,
      email,
      contact,
      address,
      items,
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
  const address   = str(p.address, 500);
  if (!firstName || !lastName)  return { error: 'Name required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Valid email required' };
  if (contact.replace(/\D/g, '').length < 6) return { error: 'Contact number required' };
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

  return { clean: { firstName, lastName, email, contact, address, items } };
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
