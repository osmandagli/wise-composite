// Yönetim paneli (admin.html). Sunucu tarafı: worker/admin.js

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/[\s.\-]/g, '');

  const MESAJ = {
    password: 'Şifre yanlış. Lütfen tekrar deneyin.',
    locked: 'Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.',
    config: 'Yönetim paneli henüz kurulmamış (ADMIN_PASSWORD ayarlanmamış).',
    invalid: 'Lütfen parçanın adını yazın.',
    'photo-size': 'Fotoğraf çok büyük. Lütfen başka bir fotoğraf seçin.',
    'photo-type': 'Bu dosya bir fotoğraf değil. JPG veya PNG seçin.',
    notfound: 'Bu parça bulunamadı, başka biri silmiş olabilir. Sayfayı yenileyin.',
  };
  const genelHata = 'Bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.';

  let parcalar = [];
  let kategori = 'kara-araclari';
  let duzenlenen = null;     // düzenlenen parça (yeni parçada null)
  let yeniFoto = null;       // küçültülmüş Blob
  let fotoSil = false;

  // ---------- Sunucu ----------
  async function api(path, opts = {}) {
    const res = await fetch(`/api/admin/${path}`, {
      ...opts,
      headers: { 'X-WC-Admin': '1', ...(opts.headers || {}) },
      credentials: 'same-origin',
    });
    const out = await res.json().catch(() => ({ ok: false }));
    if (res.status === 401 && out.error === 'auth') { goster('giris'); throw new Error('auth'); }
    if (!out.ok) throw new Error(out.error || 'server');
    return out;
  }

  function goster(ekran) {
    $('giris').hidden = ekran !== 'giris';
    $('panel').hidden = ekran !== 'panel';
    $('oturum-dugmeleri').hidden = ekran !== 'panel';
    if (ekran === 'giris') setTimeout(() => $('sifre').focus(), 0);
  }

  let toastTimer;
  function bildir(metin) {
    const t = $('bildirim');
    t.textContent = metin;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  // ---------- Giriş / çıkış ----------
  $('giris-formu').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hata = $('giris-hata');
    hata.hidden = true;
    const btn = e.submitter;
    btn.disabled = true;
    try {
      await api('giris', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sifre: $('sifre').value }) });
      $('sifre').value = '';
      await yukle();
      goster('panel');
    } catch (err) {
      hata.textContent = MESAJ[err.message] || genelHata;
      hata.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  $('cikis').addEventListener('click', async () => {
    await api('cikis', { method: 'POST' }).catch(() => {});
    goster('giris');
  });

  // ---------- Liste ----------
  async function yukle() {
    parcalar = (await api('parcalar')).urunler;
    ciz();
  }

  function ciz() {
    document.querySelectorAll('.admin-tabs button').forEach((b) => {
      const k = b.dataset.kategori;
      b.setAttribute('aria-pressed', String(k === kategori));
      b.querySelector('.count').textContent = `(${parcalar.filter((p) => p.kategori === k).length})`;
    });
    const q = norm($('ara').value);
    const liste = parcalar.filter((p) => p.kategori === kategori
      && (!q || norm([p.ad, p.kod, p.marka, ...p.uyumlu, ...p.oem].join(' ')).includes(q)));

    $('liste').innerHTML = liste.length ? liste.map((p) => `
      <li class="part-row">
        ${p.gorsel ? `<img class="part-thumb" src="${esc(p.gorsel)}" alt="">` : '<div class="part-thumb none">Fotoğraf yok</div>'}
        <div class="part-info">
          <strong>${esc(p.ad)}</strong>
          ${p.marka || p.uyumlu.length ? `<div class="product-tags">${[p.marka, ...p.uyumlu].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          <span class="part-meta">${p.oem.length ? `OEM: ${p.oem.map(esc).join(', ')}` : 'OEM yok'}${p.kod ? ` · Kod: ${esc(p.kod)}` : ''}</span>
        </div>
        <div class="part-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-duzenle="${p.id}">Düzenle</button>
          <button type="button" class="btn btn-ghost btn-sm btn-danger" data-sil="${p.id}">Sil</button>
        </div>
      </li>`).join('')
      : `<li class="list-empty">${q ? 'Aramaya uyan parça yok.' : 'Bu sayfada henüz parça yok. “+ Yeni Parça Ekle” ile başlayın.'}</li>`;
  }

  document.querySelectorAll('.admin-tabs button').forEach((b) => b.addEventListener('click', () => { kategori = b.dataset.kategori; ciz(); }));
  $('ara').addEventListener('input', ciz);

  $('liste').addEventListener('click', async (e) => {
    const d = e.target.closest('[data-duzenle]');
    if (d) return ac(parcalar.find((p) => p.id === Number(d.dataset.duzenle)));
    const s = e.target.closest('[data-sil]');
    if (!s) return;
    const p = parcalar.find((x) => x.id === Number(s.dataset.sil));
    if (!confirm(`“${p.ad}” silinsin mi?\n\nBu parça sitedeki listeden kaldırılır. Bu işlem geri alınamaz.`)) return;
    try {
      await api(`parcalar/${p.id}`, { method: 'DELETE' });
      parcalar = parcalar.filter((x) => x.id !== p.id);
      ciz();
      bildir('Parça silindi.');
    } catch (err) {
      if (err.message !== 'auth') alert(MESAJ[err.message] || genelHata);
    }
  });

  // ---------- Ekle / düzenle ----------
  const form = $('parca-formu');
  const dialog = $('duzen');

  function oemSatiri(deger = '') {
    const div = document.createElement('div');
    div.className = 'oem-item';
    div.innerHTML = `<input type="text" maxlength="80" spellcheck="false" aria-label="OEM numarası" placeholder="Örn: A 940 666 01 01">
      <button type="button" class="btn btn-ghost btn-sm" aria-label="Bu OEM numarasını sil">Sil</button>`;
    div.querySelector('input').value = deger;
    div.querySelector('button').addEventListener('click', () => {
      div.remove();
      if (!$('oem-listesi').children.length) oemSatiri();
    });
    $('oem-listesi').append(div);
    return div.querySelector('input');
  }
  $('oem-ekle').addEventListener('click', () => oemSatiri().focus());

  function kategoriAlanlari() {
    const kara = form.kategori.value === 'kara-araclari';
    form.querySelectorAll('.only-kara').forEach((el) => { el.hidden = !kara; });
  }
  form.querySelectorAll('[name="kategori"]').forEach((r) => r.addEventListener('change', kategoriAlanlari));

  function digerMarka() {
    const diger = form['marka-secim'].value === 'diger';
    $('p-marka-diger').hidden = !diger;
    if (diger) $('p-marka-diger').focus();
  }
  form.querySelectorAll('[name="marka-secim"]').forEach((r) => r.addEventListener('change', digerMarka));

  const modeller = () => $('p-uyumlu').value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  function modelOnizleme() {
    $('uyumlu-onizleme').innerHTML = modeller().map((m) => `<span class="tag">${esc(m)}</span>`).join('');
  }
  $('p-uyumlu').addEventListener('input', modelOnizleme);

  function fotoGoster(src) {
    $('foto-onizleme').innerHTML = src ? `<img src="${esc(src)}" alt="Seçilen fotoğraf">` : '<span>Fotoğraf yok</span>';
    $('foto-kaldir').hidden = !src;
  }

  function ac(p) {
    duzenlenen = p || null;
    yeniFoto = null;
    fotoSil = false;
    form.reset();
    $('parca-hata').hidden = true;
    $('duzen-baslik').textContent = p ? 'Parçayı Düzenle' : 'Yeni Parça';
    form.kategori.value = p ? p.kategori : kategori;
    $('p-ad').value = p ? p.ad : '';
    const bilinen = ['MAN', 'Mercedes-Benz'];
    if (p && p.marka) {
      form['marka-secim'].value = bilinen.includes(p.marka) ? p.marka : 'diger';
      $('p-marka-diger').value = bilinen.includes(p.marka) ? '' : p.marka;
    }
    $('p-marka-diger').hidden = form['marka-secim'].value !== 'diger';
    $('p-uyumlu').value = p ? p.uyumlu.join(', ') : '';
    $('p-kod').value = p ? p.kod : '';
    $('oem-listesi').innerHTML = '';
    (p && p.oem.length ? p.oem : ['']).forEach((o) => oemSatiri(o));
    fotoGoster(p && p.gorsel);
    kategoriAlanlari();
    modelOnizleme();
    dialog.showModal();
    $('p-ad').focus();
  }
  $('yeni').addEventListener('click', () => ac(null));
  dialog.querySelectorAll('[data-kapat]').forEach((b) => b.addEventListener('click', () => dialog.close()));

  // Fotoğrafı tarayıcıda küçült (en uzun kenar 1200 px, JPEG): telefon fotoğrafları da sorunsuz yüklenir
  async function kucult(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const oran = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * oran);
    canvas.height = Math.round(bmp.height * oran);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';                     // şeffaf PNG'ler beyaz zemine otursun
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  }

  $('p-foto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      yeniFoto = await kucult(file);
      fotoSil = false;
      fotoGoster(URL.createObjectURL(yeniFoto));
    } catch {
      $('parca-hata').textContent = MESAJ['photo-type'];
      $('parca-hata').hidden = false;
    }
    e.target.value = '';
  });
  $('foto-kaldir').addEventListener('click', () => { yeniFoto = null; fotoSil = true; fotoGoster(null); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hata = $('parca-hata');
    hata.hidden = true;
    const ad = $('p-ad').value.trim();
    if (!ad) {
      hata.textContent = MESAJ.invalid;
      hata.hidden = false;
      $('p-ad').focus();
      return;
    }

    const fd = new FormData();
    fd.set('kategori', form.kategori.value);
    fd.set('ad', ad);
    const secim = form['marka-secim'].value;
    fd.set('marka', secim === 'diger' ? $('p-marka-diger').value.trim() : secim);
    modeller().forEach((m) => fd.append('uyumlu', m));
    $('oem-listesi').querySelectorAll('input').forEach((i) => { if (i.value.trim()) fd.append('oem', i.value.trim()); });
    fd.set('kod', $('p-kod').value.trim());
    if (yeniFoto) fd.set('gorsel', yeniFoto, 'parca.jpg');
    if (fotoSil) fd.set('gorsel_sil', '1');

    const btn = $('kaydet');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor…';
    try {
      const { urun } = await api(duzenlenen ? `parcalar/${duzenlenen.id}` : 'parcalar', { method: duzenlenen ? 'PUT' : 'POST', body: fd });
      parcalar = duzenlenen ? parcalar.map((p) => (p.id === urun.id ? urun : p)) : [urun, ...parcalar];
      kategori = urun.kategori;
      $('ara').value = '';
      ciz();
      dialog.close();
      bildir(duzenlenen ? 'Değişiklikler kaydedildi. Sitede görünüyor.' : 'Parça eklendi. Sitede görünüyor.');
    } catch (err) {
      if (err.message === 'auth') { dialog.close(); return; }
      hata.textContent = MESAJ[err.message] || genelHata;
      hata.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kaydet';
    }
  });

  // ---------- Başlangıç ----------
  api('oturum')
    .then(() => yukle())
    .then(() => goster('panel'))
    .catch((err) => {
      if (err.message === 'auth') return;
      goster('giris');
      $('giris-hata').textContent = MESAJ[err.message] || genelHata;
      $('giris-hata').hidden = false;
    });
})();
