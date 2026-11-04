// Run with: node --test tests/lib.test.js
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../lib.js');

const page = {
  pageType: 'list',
  url: 'https://www.sahibinden.com/satilik-arsa/kocaeli-gebze-gebze',
  category: ['Emlak', 'Arsa'],
  columns: ['Resim', 'İlan Başlığı', 'm²', 'Fiyat', 'm² Fiyatı', 'İlan Tarihi', 'İl / İlçe'],
  rows: [{
    id: '1',
    url: 'https://www.sahibinden.com/ilan/1/detay',
    title: '=ADRES= ARSA',
    image: 'https://img/1.jpg',
    promoted: true,
    urgent: false,
    price: { amount: 5350000, currency: 'TL', raw: '5.350.000 TL' },
    dateRaw: '04 Kasım 2026',
    dateIso: '2026-11-04',
    cells: [
      { name: 'İlan Başlığı', kind: 'title', value: '=ADRES= ARSA' },
      { name: 'm²', kind: 'attribute', value: '215' },
      { name: 'Fiyat', kind: 'price', value: 5350000 },
      { name: 'm² Fiyatı', kind: 'unitPrice', value: 24884 },
      { name: 'İlan Tarihi', kind: 'date', value: '04 Kasım 2026' },
      { name: 'İl / İlçe', kind: 'location', value: 'Kocaeli / Gebze' }
    ]
  }]
};

const listing = {
  id: '9',
  url: 'https://www.sahibinden.com/ilan/9/detay',
  title: 'Golf',
  price: { amount: 1228000, currency: 'TL', raw: '1.228.000 TL' },
  dateRaw: '04 Kasım 2026',
  dateIso: '2026-11-04',
  category: ['Vasıta', 'Otomobil'],
  location: { raw: 'Bingöl / Solhan / Yeni Mah.', il: 'Bingöl', ilce: 'Solhan', mahalle: 'Yeni Mah.' },
  attributes: { KM: '104.500', 'Yıl': '2022', 'Motor Hacmi': '999 cc' },
  features: { 'Güvenlik': ['ABS', 'ESP'], 'Multimedya': [] },
  damage: { changed: ['front-hood'], painted: [], localPainted: [], originalCount: 12, notes: ['Değişen Parçalar'] },
  description: 'Satırlı\naçıklama',
  photos: ['https://img/a.jpg', 'https://img/b.jpg'],
  lat: '38.9',
  lon: '41.0',
  hasVideo: false
};

test('formula-like cells are neutralised but numbers are not', () => {
  assert.strictEqual(lib.csvSafeCell('=ADRES=NURTEPE'), "'=ADRES=NURTEPE");
  assert.strictEqual(lib.csvSafeCell('+90 555'), "'+90 555");
  assert.strictEqual(lib.csvSafeCell('@x'), "'@x");
  assert.strictEqual(lib.csvSafeCell('-5'), '-5');
  assert.strictEqual(lib.csvSafeCell(24884), '24884');
  assert.strictEqual(lib.csvSafeCell('4+1'), '4+1');
  assert.strictEqual(lib.csvSafeCell(null), '');
});

test('csv quotes cells, escapes quotes and uses semicolons', () => {
  assert.strictEqual(lib.toCsv([['a"b', 'c;d'], ['1', '2']]), '"a""b";"c;d"\n"1";"2"');
});

test('thousands separators go, other dotted values stay', () => {
  assert.strictEqual(lib.normalizeNumberText('104.500'), '104500');
  assert.strictEqual(lib.normalizeNumberText('1.234.567'), '1234567');
  assert.strictEqual(lib.normalizeNumberText('1.50'), '1.50');
  assert.strictEqual(lib.normalizeNumberText('1.0 TSI'), '1.0 TSI');
  assert.strictEqual(lib.normalizeNumberText('4+1'), '4+1');
});

test('page csv keeps the original columns first and fills m² Fiyatı', () => {
  const [header, row] = lib.listPageToRows(page);
  assert.deepStrictEqual(header.slice(0, 8), ['Resim', 'İlan Başlığı', 'm²', 'Fiyat', 'm² Fiyatı', 'İlan Tarihi', 'İl / İlçe', 'İlan Linki']);
  assert.strictEqual(row[header.indexOf('m² Fiyatı')], 24884);
  assert.strictEqual(row[header.indexOf('İl / İlçe')], 'Kocaeli / Gebze');
  assert.strictEqual(row[header.indexOf('İlan No')], '1');
  assert.strictEqual(row[header.indexOf('Öne Çıkan')], 'Evet');
  assert.ok(!header.includes('Hesaplanan Fiyat/m²'));
});

