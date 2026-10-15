// Ürün kataloğu: filtre düğmeleri + arama + kartlar.
// Veriler assets/js/urunler.js dosyasındadır; bu dosyayı düzenlemeniz gerekmez.

(function () {
  const root = document.querySelector('[data-katalog]');
  if (!root) return;

  const kind = root.dataset.katalog;              // "kara-araclari" | "rayli-sistemler"
  const filterKey = kind === 'kara-araclari' ? 'marka' : 'tip';
  const items = (window.URUNLER && window.URUNLER[kind]) || [];

  const grid = root.querySelector('.product-grid');
  const count = root.querySelector('.catalog-count');
  const search = root.querySelector('input[type="search"]');
  const buttons = [...root.querySelectorAll('.seg button')];

  const params = new URLSearchParams(location.search);
  let filter = params.get('filtre') || 'Tümü';
  if (search && params.get('ara')) search.value = params.get('ara');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/[\s.\-]/g, '');
  const todo = (label) => `<span class="todo">${label}</span>`;
  const val = (v, label) => (v && String(v).trim() ? esc(v) : todo(label));

  function card(p) {
    const title = p.ad || '';
    const img = p.gorsel
      ? `<div class="media product-img"><img src="${esc(p.gorsel)}" alt="${esc(title)}" loading="lazy" width="400" height="300"></div>`
      : `<div class="photo product-img" role="img" aria-label="Fotoğraf alanı: ${esc(title)}"><p class="photo-cap"><b>FOTOĞRAF EKLENECEK</b></p></div>`;

    const tags = [p[filterKey]].filter(Boolean).map((t) => `<span class="tag" translate="no">${esc(t)}</span>`).join('')
      + (p.ornek ? todo('Örnek') : '');

    let rows;
    if (kind === 'kara-araclari') {
      const oem = (p.oem || []).filter((o) => o && o.trim());
      rows = `
        <dt>Model</dt><dd>${val(p.model, 'Model')}</dd>
        <dt>OEM No</dt><dd translate="no">${oem.length ? oem.map(esc).join('<br>') : todo('OEM no')}</dd>
        <dt>Ürün Kodu</dt><dd translate="no">${val(p.kod, 'Kod')}</dd>`;
    } else {
      rows = `
        <dt>Proje</dt><dd>${val(p.proje, 'Proje')}</dd>
        <dt>Parça Kodu</dt><dd translate="no">${val(p.kod, 'Kod')}</dd>`;
    }

    const ref = [p[filterKey], title, (p.oem || []).filter(Boolean).join(', ') || p.kod].filter(Boolean).join(' · ');
    const sektor = kind === 'kara-araclari' ? 'Kara Araçları' : 'Raylı Sistemler';
    const href = `iletisim.html?sektor=${encodeURIComponent(sektor)}&urun=${encodeURIComponent(ref)}#teklif`;

    return `<li class="product">
      ${img}
      <div class="product-body">
        <div class="product-tags">${tags}</div>
        <h3>${val(title, 'Parça adı')}</h3>
        <dl>${rows}</dl>
        <a class="text-link" href="${href}">Teklif İsteyin <span aria-hidden="true">→</span></a>
      </div>
    </li>`;
  }

  function render() {
    const q = norm(search ? search.value : '');
    const list = items.filter((p) => {
      if (filter !== 'Tümü' && p[filterKey] !== filter) return false;
      if (!q) return true;
      const hay = norm([p.ad, p.model, p.proje, p.kod, p[filterKey], ...(p.oem || [])].join(' '));
      return hay.includes(q);
    });

    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtre === filter)));
    count.textContent = `${list.length} parça gösteriliyor`;
    grid.innerHTML = list.length
      ? list.map(card).join('')
      : `<li class="catalog-empty"><strong>Bu aramaya uyan parça bulunamadı.</strong>Farklı bir parça adı veya OEM numarası deneyin ya da parçanızı bize sorun.</li>`;
    grid.style.gridTemplateColumns = list.length ? '' : '1fr';

    // Seçili filtre ve arama adres çubuğunda kalsın (bağlantı paylaşılabilsin)
    const u = new URL(location.href);
    filter === 'Tümü' ? u.searchParams.delete('filtre') : u.searchParams.set('filtre', filter);
    q ? u.searchParams.set('ara', search.value.trim()) : u.searchParams.delete('ara');
    history.replaceState(null, '', u);
  }

  buttons.forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filtre; render(); }));
  if (search) search.addEventListener('input', render);
  render();
})();
