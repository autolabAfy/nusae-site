// POST /api/hitpay-webhook
// HitPay calls this when a payment status changes.
// We verify HMAC-SHA256(payload, salt) matches the Hitpay-Signature header,
// then notify the Apps Script (which marks the row paid + emails Natalia).

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const signature = request.headers.get('hitpay-signature') || '';

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }
  const valid = await verifyHmac(rawBody, signature, env.HITPAY_SALT);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (_) {
    // HitPay also supports form-urlencoded — try that
    data = Object.fromEntries(new URLSearchParams(rawBody).entries());
  }

  // HitPay payment-request webhook fields:
  //   status (completed | failed | pending), payment_id, payment_request_id,
  //   reference_number, amount, currency, payment_type
  if (data.status === 'completed' && data.reference_number && env.GAS_WEBHOOK_URL) {
    try {
      await fetch(env.GAS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.GAS_SHARED_SECRET,
          event: 'order_paid',
          order_id: data.reference_number,
          payment: {
            payment_id: data.payment_id || '',
            payment_request_id: data.payment_request_id || '',
            payment_method: data.payment_type || '',
            amount: data.amount || '',
            currency: data.currency || 'SGD'
          }
        })
      });
    } catch (_) { /* swallow — HitPay will retry on non-2xx */ }
  }

  return new Response('OK', { status: 200 });
}

async function verifyHmac(message, expectedHex, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const actualHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(actualHex, expectedHex.toLowerCase());
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
