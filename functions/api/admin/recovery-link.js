// POST /api/admin/recovery-link
// Internal endpoint to create a fresh HitPay payment_request for an existing
// abandoned order. Returns the new payment URL + id so the caller can write
// them back into the sheet.
//
// Auth: shared secret (same one Apps Script uses).
// Body: { secret, order_id, email, name, phone, amount_sgd, items_summary }

const HITPAY_ENDPOINT = 'https://api.hit-pay.com/v1/payment-requests';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  if (!body.secret || body.secret !== env.GAS_SHARED_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  if (!env.HITPAY_API_KEY) {
    return json({ ok: false, error: 'HITPAY_API_KEY not configured' }, 500);
  }
  if (!body.order_id || !body.email || !body.amount_sgd) {
    return json({ ok: false, error: 'order_id, email, amount_sgd required' }, 400);
  }

  const origin = new URL(request.url).origin;
  const itemsSummary = body.items_summary || 'NUSAE Ophelia';

  const hitpayBody = {
    amount: Number(body.amount_sgd).toFixed(2),
    currency: 'SGD',
    email: body.email,
    name: (body.name || '').trim(),
    phone: body.phone || '',
    purpose: `NUSAE Ophelia - ${itemsSummary}`,
    reference_number: body.order_id,
    payment_methods: ['paynow_online', 'card'],
    redirect_url: `${origin}/thank-you?order=${encodeURIComponent(body.order_id)}`,
    webhook: `${origin}/api/hitpay-webhook`,
    send_email: false
  };

  let res, text;
  try {
    res = await fetch(HITPAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-BUSINESS-API-KEY': env.HITPAY_API_KEY
      },
      body: JSON.stringify(hitpayBody)
    });
    text = await res.text();
  } catch (err) {
    return json({ ok: false, error: 'hitpay unreachable', message: String(err && err.message || err) }, 502);
  }

  let data;
  try { data = JSON.parse(text); } catch (_) { data = {}; }
  if (!res.ok || !data.url) {
    return json({ ok: false, error: 'hitpay create failed', status: res.status, detail: data }, 502);
  }

  return json({ ok: true, url: data.url, id: data.id });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
