// Ürün kataloğu: arama + kartlar.
// Parçalar yönetim panelinden (admin.html) eklenir ve /api/urunler adresinden okunur.

(function () {
  const root = document.querySelector('[data-katalog]');
  if (!root) return;

  const kind = root.dataset.katalog;              // "kara-araclari" | "rayli-sistemler"
  const grid = root.querySelector('.product-grid');
  const count = root.querySelector('.catalog-count');
  const search = root.querySelector('input[type="search"]');
  let items = [];

  const params = new URLSearchParams(location.search);
  if (search && params.get('ara')) search.value = params.get('ara');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/[\s.\-]/g, '');
  const empty = (title, text) => `<li class="catalog-empty"><strong>${title}</strong>${text}</li>`;

  function card(p) {
    const img = p.gorsel
      ? `<div class="media product-img"><img src="${esc(p.gorsel)}" alt="${esc(p.ad)}" loading="lazy" width="400" height="300"></div>`
      : `<div class="photo product-img" aria-hidden="true"></div>`;
    const tags = [p.marka, ...p.uyumlu].filter(Boolean).map((t) => `<span class="tag" translate="no">${esc(t)}</span>`).join('');
    const rows = [
      p.oem.length ? `<dt>OEM No</dt><dd translate="no">${p.oem.map(esc).join('<br>')}</dd>` : '',
      p.kod ? `<dt>Ürün Kodu</dt><dd translate="no">${esc(p.kod)}</dd>` : '',
    ].join('');

    return `<li class="product">
      ${img}
      <div class="product-body">
        ${tags ? `<div class="product-tags">${tags}</div>` : ''}
        <h3>${esc(p.ad)}</h3>
        ${rows ? `<dl>${rows}</dl>` : ''}
      </div>
    </li>`;
  }

  function render() {
    const q = norm(search ? search.value : '');
    const shown = items.filter((p) => !q || norm([p.ad, p.kod, p.marka, ...p.uyumlu, ...p.oem].join(' ')).includes(q));

    count.textContent = items.length ? `${shown.length} parça gösteriliyor` : '';
    grid.innerHTML = shown.length
      ? shown.map(card).join('')
      : items.length
        ? empty('Bu aramaya uyan parça bulunamadı.', 'Farklı bir parça adı veya OEM numarası deneyin ya da parçanızı bize sorun.')
        : empty('Katalog hazırlanıyor.', 'Aradığınız parça için bize telefon veya WhatsApp üzerinden ulaşabilirsiniz.');
    grid.style.gridTemplateColumns = shown.length ? '' : '1fr';

    // Arama adres çubuğunda kalsın (bağlantı paylaşılabilsin)
    const u = new URL(location.href);
    q ? u.searchParams.set('ara', search.value.trim()) : u.searchParams.delete('ara');
    history.replaceState(null, '', u);
  }

  if (search) search.addEventListener('input', render);
  count.textContent = 'Parçalar yükleniyor…';
  fetch(`/api/urunler?kategori=${kind}`)
    .then((r) => r.json())
    .then((out) => {
      if (!out.ok) throw new Error(out.error);
      items = out.urunler;
      render();
    })
    .catch(() => {
      count.textContent = '';
      grid.innerHTML = empty('Parça listesi şu anda yüklenemedi.', 'Lütfen sayfayı yenileyin ya da bize telefon veya WhatsApp üzerinden ulaşın.');
      grid.style.gridTemplateColumns = '1fr';
    });
})();