test('unit price is computed only when the site does not give it', () => {
  const record = { price: { amount: 1000000 }, fields: { 'm² (Brüt)': '200' } };
  assert.strictEqual(lib.unitPrice(record), 5000);
  assert.strictEqual(lib.unitPrice({ price: { amount: 1000000 }, fields: { KM: '100' } }), null);
  assert.strictEqual(lib.unitPrice({ price: { amount: 9 }, fields: { 'm² Fiyatı': '24884' } }), 24884);
});

test('location headers split only when they line up', () => {
  assert.deepStrictEqual(lib.splitLocationCell('İl / İlçe', 'Kocaeli / Gebze'), [['İl', 'Kocaeli'], ['İlçe', 'Gebze']]);
  assert.deepStrictEqual(lib.splitLocationCell('Mahalle', 'Denizli Mh.'), [['Mahalle', 'Denizli Mh.']]);
  assert.deepStrictEqual(lib.splitLocationCell('Semt / Mahalle', 'Çarşı Yeşilova Mh.'), [['Semt / Mahalle', 'Çarşı Yeşilova Mh.']]);
});

test('basket removes duplicates by id and records price changes', () => {
  const basket = {};
  assert.deepStrictEqual(lib.mergePage(basket, page, 'T1'), { new: 1, updated: 0, priceChanged: 0 });
  assert.deepStrictEqual(lib.mergePage(basket, page, 'T2'), { new: 0, updated: 1, priceChanged: 0 });
  const cheaper = JSON.parse(JSON.stringify(page));
  cheaper.rows[0].price.amount = 5000000;
  assert.deepStrictEqual(lib.mergePage(basket, cheaper, 'T3'), { new: 0, updated: 0, priceChanged: 1 });
  assert.strictEqual(Object.keys(basket).length, 1);
  assert.deepStrictEqual(basket['1'].priceHistory, [{ at: 'T2', amount: 5350000, currency: 'TL' }]);
  assert.strictEqual(basket['1'].firstSeen, 'T1');
});

test('a list row never erases captured details', () => {
  const basket = {};
  lib.mergeRecord(basket, lib.detailToRecord(listing), 'T1');
  const row = {
    id: '9', url: listing.url, title: 'Golf', image: 'https://img/thumb.jpg', promoted: false, urgent: false,
    price: listing.price, dateRaw: listing.dateRaw, dateIso: listing.dateIso,
    cells: [{ name: 'Renk', kind: 'attribute', value: 'Siyah' }, { name: 'İl / İlçe', kind: 'location', value: 'Bingöl / Solhan' }]
  };
  lib.mergeRecord(basket, lib.listRowToRecord(row, { category: [] }), 'T2');
  const merged = basket['9'];
  assert.strictEqual(merged.hasDetail, true);
  assert.strictEqual(merged.description, 'Satırlı\naçıklama');
  assert.strictEqual(merged.photos.length, 2);
  assert.strictEqual(merged.fields.KM, '104500');
  assert.strictEqual(merged.fields.Renk, 'Siyah');
  assert.strictEqual(merged.location, 'Bingöl / Solhan / Yeni Mah.');
});

test('basket columns adapt to mixed categories and drop empty ones', () => {
  const basket = {};
  lib.mergePage(basket, page, 'T1');
  lib.mergeRecord(basket, lib.detailToRecord(listing), 'T1');
  const rows = lib.recordsToRows(Object.values(basket));
  const header = rows[0];
  ['m²', 'KM', 'Motor Hacmi', 'Özellik: Güvenlik', 'Değişen Parçalar', 'Fotoğraf Sayısı'].forEach((name) => {
    assert.ok(header.includes(name), name);
  });
  assert.ok(!header.includes('Özellik: Multimedya'));
  assert.ok(!header.includes('Önceki Fiyat'));
  const car = rows.find((row) => row[0] === '9');
  assert.strictEqual(car[header.indexOf('Değişen Parçalar')], 'Motor Kaputu');
  assert.strictEqual(car[header.indexOf('m²')], '');
  const hidden = lib.recordsToRows(Object.values(basket), ['KM']);
  assert.ok(!hidden[0].includes('KM'));
});

