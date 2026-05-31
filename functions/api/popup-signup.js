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

  // Push to Klaviyo if it's configured — never fail the signup if Klaviyo is
  // down or absent (the user still gets their code from KV either way).
  const syncIfConfigured = async (c) => {
    if (env.KLAVIYO_API_KEY && env.KLAVIYO_LIST_ID) {
      try {
        await syncToKlaviyo(env, email, c);
      } catch (err) {
        console.log('Klaviyo sync failed:', String(err && err.message || err));
      }
    }
  };

  // Email the code directly via Resend (independent of any Klaviyo flow). This
  // is what makes the popup's "we've sent it to your inbox" promise true. Also
  // best-effort: a Resend outage must never block issuing the code.
  const emailIfConfigured = async (c) => {
    if (env.RESEND_API_KEY) {
      try {
        await sendWelcomeEmail(env, email, c);
      } catch (err) {
        console.log('Resend send failed:', String(err && err.message || err));
      }
    }
  };

  // One discount per email. If this address already claimed a code, never mint
  // a second one: hand back the same code if it's still unused, or refuse if
  // it's already been redeemed.
  const existingCode = await env.DISCOUNT_CODES.get(`email:${email}`);
  if (existingCode) {
    let rec = {};
    try { rec = JSON.parse(await env.DISCOUNT_CODES.get(`code:${existingCode}`) || '{}'); } catch (_) {}
    if (rec.used) {
      return json({
        status: 'used',
        error: 'This email address has already used its one-time discount.'
      }, 200);
    }
    // Keep them on the list; don't reissue. Re-send the email so a returning
    // visitor who lost the code can still retrieve it.
    await Promise.all([syncIfConfigured(existingCode), emailIfConfigured(existingCode)]);
    return json({ code: existingCode, percent: DISCOUNT_PCT, status: 'existing' });
  }

  // Brand-new email — mint a fresh single-use code.
  const code = await generateUniqueCode(env.DISCOUNT_CODES);
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

  await Promise.all([syncIfConfigured(code), emailIfConfigured(code)]);

  return json({ code, percent: DISCOUNT_PCT, status: 'new' });
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
                    // No consented_at: Klaviyo rejects it for a live (non-historical)
                    // opt-in. It records the consent timestamp as "now" automatically.
                    consent: 'SUBSCRIBED'
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

// ---- Resend: deliver the discount code to the customer's inbox ----
// Requires the RESEND_API_KEY secret. RESEND_FROM sets the sender (must be on a
// domain verified in Resend); RESEND_REPLY_TO is optional. SITE_URL overrides
// the shop link in the email.
async function sendWelcomeEmail(env, email, code) {
  const from = env.RESEND_FROM || 'NUSAÉ <hello@shopnusae.com>';
  const shopUrl = env.SITE_URL || 'https://shopnusae.com';
  const subject = `Here's your ${DISCOUNT_PCT}% off Ophelia ✿`;

  const body = {
    from,
    to: [email],
    subject,
    html: welcomeEmailHtml(code, shopUrl),
    text: welcomeEmailText(code, shopUrl)
  };
  if (env.RESEND_REPLY_TO) body.reply_to = env.RESEND_REPLY_TO;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Resend send failed: ${res.status} ${txt.slice(0, 200)}`);
  }
}

function welcomeEmailText(code, shopUrl) {
  return [
    'Welcome to NUSAÉ ✿',
    '',
    `Here's your one-time code for ${DISCOUNT_PCT}% off the Ophelia Lace Outerwear:`,
    '',
    `    ${code}`,
    '',
    "It'll auto-apply at checkout — or enter it by hand. One use per customer.",
    '',
    `Shop Ophelia: ${shopUrl}`,
    '',
    'NUSAÉ — effortless modest pieces, made simple.'
  ].join('\n');
}

function welcomeEmailHtml(code, shopUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EDE3D2;font-family:Georgia,'Times New Roman',serif;color:#1F1A14;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE3D2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#F5EFE6;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:36px 36px 8px;text-align:center;">
          <div style="font-size:13px;letter-spacing:6px;color:#8C7A5B;text-transform:uppercase;">NUSAÉ</div>
          <div style="font-size:26px;color:#C9A977;margin-top:18px;">✿</div>
          <h1 style="font-size:28px;font-weight:500;margin:8px 0 6px;line-height:1.2;">Here's your ${DISCOUNT_PCT}% off Ophelia</h1>
          <p style="font-size:15px;color:#4A3F30;font-style:italic;margin:0 0 8px;">A one-time code, yours to use whenever you're ready.</p>
        </td></tr>
        <tr><td style="padding:12px 36px;text-align:center;">
          <div style="border:1px dashed #C9A977;border-radius:14px;padding:18px 12px;font-family:Arial,Helvetica,sans-serif;font-size:24px;letter-spacing:3px;font-weight:bold;color:#1F1A14;background:#FFFDF9;">${code}</div>
          <p style="font-size:13px;color:#8C7A5B;margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;">It auto-applies at checkout — or enter it by hand. One use per customer.</p>
        </td></tr>
        <tr><td style="padding:22px 36px 8px;text-align:center;">
          <a href="${shopUrl}" style="display:inline-block;background:#1F1A14;color:#F5EFE6;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:15px 34px;border-radius:999px;">Shop Ophelia</a>
        </td></tr>
        <tr><td style="padding:24px 36px 34px;text-align:center;">
          <p style="font-size:12px;color:#8C7A5B;font-family:Arial,Helvetica,sans-serif;line-height:1.5;margin:0;">NUSAÉ — effortless modest pieces, made simple.<br>You're receiving this because you requested a discount code at ${shopUrl}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
