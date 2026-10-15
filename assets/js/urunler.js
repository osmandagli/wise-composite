// ============================================================
// ÜRÜN LİSTESİ
// Kara Araçları ve Raylı Sistemler sayfalarındaki kataloglar bu dosyadan oluşur.
//
// Yeni parça eklemek için ilgili listeye bir satır daha ekleyin:
//   - gorsel: parçanın fotoğrafı. Dosyayı assets/img/urunler/ klasörüne koyun.
//             Fotoğraf yoksa gorsel satırını silin, kartta desen görünür.
//   - ornek: true olan satırlar ÖRNEK'tir. Gerçek parçalar girilince silin.
//
// Kara Araçları alanları:
//   marka  : "MAN" veya "Mercedes-Benz" (filtre düğmeleri bu adlarla çalışır)
//   ad     : parçanın adı
//   model  : uyumlu araç modeli/serisi
//   oem    : OEM numaraları (birden fazla olabilir)
//   kod    : Wise Composite ürün kodu
//
// Raylı Sistemler alanları:
//   tip    : "Tramvay", "Metro" veya "Tren"
//   ad     : parçanın adı
//   proje  : araç / proje / işletme adı
//   kod    : parça kodu
// ============================================================

window.URUNLER = {
  'kara-araclari': [
    { ornek: true, marka: 'MAN', ad: 'Basamak Paneli', model: '', oem: [''], kod: '' },
    { ornek: true, marka: 'MAN', ad: 'Çamurluk Uzatması', model: '', oem: [''], kod: '' },
    { ornek: true, marka: 'MAN', ad: 'Kapı Alt Paneli', model: '', oem: [''], kod: '' },
    { ornek: true, marka: 'Mercedes-Benz', ad: 'Basamak Paneli', model: '', oem: [''], kod: '' },
    { ornek: true, marka: 'Mercedes-Benz', ad: 'Tampon Köşe Parçası', model: '', oem: [''], kod: '' },
    { ornek: true, marka: 'Mercedes-Benz', ad: 'Çamurluk Uzatması', model: '', oem: [''], kod: '' },
  ],

  'rayli-sistemler': [
    { ornek: true, tip: 'Tramvay', ad: 'Dış Gövde Paneli', proje: '', kod: '' },
    { ornek: true, tip: 'Tramvay', ad: 'Servis Kapağı', proje: '', kod: '' },
    { ornek: true, tip: 'Metro', ad: 'İç Gövde Paneli', proje: '', kod: '' },
    { ornek: true, tip: 'Metro', ad: 'Kapak', proje: '', kod: '' },
    { ornek: true, tip: 'Tren', ad: 'Dış Gövde Paneli', proje: '', kod: '' },
  ],
};
