/**
 * NUSAÉ Orders — Google Apps Script web app
 *
 * Handles two events from the nusae-site Cloudflare Pages Functions:
 *   - "order_created"  : a new order has been submitted (before payment)
 *   - "order_paid"     : HitPay webhook confirmed payment success
 *
 * Appends rows / updates status in the NUSAÉ Orders sheet,
 * and emails Natalia at order_paid.
 *
 * DEPLOY:
 *   1. script.google.com → New project → paste this whole file
 *   2. Edit the CONFIG block below if needed
 *   3. Deploy → New deployment → type = Web app
 *      Execute as: Me (affy@autolabclick.com)
 *      Who has access: Anyone
 *   4. Copy the deployment URL — give it to Claude to set as
 *      GAS_WEBHOOK_URL secret on Cloudflare Pages.
 *   5. Also generate a long random shared secret string and paste it
 *      into SHARED_SECRET below — give the same string to Claude as
 *      GAS_SHARED_SECRET secret on Cloudflare Pages.
 */

const CONFIG = {
  SHEET_ID: '1gpsl31zsZSPRppM0M3FuDtDZibEd6es_txJo3-PFdt8',
  SHEET_NAME: 'Sheet1',
  NOTIFY_EMAIL: 'nataliarazali@gmail.com',
  CC_EMAIL: 'affy@autolabclick.com',
  // Replace with a long random string. Same value goes to Cloudflare as GAS_SHARED_SECRET.
  SHARED_SECRET: 'REPLACE_WITH_LONG_RANDOM_STRING'
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== CONFIG.SHARED_SECRET) {
      return jsonOut({ ok: false, error: 'unauthorized' });
    }

    if (body.event === 'order_created') {
      appendOrder(body.order);
      return jsonOut({ ok: true });
    }
    if (body.event === 'order_paid') {
      markPaid(body.order_id, body.payment);
      sendPaidEmail(body.order_id);
      return jsonOut({ ok: true });
    }
    return jsonOut({ ok: false, error: 'unknown event' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
}

function appendOrder(o) {
  const sheet = getSheet();
  const items = (o.items || []).map(i => `${i.colour} x ${i.qty}`).join(', ');
  const totalQty = (o.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
  sheet.appendRow([
    new Date(),
    o.order_id,
    'Pending payment',
    o.first_name,
    o.last_name,
    o.email,
    o.contact,
    o.address,
    items,
    totalQty,
    o.total_sgd,
    '',
    ''
  ]);
}

function markPaid(orderId, payment) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][1] === orderId) {
      sheet.getRange(r + 1, 3).setValue('Paid');
      sheet.getRange(r + 1, 12).setValue(payment.payment_id || '');
      sheet.getRange(r + 1, 13).setValue(payment.payment_method || '');
      return;
    }
  }
}

function sendPaidEmail(orderId) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][1] !== orderId) continue;
    const [ts, oid, status, fn, ln, email, contact, address, items, qty, total, payId, payMethod] = data[r];
    const subject = `New paid order — ${fn} ${ln} (${items}) — ${oid}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;color:#1F1A14;">
        <h2 style="font-family:'Cormorant Garamond',serif;font-weight:500;color:#1F1A14;margin-bottom:8px;">New paid order</h2>
        <p style="color:#6b6155;margin-top:0;">${oid}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><td style="padding:6px 0;color:#6b6155;width:140px;">Customer</td><td style="padding:6px 0;"><strong>${fn} ${ln}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b6155;">Email</td><td style="padding:6px 0;">${email}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6155;">Contact</td><td style="padding:6px 0;">${contact}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6155;vertical-align:top;">Address</td><td style="padding:6px 0;white-space:pre-wrap;">${address}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6155;">Items</td><td style="padding:6px 0;"><strong>${items}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b6155;">Total</td><td style="padding:6px 0;"><strong>SGD $${total}</strong> (${qty} pcs)</td></tr>
          <tr><td style="padding:6px 0;color:#6b6155;">Payment</td><td style="padding:6px 0;">${payMethod} · ${payId}</td></tr>
        </table>
        <p style="margin-top:24px;color:#6b6155;font-size:13px;">Logged in the NUSAÉ Orders sheet.</p>
      </div>`;
    MailApp.sendEmail({
      to: CONFIG.NOTIFY_EMAIL,
      cc: CONFIG.CC_EMAIL,
      subject: subject,
      htmlBody: html
    });
    return;
  }
}