test('stats work for any category and ignore id-like fields', () => {
  const records = [
    { price: { amount: 100, currency: 'TL' }, fields: { KM: '1000', 'Ada No': '5' } },
    { price: { amount: 300, currency: 'TL' }, fields: { KM: '3000', 'Ada No': '7' } },
    { price: { amount: 50, currency: 'USD' }, fields: { KM: '2000', 'Ada No': '9' } }
  ];
  const { stats, mixedCurrency, currency } = lib.computeStats(records);
  assert.strictEqual(mixedCurrency, true);
  assert.strictEqual(currency, 'TL');
  const price = stats.find((stat) => stat.label === 'Fiyat');
  assert.deepStrictEqual([price.min, price.median, price.max], [100, 200, 300]);
  const km = stats.find((stat) => stat.label === 'KM');
  assert.deepStrictEqual([km.min, km.median, km.max], [1000, 2000, 3000]);
  assert.ok(!stats.some((stat) => stat.label === 'Ada No'));
});

test('file names come from the page', () => {
  assert.strictEqual(lib.exportFileName(page, 'csv', '2026-11-04'), 'sahibinden_satilik-arsa_kocaeli-gebze-gebze_2026-11-04.csv');
  assert.strictEqual(lib.exportFileName({ pageType: 'detail', listing: { id: '9' } }, 'json', '2026-11-04'), 'sahibinden_ilan_9_2026-11-04.json');
});

const { FEATURES, normalizeFeatures, getFeature } = require('../features.js');

test('every optional feature starts off and bad settings read as off', () => {
  const allOff = normalizeFeatures({});
  assert.ok(FEATURES.length >= 20);
  FEATURES.forEach((feature) => assert.strictEqual(allOff[feature.id], false, feature.id));
  assert.strictEqual(normalizeFeatures({ charts: 'true', backup: 1 }).charts, false);
  assert.strictEqual(normalizeFeatures({ charts: 'true', backup: 1 }).backup, false);
  assert.strictEqual(normalizeFeatures(null).liveRates, false);
  assert.strictEqual(normalizeFeatures({ charts: true }).charts, true);
});

test('features that need extra requests or permissions are labelled and gated', () => {
  ['readWithoutOpening', 'autoPagination', 'bulkPriceHistory', 'savedSearchCheck'].forEach((id) => {
    assert.strictEqual(getFeature(id).risk, 'high', id);
  });
  ['readWithoutOpening', 'autoPagination', 'bulkPriceHistory'].forEach((id) => assert.strictEqual(getFeature(id).session, true, id));
  FEATURES.forEach((feature) => assert.ok(feature.where, feature.id));
  assert.deepStrictEqual(getFeature('savedSearchCheck').requires, ['snapshots']);
});

test('with all features off the export has none of the optional columns', () => {
  const record = lib.detailToRecord(listing);
  const context = { features: normalizeFeatures({}), rates: { USD: 50, EUR: 56, GBP: 67, GRA: 6300 }, annotations: { 9: { note: 'x' } }, now: Date.now() };
  const withOff = lib.recordsToRows([record], [], context)[0];
  const without = lib.recordsToRows([record])[0];
  assert.deepStrictEqual(withOff, without);
  ['Fiyat (Dolar)', 'Notum', 'Fırsat Puanı', 'Yıllık KM', 'Mağaza', 'Açıklamada Tramer'].forEach((name) => assert.ok(!withOff.includes(name), name));
});

test('each switch adds only its own columns', () => {
  const record = { ...lib.detailToRecord(listing), description: 'Tramer 12.500 tl\nboyasız', storeName: 'Mağaza A' };
  const header = (on) => lib.recordsToRows([record], [], { features: normalizeFeatures(on), rates: { USD: 50, EUR: 56, GBP: 67, GRA: 6300 }, annotations: { 9: { note: 'n', rating: 4 } }, now: Date.parse('2026-11-04') });
  assert.ok(header({ liveRates: true })[0].includes('Fiyat (Gram altın)'));
  assert.ok(header({ notesTags: true })[0].includes('Notum'));
  assert.ok(header({ dealScore: true })[0].includes('Fırsat Puanı'));
  assert.ok(header({ extraData: true })[0].includes('Mağaza'));
  const parsed = header({ descriptionParsing: true });
  assert.strictEqual(parsed[1][parsed[0].indexOf('Açıklamada Tramer')], 12500);
  const computed = header({ computedFields: true });
  assert.strictEqual(computed[1][computed[0].indexOf('Değişen Parça Sayısı')], 1);
  assert.strictEqual(computed[1][computed[0].indexOf('Araç Yaşı')], 4);
  assert.strictEqual(computed[1][computed[0].indexOf('Yıllık KM')], 26125);
});

