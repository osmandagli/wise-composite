// Herkese açık katalog: parça listesi ve parça fotoğrafları.

import { json, toPart, PART_COLUMNS, KATEGORILER } from './ortak.js';

export async function listPublic(request, env) {
  const kategori = new URL(request.url).searchParams.get('kategori');
  if (!KATEGORILER.includes(kategori)) return json({ ok: false, error: 'kategori' }, 400);
  const { results } = await env.DB.prepare(`SELECT ${PART_COLUMNS} FROM parca WHERE kategori = ? ORDER BY id`).bind(kategori).all();
  // Yönetim panelinde kaydedilen parça sayfa yenilenince hemen görünsün diye önbelleğe alınmaz.
  return json({ ok: true, urunler: results.map(toPart) }, 200, { 'Cache-Control': 'no-cache' });
}

export async function servePhoto(env, id) {
  const row = await env.DB.prepare('SELECT gorsel, gorsel_tip FROM parca WHERE id = ?').bind(id).first();
  if (!row || !row.gorsel) return new Response('Bulunamadı', { status: 404 });
  // Adres her fotoğraf değişikliğinde ?v= ile değiştiği için uzun süre önbelleğe alınabilir.
  return new Response(new Uint8Array(row.gorsel), {
    headers: { 'Content-Type': row.gorsel_tip || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
