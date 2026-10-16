// Yönetim paneli API'si (admin.html bu adresleri kullanır).
// Giriş: ADMIN_PASSWORD gizli değişkeni (Cloudflare > Workers > wise-composite > Settings > Variables and Secrets).
// Şifre değiştirilince açık olan tüm oturumlar kapanır.

import { json, toPart, PART_COLUMNS, KATEGORILER } from './ortak.js';

const COOKIE = 'wc_admin';
const SESSION_DAYS = 30;
const MAX_FAILS = 10;                 // 15 dakikada bir IP'den en fazla bu kadar hatalı şifre
const FAIL_WINDOW = 15 * 60;
const MAX_PHOTO = 1.5 * 1024 * 1024;  // D1 satır sınırı 2 MB; panel fotoğrafı zaten küçültüp gönderir
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function handleAdmin(request, env, route) {
  if (!env.ADMIN_PASSWORD) return json({ ok: false, error: 'config' }, 503);
  const method = request.method;

  // Başka sitelerden gönderilen istekleri engelle (tarayıcı bu başlığı izinsiz eklemez)
  if (method !== 'GET' && request.headers.get('X-WC-Admin') !== '1') return json({ ok: false, error: 'csrf' }, 403);

  if (route === 'giris' && method === 'POST') return login(request, env);
  if (route === 'cikis' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });

  if (!(await isLoggedIn(request, env))) return json({ ok: false, error: 'auth' }, 401);

  if (route === 'oturum' && method === 'GET') return json({ ok: true });
  if (route === 'parcalar' && method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT ${PART_COLUMNS} FROM parca ORDER BY id DESC`).all();
    return json({ ok: true, urunler: results.map(toPart) });
  }
  if (route === 'parcalar' && method === 'POST') return savePart(request, env, null);
  const m = route.match(/^parcalar\/(\d+)$/);
  if (m && method === 'PUT') return savePart(request, env, Number(m[1]));
  if (m && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM parca WHERE id = ?').bind(Number(m[1])).run();
    return json({ ok: true });
  }
  return json({ ok: false, error: 'notfound' }, 404);
}

// ---------- Parça kaydetme ----------

async function savePart(request, env, id) {
  const data = await request.formData();
  const text = (k, max = 200) => String(data.get(k) ?? '').trim().slice(0, max);
  const list = (k) => data.getAll(k).map((v) => String(v).trim().slice(0, 80)).filter(Boolean).slice(0, 20);

  const kategori = text('kategori');
  const ad = text('ad');
  if (!KATEGORILER.includes(kategori) || !ad) return json({ ok: false, error: 'invalid' }, 400);
  const kara = kategori === 'kara-araclari';
  const fields = {
    kategori,
    ad,
    marka: kara ? text('marka', 60) : '',
    uyumlu: JSON.stringify(kara ? list('uyumlu') : []),
    oem: JSON.stringify(list('oem')),
    kod: kara ? text('kod', 80) : '',
  };

  let photo = null;
  const file = data.get('gorsel');
  if (file && typeof file === 'object' && file.size > 0) {
    if (file.size > MAX_PHOTO) return json({ ok: false, error: 'photo-size' }, 400);
    if (!PHOTO_TYPES.includes(file.type)) return json({ ok: false, error: 'photo-type' }, 400);
    photo = { bytes: await file.arrayBuffer(), type: file.type };
  }
  const removePhoto = data.get('gorsel_sil') === '1';

  const cols = Object.keys(fields);
  const vals = Object.values(fields);
  if (id === null) {
    const row = await env.DB.prepare(
      `INSERT INTO parca (${cols.join(', ')}, gorsel, gorsel_tip) VALUES (${cols.map(() => '?').join(', ')}, ?, ?) RETURNING id`,
    ).bind(...vals, photo ? photo.bytes : null, photo ? photo.type : null).first();
    id = row.id;
  } else {
    let set = cols.map((c) => `${c} = ?`).join(', ') + ", guncelleme = datetime('now')";
    const binds = [...vals];
    if (photo) { set += ', gorsel = ?, gorsel_tip = ?, surum = surum + 1'; binds.push(photo.bytes, photo.type); }
    else if (removePhoto) set += ', gorsel = NULL, gorsel_tip = NULL, surum = surum + 1';
    const res = await env.DB.prepare(`UPDATE parca SET ${set} WHERE id = ?`).bind(...binds, id).run();
    if (!res.meta.changes) return json({ ok: false, error: 'notfound' }, 404);
  }
  const row = await env.DB.prepare(`SELECT ${PART_COLUMNS} FROM parca WHERE id = ?`).bind(id).first();
  return json({ ok: true, urun: toPart(row) });
}

// ---------- Oturum ----------

async function login(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'yerel';
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('DELETE FROM giris_deneme WHERE zaman < ?').bind(now - FAIL_WINDOW).run();
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM giris_deneme WHERE ip = ?').bind(ip).first();
  if (n >= MAX_FAILS) return json({ ok: false, error: 'locked' }, 429);

  const body = await request.json().catch(() => ({}));
  if (!(await sameText(String(body.sifre ?? ''), env.ADMIN_PASSWORD))) {
    await env.DB.prepare('INSERT INTO giris_deneme (ip, zaman) VALUES (?, ?)').bind(ip, now).run();
    return json({ ok: false, error: 'password' }, 401);
  }
  const exp = now + SESSION_DAYS * 86400;
  const token = `${exp}.${await sign(env, String(exp))}`;
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
}

async function isLoggedIn(request, env) {
  const raw = (request.headers.get('Cookie') || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return sameText(sig, await sign(env, exp));
}

function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/api/admin; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

async function sign(env, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`wc-admin:${env.ADMIN_PASSWORD}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Sabit sürede karşılaştırma (şifre tahmini zamanlamadan çıkarılamasın)
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}
