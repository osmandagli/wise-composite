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

// İletişim formu (yalnızca iletisim.html)
// Form /api/iletisim adresine gider; worker/index.js e-postayı info@wisecomposite.com.tr adresine iletir.
const form = document.getElementById('iletisim-formu');
if (form) {
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const say = (msg) => { status.textContent = msg; status.hidden = false; };
  const errors = {
    captcha: 'Doğrulama tamamlanamadı. Lütfen "insan olduğunuzu doğrulayın" kutusunu işaretleyip tekrar deneyin.',
    file: 'Dosya 10 MB\'tan büyük olamaz.',
    invalid: 'Lütfen ad soyad, e-posta ve açıklama alanlarını doldurun ve KVKK onay kutusunu işaretleyin.',
  };
  const fallback = 'Mesajınız gönderilemedi. Lütfen info@wisecomposite.com.tr adresine e-posta gönderin veya 0540 308 10 10 numarasından bize ulaşın.';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll('[required]').forEach((el) => el.setAttribute('aria-invalid', String(!el.checkValidity())));
    if (!form.checkValidity()) {
      say(errors.invalid);
      form.reportValidity();
      return;
    }
    const file = document.getElementById('f-file').files[0];
    if (file && file.size > 10 * 1024 * 1024) { say(errors.file); return; }

    button.disabled = true;
    say('Gönderiliyor…');
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        say('Teşekkürler, mesajınız bize ulaştı. En kısa sürede dönüş yapacağız.');
        form.reset();
      } else {
        say(errors[out.error] || fallback);
      }
    } catch {
      say(fallback);
    } finally {
      button.disabled = false;
      if (window.turnstile) window.turnstile.reset();
    }
  });
  form.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid')) e.target.setAttribute('aria-invalid', String(!e.target.checkValidity()));
  });
}