test('rates convert from any currency and reject bad data', () => {
  const rates = lib.parseTruncgilRates({ Update_Date: 'x', USD: { Selling: 50 }, EUR: { Selling: 56 }, GBP: { Selling: 67 }, GRA: { Selling: 6300 } });
  assert.deepStrictEqual(lib.convertPrice({ amount: 6300000, currency: 'TL' }, rates), { USD: 126000, EUR: 112500, GBP: 94030, GRA: 1000 });
  assert.strictEqual(lib.convertPrice({ amount: 1000, currency: 'USD' }, rates).USD, 1000);
  assert.strictEqual(lib.convertPrice({ amount: null, currency: 'TL' }, rates), null);
  assert.strictEqual(lib.convertPrice({ amount: 5, currency: 'TL' }, null), null);
  assert.strictEqual(lib.parseTruncgilRates({ USD: { Selling: 50 } }), null);
  assert.strictEqual(lib.parseTruncgilRates({ USD: { Selling: 0 }, EUR: { Selling: 56 }, GBP: { Selling: 67 }, GRA: { Selling: 6300 } }), null);
  const fallback = lib.parseFallbackRates({ date: 'd', rates: { TRY: 50, EUR: 0.9, GBP: 0.75 } }, { price: 3110.34768 });
  assert.strictEqual(fallback.USD, 50);
  assert.strictEqual(Math.round(fallback.GBP * 100) / 100, 66.67);
  assert.strictEqual(Math.round(fallback.GRA), 5000);
  assert.strictEqual(lib.parseFallbackRates(null, null), null);
});

test('manual rates replace only the units filled in', () => {
  const live = { USD: 50, EUR: 56, GBP: 67, GRA: 6300, source: 'S' };
  const merged = lib.applyManualRates(live, { GRA: 7000, USD: null });
  assert.strictEqual(merged.GRA, 7000);
  assert.strictEqual(merged.USD, 50);
  assert.strictEqual(lib.applyManualRates(live, {}), live);
  assert.strictEqual(lib.applyManualRates(null, {}), null);
});

test('phones are masked without touching ordinary numbers', () => {
  assert.strictEqual(lib.maskPhones('Ara 0 (532) 123 45 67 lütfen'), 'Ara [telefon gizlendi] lütfen');
  assert.strictEqual(lib.maskPhones('+90 212 626 66 55'), '[telefon gizlendi]');
  assert.strictEqual(lib.maskPhones('05321234567'), '[telefon gizlendi]');
  assert.strictEqual(lib.maskPhones('104.500 km, 2022 model, 15.000 KM önce'), '104.500 km, 2022 model, 15.000 KM önce');
});

test('description parsing reads what sellers commonly write', () => {
  assert.strictEqual(lib.parseDescription('tramer kaydı yok').tramer, 'Yok');
  assert.strictEqual(lib.parseDescription('Tramer 45.000').tramer, 45000);
  assert.strictEqual(lib.parseDescription('Tramer: 12 bin').tramer, 12000);
  const parsed = lib.parseDescription('Güney cephe, krediye uygun, pazarlık payı var\n\nEKSTRALAR\n·R- LİNE BODY KİT ( 30.000₺)\n·Smoke Led Stop\n\nson');
  assert.strictEqual(parsed.facade, 'güney cephe');
  assert.ok(parsed.keywords.includes('Krediye uygun'));
  assert.ok(parsed.keywords.includes('Pazarlık payı var'));
  assert.strictEqual(parsed.extras, 'R- LİNE BODY KİT ( 30.000₺) | Smoke Led Stop');
  assert.deepStrictEqual(lib.parseDescription(''), {});
  assert.deepStrictEqual(lib.parseDescription(undefined), {});
});

test('computed fields appear only when their inputs exist', () => {
  const now = Date.parse('2026-11-04T12:00:00');
  const home = { dateIso: '2026-11-01', price: { amount: 1000000 }, fields: { 'm² (Brüt)': '200', 'm² (Net)': '150', 'Aidat (TL)': '500' } };
  const homeFields = Object.fromEntries(lib.computedFields(home, { now }));
  assert.strictEqual(homeFields['Yayında (gün)'], 3);
  assert.strictEqual(homeFields['Net/Brüt (%)'], 75);
  assert.strictEqual(homeFields['m² Başına Aidat'], 2.5);
  assert.strictEqual(homeFields['Yıllık KM'], undefined);
  const land = { price: { amount: 1000000 }, fields: { 'm²': '200', 'Kaks (Emsal)': '1.50' } };
  const landFields = Object.fromEntries(lib.computedFields(land, { now }));
  assert.strictEqual(landFields['Emsal İnşaat Alanı (m²)'], 300);
  assert.strictEqual(landFields['İnşaat m² Maliyeti'], 3333);
  assert.deepStrictEqual(lib.computedFields({ fields: {} }, { now }), []);
});

