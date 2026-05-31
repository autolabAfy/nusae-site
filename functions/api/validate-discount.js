// POST /api/validate-discount
// Body: { code }
// Looks up a discount code in DISCOUNT_CODES KV WITHOUT marking it used, and
// reports whether it's valid + what percent it gives. The checkout form calls
// this so a manually-typed code can be validated (and the discount shown)
// before the customer is sent to payment. Mirrors the validation in checkout.js.

export async function onRequestPost(context) {
  try {
    return await handle(context);
  } catch (err) {
    return json({ valid: false, error: 'Server error', message: String(err && err.message || err) }, 500);
  }
}

async function handle({ request, env }) {
  let payload;
  try { payload = await request.json(); } catch (_) { return json({ valid: false, error: 'Invalid request' }, 400); }

  const code = String(payload?.code || '').trim().toUpperCase().slice(0, 24);
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) return json({ valid: false, error: 'Enter a valid code' }, 400);
  if (!env.DISCOUNT_CODES) return json({ valid: false, error: 'Discount system unavailable' }, 500);

  const raw = await env.DISCOUNT_CODES.get(`code:${code}`);
  if (!raw) return json({ valid: false, error: 'Discount code not recognised' }, 404);

  let rec;
  try { rec = JSON.parse(raw); } catch (_) { return json({ valid: false, error: 'Discount code invalid' }, 400); }
  if (rec.used) return json({ valid: false, error: 'This code has already been used' }, 409);

  const percent = Number(rec.percent) || 15;
  return json({ valid: true, code, percent });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
