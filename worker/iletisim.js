// İletişim formu: Turnstile doğrulaması + Resend ile e-posta.
//
// Gerekli gizli değişkenler (Cloudflare > Workers > wise-composite > Settings > Variables and Secrets):
//   TURNSTILE_SECRET_KEY   Cloudflare Turnstile gizli anahtarı
//   RESEND_API_KEY         resend.com API anahtarı
// MAIL_TO / MAIL_FROM wrangler.jsonc > vars içindedir. Alan adı yokken Resend yalnızca hesabın kendi
// e-posta adresine (MAIL_TO) gönderebilir; bu yüzden Resend hesabı info@wisecomposite.com.tr ile açılmalıdır.

import { json, esc } from './ortak.js';

const MAX_FILE = 10 * 1024 * 1024;

export async function handleContact(request, env) {
  if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY) return json({ ok: false, error: 'config' }, 503);

  const data = await request.formData();
  const field = (k) => String(data.get(k) ?? '').trim();

  // Bot tuzağı: gizli alan doluysa sessizce başarılı say
  if (field('website')) return json({ ok: true });

  const captcha = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: field('cf-turnstile-response'),
      remoteip: request.headers.get('CF-Connecting-IP') || '',
    }),
  }).then((r) => r.json());
  if (!captcha.success) return json({ ok: false, error: 'captcha' }, 400);

  const name = field('name'), email = field('email'), message = field('message');
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !data.get('kvkk')) {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  const attachments = [];
  const file = data.get('file');
  if (file && typeof file === 'object' && file.size > 0) {
    if (file.size > MAX_FILE) return json({ ok: false, error: 'file' }, 400);
    attachments.push({ filename: file.name, content: toBase64(await file.arrayBuffer()) });
  }

  const rows = [
    ['Ad Soyad', name],
    ['Firma', field('company')],
    ['E-posta', email],
    ['Telefon', field('phone')],
    ['Sektör', field('sector')],
  ];
  const html = `<table cellpadding="6" style="border-collapse:collapse;font:14px Arial,sans-serif">
${rows.map(([k, v]) => `<tr><td style="color:#666">${k}</td><td><b>${esc(v) || '-'}</b></td></tr>`).join('\n')}
</table>
<p style="font:14px Arial,sans-serif;white-space:pre-wrap">${esc(message)}</p>`;
  const text = rows.map(([k, v]) => `${k}: ${v || '-'}`).join('\n') + `\n\n${message}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.MAIL_TO],
      reply_to: email,
      subject: `Web sitesi formu: ${name}${field('company') ? ` (${field('company')})` : ''}`,
      html,
      text,
      attachments,
    }),
  });
  if (!res.ok) {
    console.error('Resend', res.status, await res.text());
    return json({ ok: false, error: 'mail' }, 502);
  }
  return json({ ok: true });
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
