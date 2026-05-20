// POST /api/admin/payment-status
// Internal endpoint called by Apps Script to check HitPay payment status for refund polling.
// Auth: shared secret (same one Apps Script uses to talk to GAS_WEBHOOK_URL).
// Body: { secret, payment_request_id }
// Returns: { ok, status, refunded_amount, currency } where status is HitPay's payment_request status
//          ('pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded' ...).

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
  if (!body.payment_request_id) {
    return json({ ok: false, error: 'payment_request_id required' }, 400);
  }
  if (!env.HITPAY_API_KEY) {
    return json({ ok: false, error: 'HITPAY_API_KEY not configured' }, 500);
  }

  const url = `https://api.hit-pay.com/v1/payment-requests/${encodeURIComponent(body.payment_request_id)}`;
  let res, data;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-BUSINESS-API-KEY': env.HITPAY_API_KEY,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    data = await res.json();
  } catch (err) {
    return json({ ok: false, error: 'hitpay unreachable', message: String(err && err.message || err) }, 502);
  }

  if (!res.ok) {
    return json({ ok: false, error: 'hitpay error', status: res.status, detail: data }, 502);
  }

  // HitPay returns { status, amount, refunded_amount, currency, ... }
  return json({
    ok: true,
    status: data.status || 'unknown',
    amount: data.amount,
    refunded_amount: data.refunded_amount || '0.00',
    currency: data.currency,
    payment_url: data.url || null
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
