// Wise Composite Worker. Yalnızca /api/* adresleri buraya gelir (wrangler.jsonc > run_worker_first);
// sayfalar ve görseller doğrudan statik dosyalardan sunulur.
//
//   /api/iletisim          İletişim formu → e-posta (iletisim.js)
//   /api/urunler           Sitedeki ürün kataloğu (urunler.js)
//   /api/gorsel/:id        Parça fotoğrafı (urunler.js)
//   /api/admin/*           Yönetim paneli (admin.js, admin.html)

import { handleContact } from './iletisim.js';
import { listPublic, servePhoto } from './urunler.js';
import { handleAdmin } from './admin.js';
import { json, ensureSchema } from './ortak.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/api/iletisim') {
        if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
        return await handleContact(request, env);
      }
      if (pathname.startsWith('/api/')) await ensureSchema(env);
      if (pathname === '/api/urunler' && request.method === 'GET') return await listPublic(request, env);
      const photo = pathname.match(/^\/api\/gorsel\/(\d+)$/);
      if (photo && request.method === 'GET') return await servePhoto(env, Number(photo[1]));
      if (pathname.startsWith('/api/admin/')) return await handleAdmin(request, env, pathname.slice('/api/admin/'.length));
      if (pathname.startsWith('/api/')) return json({ ok: false, error: 'notfound' }, 404);
    } catch (err) {
      console.error(err);
      return json({ ok: false, error: 'server' }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