test('deal score stays in range, follows price and skips missing data', () => {
  const context = { now: Date.parse('2026-11-04'), medianUnitPrice: 1000, medianPrice: null };
  const cheap = lib.dealScore({ price: { amount: 50000 }, fields: { 'm²': '100' } }, context);
  const dear = lib.dealScore({ price: { amount: 200000 }, fields: { 'm²': '100' } }, context);
  assert.ok(cheap > dear);
  assert.ok(cheap <= 100 && dear >= 0);
  assert.strictEqual(lib.dealScore({ fields: {} }, { now: 0 }), null);
  assert.strictEqual(lib.dealScore({ price: { amount: 5 }, fields: { 'm²': '1' } }, context, { price: 0, freshness: 0, photos: 0, damage: 0 }), null);
});

test('duplicates are found by photo, parcel and title with price', () => {
  const records = [
    { id: '1', title: 'A', image: 'https://i/thmb_abc.jpg', fields: {}, price: { amount: 1 } },
    { id: '2', title: 'B', photos: ['https://i/x5_abc.jpg'], fields: {}, price: { amount: 2 } },
    { id: '3', title: 'C', fields: { 'Ada No': '235', 'Parsel No': '3', 'İl': 'Kocaeli' }, price: { amount: 3 } },
    { id: '4', title: 'D', fields: { 'Ada No': '235', 'Parsel No': '3', 'İl': 'Kocaeli' }, price: { amount: 4 } },
    { id: '5', title: 'Aynı Başlık!', fields: {}, price: { amount: 9 } },
    { id: '6', title: 'aynı başlık', fields: {}, price: { amount: 9 } },
    { id: '7', title: 'Tek', fields: {}, price: { amount: 7 } }
  ];
  const reasons = lib.findDuplicates(records).map((group) => `${group.reason}:${group.ids.join()}`).sort();
  assert.deepStrictEqual(reasons, ['Aynı ada ve parsel:3,4', 'Aynı başlık ve fiyat:5,6', 'Aynı fotoğraf:1,2']);
});

test('map files include only located listings and escape text', () => {
  const records = [
    { id: '1', title: 'A & <B>', lat: '38.9', lon: '41.0', price: { amount: 5, currency: 'TL' }, url: 'https://x/1' },
    { id: '2', title: 'No place', lat: '', lon: '', price: null, url: 'https://x/2' }
  ];
  const geo = lib.recordsToGeoJson(records);
  assert.strictEqual(geo.features.length, 1);
  assert.deepStrictEqual(geo.features[0].geometry.coordinates, [41, 38.9]);
  const kml = lib.recordsToKml(records);
  assert.ok(kml.includes('A &amp; &lt;B&gt;'));
  assert.ok(!kml.includes('No place'));
});

test('tsv stays on one line per row and neutralises formulas', () => {
  assert.strictEqual(lib.toTsv([['a\tb', 'c\nd'], ['=x', 5]]), "a b\tc d\n'=x\t5");
});

test('presets hide other columns and keep what they name', () => {
  assert.deepStrictEqual(lib.hiddenColumnsForPreset('vasita', ['KM', 'Oda Sayısı', 'Fiyat']), ['Oda Sayısı']);
  assert.deepStrictEqual(lib.hiddenColumnsForPreset('yok', ['KM']), []);
});

