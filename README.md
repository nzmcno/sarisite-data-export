# Sahibinden İlan Veri İndirici - CSV Excel ve Görsel İndirme

🚀 **Profesyonel Chrome Uzantısı** - Sahibinden.com ilanlarını CSV ve JSON olarak indirin. Görselleri kaydedin. Türkçe karakter desteği ile tam uyumlu.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Uzantı-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/Sürüm-1.7.0-success?style=for-the-badge)](https://github.com/your-username/sahibinden-data-exporter)
[![License](https://img.shields.io/badge/Lisans-MIT-blue?style=for-the-badge)](LICENSE)

## 🎯 Kimler İçin Mükemmel

- **Pazar Araştırması**: Fiyat trendleri ve pazar verilerini analiz edin
- **İş Zekası**: Rakip ilanları ve pazar analizini dışa aktarın
- **Data Backup**: Save your own listings for records
- **Academic Research**: Gather data for economic studies
- **Real Estate Analysis**: Track property market trends
- **Image Collection**: Toplu görsel indirme ve arşivleme

## 🚀 Features

### 📊 Veri İndirme

- **Generic Extraction**: Columns and fields come from the page's own headers and labels, so every category works without category-specific code
- **All Page Views**: Classic, list and gallery result views, plus single listing pages
- **CSV and JSON**: Export the current page or the basket
- **Formula Protection**: Cells such as `=ADRES=...` can't run as spreadsheet formulas
- **Clean Values**: Numeric prices, currency column, ISO dates, calculated price per m²
- **Page Check**: Warns when the page isn't supported or the site shows a verification page

### 🧺 Sepet

- **Multi-Page Basket**: Add each page you browse; duplicates are removed by listing number
- **Mixed Categories**: Columns adapt, so cars and land can share one export
- **Price Tracking**: Re-adding a listing records price changes
- **Stats**: Minimum, median and maximum for price and every numeric field
- **Compare**: Side-by-side view of selected listings
- **Column Picker**: Choose which columns the basket CSV includes

### 🖼️ Görsel İndirme

- **Listing Photos**: On a listing page, all full-size gallery photos, named `ilanNo_01.jpg`
- **List Thumbnails**: On a results page, only listing images, without ads and icons
- **Other Sites**: Full image scan grouped by size and type
- **Paced Downloads**: One file at a time, and it continues if the popup closes

### Yan Panel

Eklenti simgesine tıklayınca yan panel açılır ve sekme değiştirsen de açık kalır. Tarayıcılar yan panelin tıklama olmadan açılmasına izin vermez, bu yüzden her pencerede ilk açılış için simgeye bir kez tıklamak gerekir. Küçük pencere ile aynı ekrandır: Sayfa, Araç, Emlak, Görsel, Sepet, Deneysel ve Ayarlar. İstersen Ayarlar'daki **Simgeye tıklayınca** seçeneğinden küçük pencereye geçebilirsin.

### Araç İlanları

Araç raporu her araç ilanında çalışır, düğmesi yoktur. Yalnızca açık sayfanın zaten taşıdığı veriyi okur, siteye ek istek göndermez.

- **Hasar şeması:** Değişen, boyalı ve lokal boyalı parçalar harita gibi çizilir ve sayılır.
- **Satıcının açıklaması:** Şase, podye, direk, airbag, KM, tramer, muayene, ekspertiz ve bakım geçen cümleler satıcının kendi sözleriyle gösterilir. Eklenti bunları yorumlamaz.
- **Kendi kelimelerin:** Çalışma alanındaki Araç bölümünden aranacak kelime ekleyebilirsin. Her kelime rapora ve CSV'ye ayrı sütun olarak girer.
- **Teknik veriler:** Motor, yakıt, boyut ve model donanımı. Bunlar modelin genel verileridir, o araca özel olmayabilir.
- **Araç bölümü:** Sepetteki araçlar seri özetiyle listelenir, seriye ve hasara göre süzülür; fiyat, KM, yıl ve hasara göre sıralanır.
- **Ortalama yıllık KM cümlesi:** "2016 model, 2026 itibarıyla 10 yılda 357.000 km yapmış. Yılda ortalama 35.700 km." Yalnızca model yılı, bugünün yılı ve ilandaki KM ile hesaplanır. Bu yılın aracında yazılmaz.
- **İlan açıklaması:** Tamamı saklanır ve CSV'ye girer. Ekranda ilk 400 karakter görünür, "Tamamını aç" ile hepsi açılır. Liste satırından okunmamış ilanın açıklaması ilan açılınca ya da Deneysel'deki yüksek riskli "İlanı açmadan oku" ile gelir.
- **Her yerde:** Araç raporu ve Araç bölümü yan panelde, küçük pencerede ve çalışma alanında aynıdır.

- **Kartlar:** Araçlar Marka, Seri, Model, Yıl, KM, Renk, Fiyat, İlan Tarihi ve İl / İlçe ile listelenir. Site bir sütunu listede göstermiyorsa o alan ilan sayfası okunana kadar boş kalır.
- **Fotoğraf:** Her ilanın bir fotoğrafı büyük gösterilir, indirilebilir ve linki kopyalanabilir.
- **Kesin bilgiler:** Araç yaşı, toplam KM, ortalama yıllık KM, beygir başına fiyat, yayında geçen gün, ilk görülen fiyat, açıklamada yazıyorsa muayene tarihi ve tramer. Hepsi yayımlanmış rakamlardan hesaplanır ya da satıcının yazdığıdır, tahmin yoktur.

### Sepet

Sepetin tamamı yan panelde. İlan arayabilir, sıralayabilir, tür seçebilir, tümünü seçebilir, seçilenleri karşılaştırabilir, CSV veya JSON indirebilir, silebilir, CSV sütunlarını ayarlayabilir ve sepeti temizleyebilirsin. Temizlemeden önce panel içinde onay ister. Yalnızca grafikler ve fırsat puanı ağırlıkları çalışma alanında kaldı.

### Emlak İlanları

Emlak sekmesi açık sayfanın ya da sepetin emlak ilanlarını gösterir ve sitenin kategorilerine göre böler: Konut, İş Yeri, Arsa, Konut Projeleri, Bina, Turistik Tesis. Her tür kendi başlıklarını kullanır, listede olmayan alanlar uydurulmaz. m² fiyatı, net/brüt oranı ve açıklamada açıkça yazıyorsa kira ile geri dönüş süresi hesaplanır. Sitenin proje tanıtım sayfaları farklı bir düzendedir ve okunmaz.

### Telefon Numaraları

Satıcının açıklamaya yazdığı numaralar açıklamayla birlikte dışa aktarılır, ayrıca **Açıklamadaki Telefon** sütununa ayrılır. Sitenin şifreli tuttuğu telefon alanı okunmaz. Dışa aktardığın kişisel verilerin KVKK kapsamındaki sorumluluğu sana aittir.

### Ayarlar: İsteğe Bağlı Özellikler

Temel indirme ve sepet her zaman çalışır. Aşağıdakilerin **hepsi kapalı gelir**. Açmadığın özellik çalışmaz ve hiçbir yere istek atmaz. Bir düğmeyi açınca etkisi hemen görünür, ayrı izin penceresi çıkmaz. Tema Açık başlar, Ayarlar bölümünden Koyu veya Sistem seçebilirsin.

| Risk | Özellikler |
|---|---|
| Düşük | Canlı kurlar (dolar, euro, sterlin, gram altın), elle kur, ek ilan verisi, hesaplanan alanlar, not/etiket/puan, filtre ve sıralama, fırsat puanı, grafikler, hazır sütun setleri, tablo olarak kopyalama, KML/GeoJSON, TKGM'de parseli açma, yedekleme, kayıtlı aramalar |
| Orta | Açtığım ilanları kaydet, gezdiğim listeleri kaydet |
| Yüksek, **risk sana aittir** | İlanı açmadan oku, sonraki sayfaları oku, toplu fiyat geçmişi, kayıtlı aramaları arka planda kontrol et |

**Yüksek riskli özellikler** siteye ek istek gönderir. Site bunu otomasyon sayıp hesabını kısıtlayabilir, kullanım koşullarına da aykırı olabilir. Testte, sitenin iç fiyat geçmişi servisine yapılan tek bir çağrıdan hemen sonra kısa süreli bir doğrulama sayfası çıktı.

Sınırlar koda sabittir: çalışma başına 10 ilan veya 5 sayfa, tüm araçlar için toplam günde 50 istek, istekler arası 8 saniye. İlk hatada veya doğrulama sayfasında durur ve 1 saat bekler. Tekrar denemez, doğrulama çözmez, kendini gizlemez. Elle başlatılan araçlar tarayıcı yeniden başlayınca kendiliğinden kapanır.

## 📋 Supported Data Fields

From results pages:

- **Every column the page shows**: for example m², rooms, brand, model, year, KM, color, price per m²
- **Listing data**: number, title, price, currency, date, location, thumbnail, link, promoted and urgent flags

Additionally from listing pages:

- **Every info field**: for example heating, floor, zoning, parcel, engine, gear, warranty
- **Feature groups**: selected items per group
- **Vehicle damage**: changed, painted and locally painted parts, with notes
- **Description, full photo list, video flag, category path, map coordinates**
- **Optional:** store name, license number, membership date, video and tour badges, price history

Personal seller names and the phone field the site keeps encrypted are never read. Descriptions are copied as written, including any phone number the seller typed there.

## 🛠️ Installation

### From Chrome Web Store

_Coming soon..._

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will appear in your Chrome toolbar

## 🎯 Usage

### 📊 CSV Veri İndirme

1. **Navigate to Sahibinden.com**
   - Go to any results page or listing page, in any category
2. **Open the Extension**
   - Click the extension icon in your toolbar; the Sayfa tab shows what it found on the page
3. **Sayfa Tab**
   - **CSV indir** or **JSON** exports the current page
   - **Sepete ekle** keeps it for a multi-page export

4. **File Download**
   - Results page: `sahibinden_satilik-arsa_2026-11-04.csv`
   - Listing page: `sahibinden_ilan_1349494078_2026-11-04.csv`
   - Basket: `sahibinden_sepet_2026-11-04.csv`

### 🖼️ Görsel İndirme

1. **Görseller Tab'ına Geçin** ve "🔍 Sayfayı Tara" butonuna tıklayın
2. **Sonuçları İnceleyin**: ilan sayfasında tüm fotoğraflar, liste sayfasında ilan küçük resimleri gelir
3. **İndirin**: tüm grup, tek görsel veya "Hepsini İndir"

## 📊 Export Formats

### CSV Format

- **Encoding**: UTF-8 with BOM
- **Separator**: Semicolon (;) - Turkish Excel standard
- **Quote Protection**: All fields wrapped in quotes
- **Formula Protection**: Cells starting with `=`, `+`, `-` or `@` get a leading `'`
- **Current page**: Original columns first, new columns after `İlan Linki`

### Image Download Format

- **Listing page**: `sahibinden_ilanNo/ilanNo_01.jpg`
- **Pace**: One image every 0.7 seconds
- **Duplicate Prevention**: Same image URL downloaded only once per scan

## 🌍 Multi-Category Support

Works with all Sahibinden categories:

- 🚗 **Vehicles** (Cars, motorcycles, boats)
- 🏠 **Real Estate** (Sales, rentals)
- 📱 **Electronics** (Phones, computers, appliances)
- 👕 **Fashion** (Clothing, accessories)
- 🏠 **Home & Garden** (Furniture, decoration)
- 💼 **Services** (Jobs, education)
- And more...

## ⚙️ Technical Details

### Built With

- **Manifest V3**: Latest Chrome extension standard
- **Vanilla JavaScript**: No external dependencies
- **Modern CSS**: Responsive design with animations

### Browser Compatibility

- Chrome 88+
- Edge 88+
- Other Chromium-based browsers

### Permissions Required

- `activeTab`: Access current tab content
- `scripting`: Execute content scripts
- `downloads`: Save exported files
- `storage`: Keep the basket on your device
- `host_permissions`: Sahibinden.com access
- `sidePanel`: The extension's main screen
- `alarms`, `notifications`: Declared up front, unused until you turn on the saved search check

## 🔒 Privacy & Security

- **No Data Collection**: Nothing is sent to the developers, and no listing data leaves your device
- **Local Processing**: All data extraction happens locally
- **Local Storage**: The basket stays on your device until you clear it
- **Read-Only on the Page**: The extension adds nothing to the page it reads
- **Minimal Permissions**: Only requests necessary permissions

## 🐛 Troubleshooting

### Common Issues

**"No listings found"**

- Ensure you're on a Sahibinden search results page
- Check that listings are loaded (scroll down if needed)

**Turkish characters not displaying**

- Ensure you're opening the CSV with Turkish locale Excel

**Extension not working**

- Refresh the Sahibinden page
- Disable and re-enable the extension
- Check Chrome version compatibility

**Empty export file**

- Verify listings are visible on the page
- Try scrolling to load more results
- Check browser console for errors

## 🔧 Development

### Setup

```bash
git clone <repository-url>
cd sahibinden-csv-exporter
```

### File Structure

```
sahibinden-csv-exporter/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup interface
├── popup.js               # Popup behaviour
├── dashboard.html/.js     # Basket workspace, charts, saved searches, backup
├── compare.html/.js       # Side-by-side comparison page
├── ui.css, ui.js          # Shared design tokens, icons and helpers
├── features.js            # List of optional features, all off by default
├── extractor.js           # Read-only page extraction (injected on demand)
├── lib.js                 # CSV, basket, rates, stats and other data logic
├── background.js          # Paced downloads, basket writes, rates, guarded tools
├── tests/                 # node --test tests/lib.test.js tests/background.test.js
├── icons/                 # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── README.md              # This file
├── PRIVACY.md             # Privacy policy
└── DISCLAIMER.md          # Legal disclaimer
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Issues**: Report bugs or request features via GitHub Issues
- **Email**: [Your contact email]
- **Documentation**: Check this README for common solutions

## 🔄 Version History

### v1.8.0 (Current)

- The comparison with other listings of the same series is gone from the Sayfa, Araç and Sepet tabs and the workspace, with its sort option and column
- List rows no longer say how far a price is from the median
- Vehicles say how many km a year they have done, from the model year and this calendar year
- The description shows its first 400 characters with a "Tamamını aç" button, in the Sayfa, Araç and Sepet tabs and the workspace. Listings not read yet point to opening them or to "İlanı açmadan oku"
- The X search link is gone

### v1.7.0

- The whole basket is in the side panel: search, sort, select all, compare, CSV and JSON of a selection, remove, clear, CSV columns and backup
- Select all in the workspace basket
- Every export carries İlan Linki and İlan Fotoğraf Linki, and column presets keep them
- Fırsat Puanı left the CSV. It stays on screen

### v1.6.0

- New Emlak tab and workspace section, split by the site's property kinds
- Vehicle cards use the site's columns and show a photo with download and link
- Exact facts: price per km and per horsepower, written inspection date, rent payback
- Vehicle and Emlak tabs can show the open page or the basket

### v1.5.0

- The icon opens the side panel, with a setting to use the small window instead
- Side panel and small window are now one screen with the same tabs
- New Araç tab with the series summary, damage filters and search words

### v1.4.0

- Vehicle report on every car listing: damage diagram, seller's statements, technical data
- Workspace Araç section with a series summary, damage filters and price against the same series
- Redesigned side panel, with a searchable list on results pages
- Description parsing is always on, and phone numbers written in descriptions are exported
- Removed duplicate finding and phone masking

### v1.3.0

- Switches take effect immediately on every open page, with no permission prompt that closes the popup
- TKGM button opens the listing's parcel directly on the map
- Light theme by default, with a theme choice, and a redesigned workspace

### v1.2.0

- 24 optional features, all off by default, with a settings screen and risk labels
- Live price in dollars, euros, pounds and grams of gold
- Workspace page with filters, notes, charts, duplicates, saved searches and backup
- New interface across all pages, with light and dark modes

### v1.1.0

- Generic extraction for all categories, page views and listing pages
- Basket, price tracking, stats, comparison, column picker and JSON export
- Listing photo downloads, paced one at a time
- Optional, off-by-default experimental reader
- Formula protection; empty `m² Fiyatı` column fixed; nothing is added to the page anymore
- Excel export claim removed; it was never included

### v1.0.0

- Initial release
- CSV export functionality
- Turkish character support
- Dynamic column detection
- Modern UI design

## ⚖️ Legal

This extension is an independent tool and is not affiliated with, endorsed by, or connected to Sahibinden.com. Please review our [DISCLAIMER](DISCLAIMER.md) and [PRIVACY POLICY](PRIVACY.md) for more information.

---

**Made with ❤️ for the Turkish community**
