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
  ['Fiyat (Dolar)', 'Notum', 'Fırsat Puanı', 'Mağaza', 'Açıklamada Tramer'].forEach((name) => assert.ok(!withOff.includes(name), name));
});

test('each switch adds only its own columns', () => {
  const record = { ...lib.detailToRecord(listing), description: 'Tramer 12.500 tl\nboyasız', storeName: 'Mağaza A' };
  const header = (on) => lib.recordsToRows([record], [], { features: normalizeFeatures(on), rates: { USD: 50, EUR: 56, GBP: 67, GRA: 6300 }, annotations: { 9: { note: 'n', rating: 4 } }, now: Date.parse('2026-11-04') });
  assert.ok(header({ liveRates: true })[0].includes('Fiyat (Gram altın)'));
  assert.ok(header({ notesTags: true })[0].includes('Notum'));
  assert.ok(header({ dealScore: true })[0].includes('Fırsat Puanı'));
  assert.ok(header({ extraData: true })[0].includes('Mağaza'));
  const parsed = header({});
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

test('phones written in a description come out in one format', () => {
  assert.deepStrictEqual(lib.extractPhones('Ara 0 (532) 123 45 67 lütfen, ya da 05321234567 veya +90 212 626 66 55'), ['0532 123 45 67', '0212 626 66 55']);
  assert.deepStrictEqual(lib.extractPhones('104.500 km, 2022 model, 15.000 KM önce'), []);
  assert.deepStrictEqual(lib.extractPhones(null), []);
});

const CAR_TEXT = 'Şase podye direkler işlemsizdir 2012 1.6 tdi 105 bg ön üç parça değişen Airbag açmamıştır Expertiz raporu mevcut 30 bin km önce triğer bakımları yapılmıştır. Vize 02/2027 direkt arayın km değişiklik gösterebilir';

test('vehicle signals quote the seller and skip look-alike words', () => {
  const signals = lib.vehicleSignals(CAR_TEXT);
  const labels = signals.map((signal) => signal.label);
  assert.deepStrictEqual(labels, ['Şase, podye, direk', 'Airbag', 'KM', 'Muayene', 'Ekspertiz', 'Bakım']);
  assert.strictEqual(signals[0].snippets[0].match, 'Şase');
  assert.ok(signals[0].snippets[0].after.startsWith('podye direkler'));
  assert.ok(signals[1].snippets[0].after.startsWith('açmamıştır'));
  assert.ok(lib.signalText(signals[3]).includes('Vize 02/2027'));
  assert.deepStrictEqual(lib.vehicleSignals('Direkt ararsanız sevinirim'), []);
  assert.strictEqual(lib.vehicleSignals('AIRBAG ORİJİNAL')[0].label, 'Airbag');
  assert.deepStrictEqual(lib.vehicleSignals(''), []);
});

test('custom search words work and special characters are safe', () => {
  const signals = lib.vehicleSignals('Partikül iptal edilmiştir, fiyat (son) budur', ['partikül', '(son)', '  ', 'yok böyle']);
  assert.deepStrictEqual(signals.map((signal) => [signal.label, signal.custom]), [['partikül', true], ['(son)', true]]);
});

test('vehicles are compared with the same series, close model years first', () => {
  const car = (id, year, km, amount) => ({ id, category: ['Vasıta', 'Otomobil'], fields: { Marka: 'VW', Seri: 'Golf', 'Yıl': String(year), KM: String(km) }, price: { amount, currency: 'TL' } });
  const records = [car('1', 2012, 100000, 900), car('2', 2012, 200000, 1000), car('3', 2013, 100000, 1200), car('4', 2020, 10000, 5000)];
  const result = lib.vehicleComparison(records[0], records);
  assert.strictEqual(result.count, 2);
  assert.strictEqual(result.closeYears, true);
  assert.strictEqual(result.priceDiff, -18);
  assert.strictEqual(result.kmDiff, -33);
  assert.strictEqual(lib.vehicleComparison(records[0], records.slice(0, 2)), null);
  assert.strictEqual(lib.vehicleComparison({ id: '9', fields: {}, price: { amount: 5, currency: 'TL' } }, records), null);
  const [group] = lib.vehicleGroups(records);
  assert.strictEqual(group.key, 'VW Golf');
  assert.strictEqual(group.count, 4);
  assert.strictEqual(group.minPrice, 900);
});

test('vehicle filters keep the right cars and put missing values last', () => {
  const car = (id, series, km, damage) => ({ id, category: ['Vasıta'], fields: { Marka: 'VW', Seri: series, KM: km }, price: { amount: 10, currency: 'TL' }, damage });
  const clean = { changed: [], painted: [], localPainted: [], originalCount: 13, notes: [] };
  const painted = { changed: [], painted: ['roof'], localPainted: [], originalCount: 12, notes: [] };
  const changed = { changed: ['roof'], painted: [], localPainted: [], originalCount: 12, notes: [] };
  const records = [car('1', 'Golf', '300', changed), car('2', 'Golf', '100', painted), car('3', 'Polo', undefined, clean), { id: '4', category: ['Emlak'], fields: {} }];
  const ids = (filters) => lib.filterVehicles(records, filters).map((record) => record.id);
  assert.deepStrictEqual(ids({ sortBy: 'km' }), ['2', '1', '3']);
  assert.deepStrictEqual(ids({ sortBy: 'km', descending: true }), ['1', '2', '3']);
  assert.deepStrictEqual(ids({ series: 'VW Golf', sortBy: 'km' }), ['2', '1']);
  assert.deepStrictEqual(ids({ damage: 'noChanged', sortBy: 'km' }), ['2', '3']);
  assert.deepStrictEqual(ids({ damage: 'clean', sortBy: 'km' }), ['3']);
});

test('exact facts come from published figures and written text only', () => {
  const now = Date.parse('2026-11-04');
  assert.deepStrictEqual(lib.parseInspection('Vize 02/2027 partikül iptal', now).monthsLeft, 3);
  assert.strictEqual(lib.parseInspection('muayene tarihi 15.03.2027', now).text, '03/2027');
  assert.strictEqual(lib.parseInspection('muayene 2027-05', now).text, '05/2027');
  assert.strictEqual(lib.parseInspection('Muayenesi Şubat 2027 e kadar', now).text, '02/2027');
  assert.strictEqual(lib.parseInspection('Vize yeni yapıldı, 2012 model', now), null);
  assert.strictEqual(lib.parseInspection('', now), null);
  const record = { id: '1', category: ['Vasıta'], dateIso: '2026-11-01', description: 'Vize 02/2027 tramer 25.000 TL', price: { amount: 1000000, currency: 'TL' }, priceHistory: [{ amount: 1100000, currency: 'TL' }], fields: { 'Yıl': '2022', KM: '100000', 'Motor Gücü': '100 hp' } };
  const facts = Object.fromEntries(lib.vehicleFacts(record, now));
  assert.strictEqual(facts['Yıllık KM'], '25.000');
  assert.strictEqual(facts['KM Başına Fiyat'], '10 TL');
  assert.strictEqual(facts['Beygir Başına Fiyat'], '10.000 TL');
  assert.strictEqual(facts['Muayene (Açıklamada)'], '02/2027, 3 ay kaldı');
  assert.strictEqual(facts['İlk Görülen Fiyat'], '1.100.000 TL (-%9)');
  assert.strictEqual(facts['Açıklamada tramer'], '25.000 TL');
  assert.strictEqual(lib.vehicleFacts({ fields: { 'Motor Gücü': '101 - 125 HP', KM: '5' }, price: { amount: 5, currency: 'TL' } }, now).some(([name]) => name === 'Beygir Başına Fiyat'), false);
});

test('rent counts only when clearly written as money', () => {
  assert.strictEqual(lib.parseRent('Kira getirisi 25.000 TL'), 25000);
  assert.strictEqual(lib.parseRent('kirası 25 bin'), 25000);
  assert.strictEqual(lib.parseRent('Kiracılı, kira 30000 tl'), 30000);
  assert.strictEqual(lib.parseRent('Kiralık daire 3 odalı'), null);
  assert.strictEqual(lib.parseRent('kira 2 yıl önce başladı'), null);
  const facts = Object.fromEntries(lib.emlakFacts({ category: ['Emlak', 'Konut', 'Satılık'], description: 'Kira getirisi 25.000 TL', price: { amount: 3000000, currency: 'TL' }, fields: { 'm² (Brüt)': '100', 'm² (Net)': '80' } }, Date.parse('2026-11-04')));
  assert.strictEqual(facts['Kira Geri Dönüşü'], '10 yıl');
  assert.strictEqual(facts['Net/Brüt (%)'], '80');
  assert.strictEqual(facts['Fiyat/m²'], '30.000 TL');
  const rental = Object.fromEntries(lib.emlakFacts({ category: ['Emlak', 'Konut', 'Kiralık'], description: 'Kira 25.000 TL', price: { amount: 25000, currency: 'TL' }, fields: {} }, 0));
  assert.strictEqual(rental['Kira Geri Dönüşü'], undefined);
});

test('photo links grow to the large copy where one exists', () => {
  assert.strictEqual(lib.largePhotoUrl('https://i/a/lthmb_1.jpg'), 'https://i/a/x5_1.jpg');
  assert.strictEqual(lib.largePhotoUrl('https://i/a/thmb_1.jpg'), 'https://i/a/x5_1.jpg');
  assert.strictEqual(lib.largePhotoUrl('https://i/a/pr_thmb_1.jpg'), 'https://i/a/pr_thmb_1.jpg');
  assert.strictEqual(lib.recordPhoto({ photos: ['https://i/x5_9.jpg'], image: 'https://i/thmb_1.jpg' }), 'https://i/x5_9.jpg');
  assert.strictEqual(lib.recordPhoto({ image: '' }), '');
});

test('vehicle cards show the site columns, with a dash left to the page for what is missing', () => {
  const specs = Object.fromEntries(lib.vehicleSpecs({ dateRaw: '04 Kasım 2026', location: 'İzmir / Urla', fields: { Seri: 'Clio', Model: '1.5 dCi', 'Yıl': '2018', KM: '179500', 'İl': 'İzmir', 'İlçe': 'Urla' } }));
  assert.strictEqual(specs.KM, '179.500');
  assert.strictEqual(specs['İl / İlçe'], 'İzmir / Urla');
  assert.strictEqual(specs.Renk, undefined);
  assert.ok('Renk' in specs);
  assert.ok(!('Marka' in specs));
});

test('real estate is split by the site category and uses its own columns', () => {
  const konut = { id: '1', category: ['Emlak', 'Konut', 'Trabzon'], dateRaw: '03 Kasım 2026', location: 'Ortahisar / Merkez', fields: { 'm² (Brüt)': '95', 'Oda Sayısı': '2+1', 'İlçe': 'Ortahisar', Semt: 'Merkez' }, price: { amount: 10, currency: 'TL' } };
  const arsa = { id: '2', category: ['Emlak', 'Arsa'], fields: { 'İmar Durumu': 'Konut', 'Ada No': '5', Fiyat: 'x' }, hasDetail: false, price: { amount: 5, currency: 'TL' } };
  const isyeri = { id: '3', category: ['Emlak', 'İş Yeri', 'Trabzon'], fields: {}, price: { amount: 7, currency: 'TL' } };
  const devre = { id: '4', category: ['Emlak', 'Devre Mülk'], fields: {} };
  const araba = { id: '5', category: ['Vasıta', 'Otomobil'], fields: {} };
  const fromUrl = { id: '6', url: 'https://www.sahibinden.com/ilan/emlak-konut-satilik-1/detay', fields: {} };
  const records = [konut, arsa, isyeri, devre, araba, fromUrl];
  assert.deepStrictEqual(records.filter(lib.isRealEstate).map((record) => lib.emlakSubtype(record).id), ['konut', 'arsa', 'isyeri', 'diger', 'konut']);
  assert.deepStrictEqual(lib.emlakSpecs(konut).map(([name]) => name), ['m² (Brüt)', 'Oda Sayısı', 'İlan Tarihi', 'Konum']);
  assert.deepStrictEqual(lib.emlakSpecs(arsa).map(([name]) => name), ['İmar Durumu', 'Ada No']);
  assert.deepStrictEqual(lib.filterEmlak(records, { subtype: 'konut' }).map((record) => record.id), ['1', '6']);
  assert.deepStrictEqual(lib.filterEmlak(records, { sortBy: 'price' }).map((record) => record.id).slice(0, 3), ['2', '3', '1']);
  assert.deepStrictEqual(lib.emlakCounts(records).map((item) => [item.id, item.count]), [['konut', 2], ['isyeri', 1], ['arsa', 1], ['diger', 1]]);
  assert.strictEqual(lib.emlakCategoryLink(lib.EMLAK_SUBTYPES[2], 'https://www.sahibinden.com/emlak-konut/trabzon'), 'https://www.sahibinden.com/arsa/trabzon');
  assert.strictEqual(lib.emlakCategoryLink(lib.EMLAK_SUBTYPES[1], 'https://www.sahibinden.com/otomobil'), 'https://www.sahibinden.com/is-yeri');
  assert.strictEqual(lib.emlakCategoryLink(lib.EMLAK_SUBTYPES[0], ''), 'https://www.sahibinden.com/emlak-konut');
});

test('a saved listing keeps its detail when the results page updates it', () => {
  const saved = { id: '1', hasDetail: true, location: 'Tam adres', image: 'big', damage: { changed: [] }, priceHistory: [{ amount: 1 }], fields: { Renk: 'Gri', KM: '5' } };
  const fresh = { id: '1', hasDetail: false, location: 'Kısa', image: 'small', price: { amount: 2 }, fields: { KM: '6' } };
  const merged = lib.withSaved(fresh, saved);
  assert.strictEqual(merged.hasDetail, true);
  assert.strictEqual(merged.location, 'Tam adres');
  assert.strictEqual(merged.image, 'big');
  assert.strictEqual(merged.fields.Renk, 'Gri');
  assert.strictEqual(merged.fields.KM, '6');
  assert.strictEqual(merged.price.amount, 2);
  assert.strictEqual(lib.withSaved(fresh, undefined), fresh);
});

test('only vehicle listings count as vehicles', () => {
  assert.ok(lib.isVehicle({ category: ['Vasıta', 'Otomobil'] }));
  assert.ok(lib.isVehicle({ fields: { KM: '5', 'Yıl': '2020' } }));
  assert.ok(!lib.isVehicle({ category: ['Emlak', 'Konut'], fields: { 'm²': '90' } }));
});

test('vehicle columns appear for cars and stay out of other listings', () => {
  const technical = { sections: { 'Genel Bakış': { 'Motor Tipi': 'Dizel', 'Toplam yıllık MTV (2012 model ve 1598 cc)': '1.539 TL' }, 'Motor ve Performans': { 'Motor Tipi': 'Tekrar' } }, equipment: { 'Güvenlik': ['ABS', 'EBD'] } };
  assert.deepStrictEqual(lib.flatTechnical({ technical }), [['Motor Tipi', 'Dizel'], ['Toplam yıllık MTV', '1.539 TL']]);
  const carRecord = { id: '1', title: 'Golf', category: ['Vasıta'], fields: {}, technical, description: 'Airbag açmamış. Partikül iptal. Ara 0532 123 45 67' };
  const rows = lib.recordsToRows([carRecord], [], { features: normalizeFeatures({}), vehicleTerms: ['partikül'] });
  const cell = (name) => rows[1][rows[0].indexOf(name)];
  assert.ok(cell('Açıklama: Airbag').includes('açmamış'));
  assert.ok(cell('Arama: partikül').includes('iptal'));
  assert.strictEqual(cell('Açıklamadaki Telefon'), '0532 123 45 67');
  assert.strictEqual(cell('Teknik: Motor Tipi'), 'Dizel');
  assert.strictEqual(cell('Model Donanımı'), 'ABS | EBD');
  assert.ok(cell('Açıklama').includes('0532 123 45 67'));
  const home = lib.recordsToRows([{ id: '2', title: 'Ev', category: ['Emlak'], fields: {}, description: 'Direk yanında, airbag yok' }], [], { features: normalizeFeatures({}) });
  assert.ok(!home[0].some((name) => name.startsWith('Açıklama: ')));
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
