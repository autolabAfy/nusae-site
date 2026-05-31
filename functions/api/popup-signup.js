// POST /api/popup-signup
// Receives { email }, generates a unique single-use 15% discount code,
// stores it in KV (DISCOUNT_CODES), pushes profile + code to Klaviyo,
// returns { code } to the browser.

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L for legibility
const CODE_PREFIX = 'OPH';
const DISCOUNT_PCT = 15;
const KLAVIYO_REVISION = '2024-10-15';
const SIGNUP_SOURCE = 'site_popup_15off';

export async function onRequestPost(context) {
  try {
    return await handle(context);
  } catch (err) {
    return json({ error: 'Server error', message: String(err && err.message || err) }, 500);
  }
}

async function handle({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: 'Invalid request' }, 400);
  }

  const email = String(payload?.email || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Please enter a valid email' }, 400);
  }

  // KV is required (it's where the code lives). Klaviyo is optional — if its
  // secrets are absent we still issue the code; we just skip the email sync.
  if (!env.DISCOUNT_CODES) return json({ error: 'Discount storage not configured' }, 500);

  // Reuse an existing code if this email has signed up before — idempotent UX.
  const existingCode = await env.DISCOUNT_CODES.get(`email:${email}`);
  let code;
  if (existingCode) {
    code = existingCode;
  } else {
    code = await generateUniqueCode(env.DISCOUNT_CODES);
    const issuedAt = new Date().toISOString();
    await Promise.all([
      env.DISCOUNT_CODES.put(`code:${code}`, JSON.stringify({
        email,
        issuedAt,
        used: false,
        percent: DISCOUNT_PCT
      })),
      env.DISCOUNT_CODES.put(`email:${email}`, code)
    ]);
  }

  // Push to Klaviyo if it's configured — never fail the signup if Klaviyo is
  // down or absent (the user still gets their code from KV either way).
  if (env.KLAVIYO_API_KEY && env.KLAVIYO_LIST_ID) {
    try {
      await syncToKlaviyo(env, email, code);
    } catch (err) {
      console.log('Klaviyo sync failed:', String(err && err.message || err));
    }
  }

  return json({ code, percent: DISCOUNT_PCT });
}

async function generateUniqueCode(kv) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    const existing = await kv.get(`code:${code}`);
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique code, please retry');
}

function makeCode() {
  let s = '';
  const buf = new Uint8Array(5);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return `${CODE_PREFIX}-${s}`;
}

async function syncToKlaviyo(env, email, code) {
  const headers = {
    'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'revision': KLAVIYO_REVISION
  };

  // 1. Create profile with welcome_code (or PATCH if it already exists).
  const profileBody = {
    data: {
      type: 'profile',
      attributes: {
        email,
        properties: { welcome_code: code, signup_source: SIGNUP_SOURCE }
      }
    }
  };
  const createRes = await fetch('https://a.klaviyo.com/api/profiles', {
    method: 'POST',
    headers,
    body: JSON.stringify(profileBody)
  });

  if (createRes.status === 409) {
    const conflict = await createRes.json().catch(() => ({}));
    const existingId = conflict?.errors?.[0]?.meta?.duplicate_profile_id;
    if (existingId) {
      await fetch(`https://a.klaviyo.com/api/profiles/${existingId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          data: {
            type: 'profile',
            id: existingId,
            attributes: {
              properties: { welcome_code: code, signup_source: SIGNUP_SOURCE }
            }
          }
        })
      });
    }
  } else if (!createRes.ok && createRes.status !== 201) {
    const txt = await createRes.text().catch(() => '');
    throw new Error(`Klaviyo profile create failed: ${createRes.status} ${txt.slice(0, 200)}`);
  }

  // 2. Subscribe to list with marketing consent (powers the welcome flow).
  const subBody = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: SIGNUP_SOURCE,
        profiles: {
          data: [{
            type: 'profile',
            attributes: {
              email,
              subscriptions: {
                email: {
                  marketing: {
                    consent: 'SUBSCRIBED',
                    consented_at: new Date().toISOString()
                  }
                }
              }
            }
          }]
        }
      },
      relationships: {
        list: { data: { type: 'list', id: env.KLAVIYO_LIST_ID } }
      }
    }
  };
  const subRes = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs', {
    method: 'POST',
    headers,
    body: JSON.stringify(subBody)
  });
  if (!subRes.ok && subRes.status !== 202) {
    const txt = await subRes.text().catch(() => '');
    throw new Error(`Klaviyo subscribe failed: ${subRes.status} ${txt.slice(0, 200)}`);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
