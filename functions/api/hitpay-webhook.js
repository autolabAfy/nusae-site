// POST /api/hitpay-webhook
// HitPay calls this when a payment status changes.
// Legacy payment-request webhook signs by:
//   1. Take all body fields except `hmac`
//   2. Sort keys alphabetically
//   3. Concatenate as `key1value1key2value2...` (no separators)
//   4. HMAC-SHA256(concatenated, HITPAY_SALT) hex == provided hmac
// Body arrives as JSON or form-urlencoded.

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (_) {
    data = Object.fromEntries(new URLSearchParams(rawBody).entries());
  }

  const providedHmac = (data.hmac || '').toString();
  if (!providedHmac) {
    return new Response('Missing hmac field', { status: 400 });
  }

  const fields = { ...data };
  delete fields.hmac;

  const sortedKeys = Object.keys(fields).sort();
  const message = sortedKeys.map(k => `${k}${fields[k]}`).join('');

  const valid = await verifyHmac(message, providedHmac, env.HITPAY_SALT);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

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
            payment_method: data.payment_type || data.payment_method || 'PayNow',
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