test('filter and sort work on a copy and put missing values last', () => {
  const records = [
    { id: '1', title: 'Deniz', price: { amount: 300 }, fields: {} },
    { id: '2', title: 'Orman', price: { amount: 100 }, fields: {} },
    { id: '3', title: 'Dağ', price: null, fields: {} }
  ];
  const ids = (list) => list.map((record) => record.id);
  assert.deepStrictEqual(ids(lib.filterAndSortRecords(records, { sortBy: 'price', descending: false })), ['2', '1', '3']);
  assert.deepStrictEqual(ids(lib.filterAndSortRecords(records, { sortBy: 'price', descending: true })), ['1', '2', '3']);
  assert.deepStrictEqual(ids(lib.filterAndSortRecords(records, { search: 'ORMAN' })), ['2']);
  assert.deepStrictEqual(ids(lib.filterAndSortRecords(records, { minPrice: 200 })), ['1']);
  assert.deepStrictEqual(ids(lib.filterAndSortRecords(records, { tag: 'iyi' }, { 2: { tags: ['iyi'] } })), ['2']);
  assert.deepStrictEqual(ids(records), ['1', '2', '3']);
});

test('saved searches report new, missing and repriced listings', () => {
  const page2 = JSON.parse(JSON.stringify(page));
  const before = lib.snapshotFromPage(page, 'T1');
  page2.rows[0].price.amount = 5000000;
  page2.rows.push({ ...page2.rows[0], id: '2', price: { amount: 7, currency: 'TL' } });
  const diff = lib.diffSnapshots(before, lib.snapshotFromPage(page2, 'T2'));
  assert.deepStrictEqual(diff.added.map((item) => item.id), ['2']);
  assert.deepStrictEqual(diff.priceChanged.map((item) => item.previousAmount), [5350000]);
  assert.deepStrictEqual(diff.missing, []);
  assert.strictEqual(lib.searchKey('https://x.com/a?pagingOffset=20&viewType=Gallery&q=1'), 'https://x.com/a?q=1');
});

test('next page addresses stop at the last page and honour the limit', () => {
  const list = { url: 'https://x.com/a?q=1', rows: new Array(20).fill({}), total: 55 };
  const urls = lib.nextPageUrls(list, 5);
  assert.strictEqual(urls.length, 2);
  assert.ok(urls[0].includes('pagingOffset=20'));
  assert.ok(urls[1].includes('pagingOffset=40'));
  assert.strictEqual(lib.nextPageUrls({ ...list, total: 1000 }, 5).length, 5);
  assert.strictEqual(lib.nextPageUrls({ ...list, rows: [] }, 5).length, 0);
  assert.strictEqual(lib.nextPageUrls({ ...list, url: 'https://x.com/a?pagingOffset=40', total: 55 }, 5).length, 0);
});

test('histogram keeps every value and every empty bin', () => {
  const bins = lib.histogramBins([0, 1, 2, 9, 10], 5);
  assert.strictEqual(bins.length, 5);
  assert.strictEqual(bins.reduce((sum, bin) => sum + bin.count, 0), 5);
  assert.strictEqual(bins[2].count, 0);
  assert.deepStrictEqual(lib.histogramBins([], 5), []);
  assert.strictEqual(lib.histogramBins([3, 3], 5)[0].count, 2);
});

test('backups are checked before they can touch stored data', () => {
  assert.strictEqual(lib.parseBackup('nope').ok, false);
  assert.strictEqual(lib.parseBackup('{"basket":{}}').ok, false);
  assert.strictEqual(lib.parseBackup('{"app":"ilan-veri-indirici","basket":[]}').ok, false);
  const good = lib.parseBackup(JSON.stringify({ app: 'ilan-veri-indirici', basket: { 1: { id: '1', title: 'A' }, bad: { id: '<x>', title: 'B' } }, hiddenColumns: ['KM', 5] }));
  assert.strictEqual(good.ok, true);
  assert.deepStrictEqual(Object.keys(good.data.basket), ['1']);
  assert.deepStrictEqual(good.data.hiddenColumns, ['KM']);
});

test('place names match across spellings and bad parcels are refused', () => {
  assert.strictEqual(lib.normalizeAdminName('Denizli Mh.'), lib.normalizeAdminName('DENİZLİ'));
  assert.strictEqual(lib.normalizeAdminName('Çarşı Mah.'), lib.normalizeAdminName('ÇARŞI MAHALLESİ'));
  assert.strictEqual(lib.findAdminId([{ id: 1, text: 'Şişli' }], 'şişli'), 1);
  assert.strictEqual(lib.findAdminId([{ id: 1, text: 'Şişli' }], ''), null);
  assert.deepStrictEqual(lib.parcelFromFields({ 'Ada No': '235', 'Parsel No': '3' }), { ada: '235', parsel: '3' });
  assert.strictEqual(lib.parcelFromFields({ 'Ada No': 'Belirtilmemiş', 'Parsel No': '3' }), null);
  assert.strictEqual(lib.parcelFromFields({}), null);
});
