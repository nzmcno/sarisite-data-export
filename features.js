// features.js - The switchboard. Every optional feature is listed here and starts off.
// Nothing below runs or contacts a server until its switch is turned on.
// None of them asks for a permission at switch-on: a browser prompt closes the popup and loses the click.

const FEATURE_GROUPS = [
  { id: 'data', title: 'Veri' },
  { id: 'workspace', title: 'Çalışma alanı' },
  { id: 'browsing', title: 'Gezinirken' },
  { id: 'requests', title: 'Siteye ek istek gönderenler' }
];

const FEATURES = [
  { id: 'liveRates', where: 'Sayfa bölümü, Sepet ve CSV', group: 'data', risk: 'low', title: 'Canlı kurlar', desc: 'Fiyatı dolar, euro, sterlin ve gram altın olarak gösterir. Yalnızca kur servislerine istek atar, ilan bilgisi göndermez.' },
  { id: 'manualRates', where: 'Bu ekranda ve canlı kurların yerine', group: 'data', risk: 'low', title: 'Elle kur', desc: 'Canlı kur yerine kendi girdiğin kuru kullanır.' },
  { id: 'extraData', where: 'İlan sayfası, Detay satırı ve CSV', group: 'data', risk: 'low', title: 'Ek ilan verisi', desc: 'Mağaza adı, yetki belge no, üyelik tarihi, video ve sanal tur bilgisini dışa aktarır.' },
  { id: 'computedFields', where: 'İlan sayfası, Detay satırı ve CSV', group: 'data', risk: 'low', title: 'Hesaplanan alanlar', desc: 'İlan yaşı, net/brüt oranı, m² başına aidat, ortalama yıllık KM, emsal inşaat alanı gibi alanları ekler.' },

  { id: 'notesTags', where: 'Sepet, her ilanın Detay satırı', group: 'workspace', risk: 'low', title: 'Not, etiket, puan', desc: 'İlanlara kendi notunu, etiketini ve puanını ekler.' },
  { id: 'basketFilters', where: 'Sepet, tablonun üstü', group: 'workspace', risk: 'low', title: 'Filtre ve sıralama', desc: 'Sepeti arar, filtreler ve sütuna göre sıralar.' },
  { id: 'dealScore', where: 'Sepet ve Analiz', group: 'workspace', risk: 'low', title: 'Fırsat puanı', desc: 'İlanları senin belirlediğin ağırlıklarla 0-100 arası puanlar. Tavsiye değil, sepetteki verilerle yapılan bir karşılaştırmadır.' },
  { id: 'charts', where: 'Analiz', group: 'workspace', risk: 'low', title: 'Grafikler', desc: 'Fiyat dağılımı ile fiyat-KM ve fiyat-m² grafiklerini çizer.' },
  { id: 'columnPresets', where: 'Veri ve yedek', group: 'workspace', risk: 'low', title: 'Hazır sütun setleri', desc: 'Emlak, arsa ve vasıta için tek tıkla sütun seçer.' },
  { id: 'tsvCopy', where: 'Sepet, üstteki düğmeler', group: 'workspace', risk: 'low', title: 'Tablo olarak kopyala', desc: 'Sepeti Google Sheets veya Excel’e yapıştırmak için panoya kopyalar.' },
  { id: 'mapExport', where: 'Sepet, üstteki düğmeler', group: 'workspace', risk: 'low', title: 'Harita dosyası', desc: 'Konumu olan ilanları KML ve GeoJSON olarak indirir.' },
  { id: 'tkgm', where: 'İlan sayfası ve Detay satırı', group: 'workspace', risk: 'low', title: 'TKGM kısayolu', desc: 'İlandaki il, ilçe, mahalle, ada ve parselden TKGM linkini kurar, parseli haritada açar. Mahalle kodunu öğrenmek için TKGM servisine istek atar, sahibinden sitesine istek atmaz.' },
  { id: 'backup', where: 'Veri ve yedek', group: 'workspace', risk: 'low', title: 'Yedekle ve geri yükle', desc: 'Sepeti, notları ve kayıtlı aramaları dosyaya alır, dosyadan geri yükler.' },
  { id: 'snapshots', where: 'Sayfa bölümü ve Kayıtlı aramalar', group: 'workspace', risk: 'low', title: 'Kayıtlı aramalar', desc: 'Açık liste sayfasını kaydeder. Tekrar kaydettiğinde yeni, kaybolan ve fiyatı değişen ilanları gösterir.' },

  { id: 'autoSaveListings', where: 'Sepet, ilan açtıkça', group: 'browsing', risk: 'medium', title: 'Açtığım ilanları kaydet', desc: 'Açtığın her ilan sayfasını sepete ekler. Ek istek atmaz ama her ilan sayfasında kod çalıştırır.' },
  { id: 'autoAddPages', where: 'Sepet, liste açtıkça', group: 'browsing', risk: 'medium', title: 'Gezdiğim listeleri kaydet', desc: 'Açtığın her liste sayfasını sepete ekler. Ek istek atmaz ama her liste sayfasında kod çalıştırır.' },

  { id: 'readWithoutOpening', where: 'Deneysel ve Araç bölümü', group: 'requests', risk: 'high', session: true, title: 'İlanı açmadan oku', desc: 'Açık listedeki ilanları sekme açmadan okur. Araç bölümünde ilanlar tek tek okunur.' },
  { id: 'autoPagination', where: 'Deneysel', group: 'requests', risk: 'high', session: true, title: 'Sonraki sayfaları oku', desc: 'Açık aramanın sonraki sayfalarını okuyup sepete ekler.' },
  { id: 'bulkPriceHistory', where: 'Deneysel', group: 'requests', risk: 'high', session: true, title: 'Toplu fiyat geçmişi', desc: 'Sitenin kendi iç servisinden fiyat geçmişi ister. Testte bu çağrıdan hemen sonra doğrulama sayfası çıktı, en riskli özellik budur.' },
  { id: 'savedSearchCheck', where: 'Arka planda, bildirimle', group: 'requests', risk: 'high', title: 'Kayıtlı aramaları arka planda kontrol et', desc: '6 saatte bir, sahibinden sekmesi açıksa en fazla 3 kayıtlı aramayı okur ve yeni ilan veya fiyat düşüşünü bildirir. Kayıtlı aramaları da açar.', requires: ['snapshots'] }
];

