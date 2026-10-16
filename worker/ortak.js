// Worker dosyalarının ortak yardımcıları ve veritabanı şeması.

export const KATEGORILER = ['kara-araclari', 'rayli-sistemler'];

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Tablo yoksa ilk istekte oluşturulur; ayrıca "migration" çalıştırmak gerekmez.
// Şemayı değiştirirseniz yeni sütunları ALTER TABLE ile ekleyin, var olan tabloyu silmeyin.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS parca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kategori TEXT NOT NULL,
    ad TEXT NOT NULL,
    marka TEXT NOT NULL DEFAULT '',
    uyumlu TEXT NOT NULL DEFAULT '[]',
    oem TEXT NOT NULL DEFAULT '[]',
    kod TEXT NOT NULL DEFAULT '',
    gorsel BLOB,
    gorsel_tip TEXT,
    surum INTEGER NOT NULL DEFAULT 1,
    olusturma TEXT NOT NULL DEFAULT (datetime('now')),
    guncelleme TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS parca_kategori ON parca (kategori, id)`,
  `CREATE TABLE IF NOT EXISTS giris_deneme (ip TEXT NOT NULL, zaman INTEGER NOT NULL)`,
];

let schemaReady = false;
export async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map((q) => env.DB.prepare(q)));
  schemaReady = true;
}

// Veritabanı satırını sitede/panelde kullanılan biçime çevirir (fotoğrafın kendisi hariç).
export function toPart(row) {
  return {
    id: row.id,
    kategori: row.kategori,
    ad: row.ad,
    marka: row.marka,
    uyumlu: JSON.parse(row.uyumlu || '[]'),
    oem: JSON.parse(row.oem || '[]'),
    kod: row.kod,
    gorsel: row.gorsel_var ? `/api/gorsel/${row.id}?v=${row.surum}` : null,
  };
}

export const PART_COLUMNS = 'id, kategori, ad, marka, uyumlu, oem, kod, surum, gorsel IS NOT NULL AS gorsel_var';
