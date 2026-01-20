# Sahibinden İlan Veri İndirici - CSV Excel ve Görsel İndirme

🚀 **Profesyonel Chrome Uzantısı** - Sahibinden.com ilanlarını CSV ve Excel formatında indirin. Görselleri toplu olarak kaydedin. Türkçe karakter desteği ile tam uyumlu.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Uzantı-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/Sürüm-1.0.0-success?style=for-the-badge)](https://github.com/your-username/sahibinden-data-exporter)
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

- **Dual Format Export**: Download data in both CSV and Excel (XLSX) formats
- **Dynamic Column Detection**: Automatically adapts to different Sahibinden categories
- **Turkish Character Support**: Full UTF-8 encoding with BOM for proper display
- **Smart Data Extraction**: Handles images, links, prices, dates, and locations
- **Location Parsing**: Intelligently combines city/district information
- **Image URL Extraction**: Captures classified ad images
- **Direct Links**: Includes clickable links to original ads

### 🖼️ Görsel İndirme (YENİ!)

- **Otomatik Tarama**: Sayfadaki tüm görselleri otomatik olarak bulur
- **Background Image Desteği**: CSS background-image'ları da tarar
- **Akıllı Gruplama**: Görselleri boyut ve türe göre gruplar
- **Toplu İndirme**: Tüm grup veya tekli görselleri indirebilme
- **Batch Processing**: 5'er 5'er indirme ile tarayıcı performansını koruma
- **Format Desteği**: JPG, PNG, GIF, WEBP, SVG, AVIF
- **Organized Downloads**: Otomatik klasör oluşturma ve düzenli kaydetme

## 📋 Supported Data Fields

The extension automatically detects and exports:

- **Image URLs**: Thumbnail images from listings
- **Brand/Category Info**: Dynamic based on listing type
- **Title**: Complete ad titles
- **Specifications**: Year, mileage, color, etc. (varies by category)
- **Price**: Numerical values (formatted for Excel)
- **Date**: Publication dates
- **Location**: City/District or Neighborhood/Area
- **Direct Links**: URLs to original listings

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
   - Go to any search results page (cars, real estate, electronics, etc.)
2. **Open the Extension**
   - Click the extension icon in your Chrome toolbar
3. **CSV/Excel Tab**
   - Varsayılan olarak CSV/Excel tab'ı açıktır
   - **CSV Export**: Click "CSV İndir" for text-based format

4. **File Download**
   - Files are automatically downloaded to your default download folder
   - CSV files: `sahibinden_ilanlar.csv`

### 🖼️ Görsel İndirme (YENİ!)

1. **Görseller Tab'ına Geçin**
   - Extension'ı açın ve "🖼️ Görseller" tab'ına tıklayın

2. **Sayfayı Tarayın**
   - "🔍 Sayfayı Tara" butonuna tıklayın
   - Extension otomatik olarak:
     - Tüm `<img>` elementlerini bulur
     - CSS background-image'ları tarar
     - Görselleri boyut ve türe göre gruplar

3. **Sonuçları İnceleyin**
   - Bulunan görseller boyut gruplarına ayrılır
   - Her grup için:
     - Boyut bilgisi (örn: 300×200)
     - Görsel sayısı
     - Dosya formatı (JPG, PNG, vb.)
     - İlk 8 görsel önizlemesi

4. **İndirme Seçenekleri**
   - **Grup İndirme**: Her grubun sağ üstündeki "⬇️ İndir" butonuna tıklayın
   - **Tekli İndirme**: Görsel üzerine gelip küçük indirme butonuna tıklayın
   - Görseller otomatik olarak klasörlere düzenlenir: `sitename_images_timestamp/`

## 📊 Export Formats

### CSV Format

- **Encoding**: UTF-8 with BOM
- **Separator**: Semicolon (;) - Turkish Excel standard
- **Quote Protection**: All fields wrapped in quotes
- **Compatibility**: Opens correctly in Turkish Excel versions

### Image Download Format

- **Folder Structure**: `hostname_images_timestamp/timestamp_index.extension`
- **Batch Size**: 5 images per batch
- **Delay**: 300ms between batches (browser-friendly)
- **Supported Formats**: JPG, JPEG, PNG, GIF, WEBP, SVG, AVIF
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
- **Vanilla JavaScript**: No external dependencies for core functionality
- **SheetJS**: For Excel file generation
- **Modern CSS**: Responsive design with animations

### Browser Compatibility

- Chrome 88+
- Edge 88+
- Other Chromium-based browsers

### Permissions Required

- `activeTab`: Access current tab content
- `scripting`: Execute content scripts
- `downloads`: Save exported files
- `host_permissions`: Sahibinden.com access

## 🔒 Privacy & Security

- **No Data Collection**: Extension doesn't collect or store personal data
- **Local Processing**: All data extraction happens locally
- **No External Servers**: Direct browser-to-file export
- **Minimal Permissions**: Only requests necessary permissions

## 🐛 Troubleshooting

### Common Issues

**"No listings found"**

- Ensure you're on a Sahibinden search results page
- Check that listings are loaded (scroll down if needed)

**Turkish characters not displaying**

- For CSV: Ensure you're opening with Turkish locale Excel
- For Excel: Native Unicode support included

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
├── popup.js               # Main functionality
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

### v1.0.0 (Current)

- Initial release
- CSV and Excel export functionality
- Turkish character support
- Dynamic column detection
- Modern UI design

## ⚖️ Legal

This extension is an independent tool and is not affiliated with, endorsed by, or connected to Sahibinden.com. Please review our [DISCLAIMER](DISCLAIMER.md) and [PRIVACY POLICY](PRIVACY.md) for more information.

---

**Made with ❤️ for the Turkish community**
