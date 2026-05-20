/**
 * NUSAÉ Orders — Google Apps Script web app
 *
 * Webhook events from nusae-site Cloudflare Pages Functions:
 *   - "order_created"  : a new order has been submitted (before payment)
 *   - "order_paid"     : HitPay webhook confirmed payment success
 *
 * Plus a time-driven trigger `pollAndFollowup` (every 30 min) that:
 *   - Refund poll: for "Paid" rows, asks /api/admin/payment-status; flips
 *     to "Refunded" or "Partially Refunded" when HitPay says so.
 *   - Abandoned-cart followup: for "Pending payment" rows older than
 *     CONFIG.FOLLOWUP_DELAY_MS (1 h) with no Followup 1 sent, sends a
 *     "your order is still waiting" email from "Natalia from NUSAÉ" and
 *     stamps the timestamp in column O.
 *
 * After deploying:
 *   1. Run installTrigger() once from the Apps Script editor to schedule
 *      the time-driven trigger.
 *   2. Re-deploy the Web app (new version) so the doPost endpoint picks
 *      up any updates to the schema.
 */

const CONFIG = {
  SHEET_ID: '1gpsl31zsZSPRppM0M3FuDtDZibEd6es_txJo3-PFdt8',
  SHEET_NAME: 'Sheet1',
  NOTIFY_EMAIL: 'nataliarazali@gmail.com',
  CC_EMAIL: 'affy@autolabclick.com',
  REPLY_TO: 'nataliarazali@gmail.com',
  SENDER_NAME: 'Natalia from NUSAÉ',
  BACKEND_URL: 'https://shopnusae.com',
  FOLLOWUP_DELAY_MS: 60 * 60 * 1000,
  SHARED_SECRET: 'REPLACE_WITH_LONG_RANDOM_STRING'
};

const COL = {
  TIMESTAMP: 0,
  ORDER_ID: 1,
  STATUS: 2,
  FIRST_NAME: 3,
  LAST_NAME: 4,
  EMAIL: 5,
  CONTACT: 6,
  ADDRESS: 7,
  ITEMS: 8,
  TOTAL_QTY: 9,
  TOTAL_SGD: 10,
  PAYMENT_ID: 11,
  PAYMENT_METHOD: 12,
  PAYMENT_URL: 13,
  FOLLOWUP1_AT: 14,
  PAYMENT_REQUEST_ID: 15
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
    '',
    o.payment_url || '',
    '',
    o.payment_request_id || ''
  ]);
}

function markPaid(orderId, payment) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][COL.ORDER_ID] === orderId) {
      sheet.getRange(r + 1, COL.STATUS + 1).setValue('Paid');
      sheet.getRange(r + 1, COL.PAYMENT_ID + 1).setValue(payment.payment_id || '');
      sheet.getRange(r + 1, COL.PAYMENT_METHOD + 1).setValue(payment.payment_method || '');
      return;
    }
  }
}

function sendPaidEmail(orderId) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][COL.ORDER_ID] !== orderId) continue;
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

function pollAndFollowup() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const now = Date.now();

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[COL.ORDER_ID]) continue;
    const status = row[COL.STATUS];
    if (status === 'Paid') {
      pollRefundForRow(sheet, r, row);
    } else if (status === 'Pending payment') {
      maybeSendFollowup1(sheet, r, row, now);
    }
  }
}

function pollRefundForRow(sheet, r, row) {
  const prId = row[COL.PAYMENT_REQUEST_ID];
  if (!prId) return;
  const result = checkPaymentStatus(prId);
  if (!result || !result.ok) return;
  const newStatus = deriveRefundStatus(result);
  if (newStatus) {
    sheet.getRange(r + 1, COL.STATUS + 1).setValue(newStatus);
  }
}

function deriveRefundStatus(result) {
  const s = String(result.status || '').toLowerCase();
  if (s === 'refunded') return 'Refunded';
  if (s === 'partially_refunded') return 'Partially Refunded';
  const amount = parseFloat(result.amount || 0);
  const refunded = parseFloat(result.refunded_amount || 0);
  if (refunded > 0) {
    return (amount > 0 && refunded >= amount) ? 'Refunded' : 'Partially Refunded';
  }
  return null;
}

function maybeSendFollowup1(sheet, r, row, now) {
  if (row[COL.FOLLOWUP1_AT]) return;
  const ts = row[COL.TIMESTAMP];
  if (!ts) return;
  const created = (ts instanceof Date) ? ts.getTime() : new Date(ts).getTime();
  if (isNaN(created)) return;
  if ((now - created) < CONFIG.FOLLOWUP_DELAY_MS) return;

  const email = row[COL.EMAIL];
  const firstName = row[COL.FIRST_NAME];
  const items = row[COL.ITEMS];
  const total = row[COL.TOTAL_SGD];
  const paymentUrl = row[COL.PAYMENT_URL];
  if (!email || !paymentUrl) return;

  sendFollowup1Email(email, firstName, items, total, paymentUrl);
  sheet.getRange(r + 1, COL.FOLLOWUP1_AT + 1).setValue(new Date());
}

function sendFollowup1Email(email, firstName, items, total, paymentUrl) {
  const safeName = (firstName || 'there').toString();
  const safeItems = (items || 'your NUSAÉ order').toString();
  const subject = `Hi ${safeName}, your NUSAÉ order is still waiting`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;color:#1F1A14;line-height:1.55;">
      <p>Hi ${safeName},</p>
      <p>I noticed you started ordering your NUSAÉ Ophelia (${safeItems}) but didn't quite make it through checkout. Just a quick note in case it slipped your mind — your link is still live:</p>
      <p style="margin:28px 0;">
        <a href="${paymentUrl}" style="background:#1F1A14;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:500;display:inline-block;">Complete my order →</a>
      </p>
      <p>If anything stopped you or you have a question, just hit reply and I'll sort it out personally.</p>
      <p style="margin-top:28px;">Warmly,<br>Natalia<br><span style="color:#6b6155;">NUSAÉ</span></p>
    </div>`;
  MailApp.sendEmail({
    to: email,
    name: CONFIG.SENDER_NAME,
    replyTo: CONFIG.REPLY_TO,
    subject: subject,
    htmlBody: html
  });
}

function checkPaymentStatus(paymentRequestId) {
  try {
    const res = UrlFetchApp.fetch(CONFIG.BACKEND_URL + '/api/admin/payment-status', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        secret: CONFIG.SHARED_SECRET,
        payment_request_id: paymentRequestId
      }),
      muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText());
  } catch (err) {
    return null;
  }
}

function installTrigger() {
  const existing = ScriptApp.getProjectTriggers();
  for (const t of existing) {
    if (t.getHandlerFunction() === 'pollAndFollowup') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('pollAndFollowup')
    .timeBased()
    .everyMinutes(30)
    .create();
}
