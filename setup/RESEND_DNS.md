# Resend — DNS records for shopnusae.com

Account: nataliarazalig@gmail.com (Resend account name "nataliarazali")
Domain added: shopnusae.com — region Tokyo (ap-northeast-1)
Resend domain ID: 1c360222-4466-4025-bfd8-617ccea9869d
Generated: 2026-05-31

Add ALL of these to shopnusae.com's DNS provider. In Cloudflare, set each record to
**DNS only** (grey cloud — NOT proxied/orange) or verification fails.

> Note on "Name": Resend shows the host WITHOUT the domain suffix (e.g. `send`,
> `resend._domainkey`). Cloudflare auto-appends `.shopnusae.com`, so paste the name
> exactly as shown. If your DNS host needs the full name, use e.g.
> `send.shopnusae.com`, `resend._domainkey.shopnusae.com`, `_dmarc.shopnusae.com`.

## 1. DKIM — TXT (required)
- Type:    TXT
- Name:    resend._domainkey
- Content: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCxUYIdvopPc5mMCjEvHGZ/eJr23o7GXTlaEz81qsOMVQiokitTziG8TWJwHIgvJrSdTZUrOqp7M1tM7/FHc1fLf+fLNCqnKvrNv4xRt6ipYNYJVnshC07I8yrRSQDxkSFL8S9TxbQT6rKZiw4M7HbvTR5gfyyjbswRcotapwVScwIDAQAB
- TTL:     Auto

## 2. SPF — MX (required, for sending)
- Type:     MX
- Name:     send
- Content:  feedback-smtp.ap-northeast-1.amazonses.com
- Priority: 10
- TTL:      Auto

## 3. SPF — TXT (required, for sending)
- Type:    TXT
- Name:    send
- Content: v=spf1 include:amazonses.com ~all
- TTL:     Auto

## 4. DMARC — TXT (optional but recommended)
- Type:    TXT
- Name:    _dmarc
- Content: v=DMARC1; p=none;
- TTL:     Auto

---

After records propagate, click "Verify" on the Resend domain page. Then create a
**sending** API key in THIS account and set it as the Cloudflare Pages secret
`RESEND_API_KEY`. The popup-signup function sends from `NUSAÉ <hello@shopnusae.com>`
by default (override with `RESEND_FROM`).
