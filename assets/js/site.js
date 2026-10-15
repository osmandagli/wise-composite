// WISE COMPOSITE · tüm sayfalarda çalışan ortak kod

// Mobil menü
const toggle = document.getElementById('nav-toggle');
const links = document.getElementById('nav-links');
if (toggle && links) {
  const closeMenu = () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Menü';
  };
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Kapat' : 'Menü';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('open')) {
      closeMenu();
      toggle.focus();
    }
  });
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu();
  });
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

// Teklif formu (yalnızca iletisim.html)
// TODO: Form henüz bir e-posta adresine veya sunucuya bağlı değil.
const form = document.getElementById('teklif');
if (form) {
  const status = document.getElementById('form-status');

  // Katalogdaki "Teklif İsteyin" bağlantısından gelindiyse parçayı mesaja yaz
  const params = new URLSearchParams(location.search);
  const urun = params.get('urun');
  const sektor = params.get('sektor');
  if (urun) document.getElementById('f-message').value = `Teklif istediğim parça: ${urun}\n`;
  if (sektor) {
    const select = document.getElementById('f-sector');
    const match = [...select.options].find((o) => o.value === sektor);
    if (match) select.value = sektor;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('[required]').forEach((el) => el.setAttribute('aria-invalid', String(!el.checkValidity())));
    if (!form.checkValidity()) {
      status.textContent = 'Lütfen ad soyad, e-posta ve açıklama alanlarını doldurun ve KVKK onay kutusunu işaretleyin.';
      status.hidden = false;
      form.reportValidity();
      return;
    }
    status.textContent = 'Teşekkürler, talebiniz alındı. (Taslak: form henüz bir e-posta adresine bağlı değil.)';
    status.hidden = false;
    form.reset();
  });
  form.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid')) e.target.setAttribute('aria-invalid', String(!e.target.checkValidity()));
  });
}