const RISK_LABELS = { low: 'Düşük risk', medium: 'Orta risk', high: 'Yüksek risk' };

function getFeature(id) {
  return FEATURES.find((feature) => feature.id === id);
}

/** Only an explicit true counts, so a missing or corrupted setting always reads as off */
function normalizeFeatures(stored) {
  const result = {};
  FEATURES.forEach((feature) => {
    result[feature.id] = !!stored && stored[feature.id] === true;
  });
  return result;
}

async function loadFeatures() {
  const { features = {} } = await chrome.storage.local.get('features');
  const { sessionFeatures = {} } = await chrome.storage.session.get('sessionFeatures');
  const merged = { ...features };
  // Session switches never read the saved value, so they are off after every browser restart
  FEATURES.filter((feature) => feature.session).forEach((feature) => {
    merged[feature.id] = sessionFeatures[feature.id];
  });
  return normalizeFeatures(merged);
}

async function saveFeature(id, on) {
  const feature = getFeature(id);
  if (!feature) return;
  const area = feature.session ? chrome.storage.session : chrome.storage.local;
  const key = feature.session ? 'sessionFeatures' : 'features';
  const stored = (await area.get(key))[key] || {};
  stored[id] = on === true;
  await area.set({ [key]: stored });
}

async function resetAllFeatures() {
  await chrome.storage.local.set({ features: {} });
  await chrome.storage.session.set({ sessionFeatures: {} });
}

if (typeof module !== 'undefined') {
  module.exports = { FEATURES, FEATURE_GROUPS, RISK_LABELS, getFeature, normalizeFeatures };
}
