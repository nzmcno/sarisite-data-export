// lib.js - Pure data logic shared by popup, background and compare pages.
// No page access here. Records are category-agnostic: whatever labels the site shows become fields.

const CAR_PART_LABELS = {
  'front-bumper': 'Ön Tampon',
  'front-hood': 'Motor Kaputu',
  'roof': 'Tavan',
  'front-right-mudguard': 'Sağ Ön Çamurluk',
  'front-right-door': 'Sağ Ön Kapı',
  'rear-right-door': 'Sağ Arka Kapı',
  'rear-right-mudguard': 'Sağ Arka Çamurluk',
  'front-left-mudguard': 'Sol Ön Çamurluk',
  'front-left-door': 'Sol Ön Kapı',
  'rear-left-door': 'Sol Arka Kapı',
  'rear-left-mudguard': 'Sol Arka Çamurluk',
  'rear-hood': 'Bagaj Kapağı',
  'rear-bumper': 'Arka Tampon'
};

/** Stops seller-written text like "=ADRES=..." from running as a spreadsheet formula */
function csvSafeCell(value) {
  const text = String(value == null ? '' : value);
  if (/^-?\d+([.,]\d+)?$/.test(text)) return text;
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Semicolon separated and fully quoted, the Turkish Excel format the extension has always used */
function toCsv(rows) {
  return rows
    .map((row) => row.map((cell) => `"${csvSafeCell(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
}

/** "104.500" -> "104500"; leaves "1.50", "1.0 TSI" and "4+1" alone */
function normalizeNumberText(value) {
  const text = String(value == null ? '' : value).trim();
  return /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : text;
}

function toNumber(value) {
  const text = normalizeNumberText(value);
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

/** m² Fiyatı when the site gives it, otherwise price divided by the listed area */
function unitPrice(record) {
  const given = toNumber(record.fields['m² Fiyatı']);
  if (given !== null) return given;
  const area = toNumber(record.fields['m² (Brüt)']) || toNumber(record.fields['m²']);
  if (!area || !record.price || !record.price.amount) return null;
  return Math.round(record.price.amount / area);
}

/** Header "İl / İlçe" with value "Kocaeli / Gebze" becomes two fields; other location headers stay as they are */
function splitLocationCell(name, value) {
  const names = name.split('/').map((part) => part.trim());
  const values = String(value).split('/').map((part) => part.trim());
  if (names.length > 1 && names.length === values.length) {
    return names.map((part, index) => [part, values[index]]);
  }
  return [[name, value]];
}

function listRowToRecord(row, page) {
  const fields = {};
  let location = '';
  row.cells.forEach((cell) => {
    if (cell.kind === 'title' || cell.kind === 'price' || cell.kind === 'date') return;
    if (cell.kind === 'location') {
      location = String(cell.value);
      splitLocationCell(cell.name, cell.value).forEach(([key, value]) => { fields[key] = value; });
      return;
    }
    fields[cell.name] = normalizeNumberText(cell.value);
  });
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    image: row.image,
    price: row.price,
    dateRaw: row.dateRaw,
    dateIso: row.dateIso,
    category: page.category || [],
    location,
    promoted: row.promoted,
    urgent: row.urgent,
    storeName: row.storeName || '',
    badges: row.badges || [],
    fields,
    hasDetail: false
  };
}

function detailToRecord(listing) {
  const fields = {};
  Object.entries(listing.attributes).forEach(([key, value]) => {
    fields[key] = normalizeNumberText(value);
  });
  if (listing.location.il) fields['İl'] = listing.location.il;
  if (listing.location.ilce) fields['İlçe'] = listing.location.ilce;
  if (listing.location.mahalle) fields['Mahalle'] = listing.location.mahalle;
  return {
    id: listing.id,
    url: listing.url,
    title: listing.title,
    image: listing.photos[0] || '',
    price: listing.price,
    dateRaw: listing.dateRaw,
    dateIso: listing.dateIso,
    category: listing.category,
    location: listing.location.raw,
    fields,
    features: listing.features,
    damage: listing.damage,
    ...(listing.technical ? { technical: listing.technical } : {}),
    description: listing.description,
    photos: listing.photos,
    lat: listing.lat,
    lon: listing.lon,
    hasVideo: listing.hasVideo,
    storeName: (listing.seller && listing.seller.storeName) || '',
    license: (listing.seller && listing.seller.license) || '',
    memberSince: (listing.seller && listing.seller.memberSince) || '',
    media: listing.media,
    hasDetail: true
  };
}

/** Adds or updates one record. A list row never erases details captured earlier. */
function mergeRecord(basket, record, now) {
  const existing = basket[record.id];
  if (!existing) {
    basket[record.id] = { ...record, firstSeen: now, lastSeen: now, priceHistory: [] };
    return 'new';
  }
  const priceChanged = existing.price && record.price
    && existing.price.amount !== null && record.price.amount !== null
    && (existing.price.amount !== record.price.amount || existing.price.currency !== record.price.currency);
  const priceHistory = existing.priceHistory || [];
  if (priceChanged) {
    priceHistory.push({ at: existing.lastSeen, amount: existing.price.amount, currency: existing.price.currency });
  }
  const merged = { ...existing, ...record, fields: { ...existing.fields, ...record.fields }, firstSeen: existing.firstSeen, lastSeen: now, priceHistory };
  if (!record.hasDetail && existing.hasDetail) {
    merged.hasDetail = true;
    merged.location = existing.location;
    merged.image = existing.image || record.image;
  }
  basket[record.id] = merged;
  return priceChanged ? 'priceChanged' : 'updated';
}

function mergePage(basket, page, now) {
  const counts = { new: 0, updated: 0, priceChanged: 0 };
  const records = page.pageType === 'detail'
    ? [detailToRecord(page.listing)]
    : page.rows.map((row) => listRowToRecord(row, page));
  records.forEach((record) => { counts[mergeRecord(basket, record, now)] += 1; });
  return counts;
}

function partLabels(parts) {
  return (parts || []).map((part) => CAR_PART_LABELS[part] || part).join(', ');
}

/**
 * Fixed columns first, then every field and feature group any record has. Empty columns are dropped.
 * context is optional: { features, rates, annotations, now }. Without it only the base columns appear.
 */
function basketColumns(records, context) {
  const on = (context && context.features) || {};
  const rates = on.liveRates || on.manualRates ? context.rates : null;
  const notes = (context && context.annotations) || {};
  const derived = on.computedFields || on.dealScore ? basketContext(records, context.now) : null;
  const fieldNames = [];
  const featureGroups = [];
  records.forEach((record) => {
    Object.keys(record.fields || {}).forEach((key) => {
      if (!fieldNames.includes(key)) fieldNames.push(key);
    });
    Object.keys(record.features || {}).forEach((key) => {
      if (!featureGroups.includes(key)) featureGroups.push(key);
    });
  });

  const lastChange = (record) => (record.priceHistory || []).slice(-1)[0];
  const columns = [
    ['İlan No', (r) => r.id],
    ['Başlık', (r) => r.title],
    ['Fiyat', (r) => (r.price && r.price.amount !== null ? r.price.amount : r.price && r.price.raw)],
    ['Para Birimi', (r) => r.price && r.price.currency],
    ['Önceki Fiyat', (r) => lastChange(r) && lastChange(r).amount],
    ['Fiyat Değişimi', (r) => (lastChange(r) && r.price ? r.price.amount - lastChange(r).amount : '')],
    ['Hesaplanan Fiyat/m²', (r) => unitPrice(r)],
    ['İlan Tarihi', (r) => r.dateRaw],
    ['İlan Tarihi (ISO)', (r) => r.dateIso],
    ['Kategori', (r) => (r.category || []).join(' > ')],
    ['Konum', (r) => r.location]
  ];
  if (rates) {
    RATE_UNITS.forEach(({ code, label }) => {
      columns.push([`Fiyat (${label})`, (r) => (convertPrice(r.price, rates) || {})[code]]);
    });
  }
  if (on.dealScore) columns.push(['Fırsat Puanı', (r) => dealScore(r, derived, context.scoreWeights)]);
  if (on.notesTags) {
    columns.push(
      ['Puanım', (r) => (notes[r.id] || {}).rating],
      ['Etiketler', (r) => ((notes[r.id] || {}).tags || []).join(', ')],
      ['Notum', (r) => (notes[r.id] || {}).note]
    );
  }
  fieldNames.forEach((name) => columns.push([name, (r) => (r.fields || {})[name]]));
  if (on.computedFields) {
    const names = [];
    records.forEach((record) => {
      computedFields(record, derived).forEach(([name]) => {
        if (!names.includes(name)) names.push(name);
      });
    });
    names.forEach((name) => {
      columns.push([name, (r) => (computedFields(r, derived).find(([key]) => key === name) || [])[1]]);
    });
  }
  if (on.extraData) {
    columns.push(
      ['Mağaza', (r) => r.storeName],
      ['Yetki Belge No', (r) => r.license],
      ['Üyelik Tarihi', (r) => r.memberSince],
      ['Rozetler', (r) => (r.badges || []).join(', ')],
      ['Sanal Tur', (r) => (r.media && r.media.tour ? 'Evet' : '')],
      ['İlan Klibi', (r) => (r.media && r.media.clip ? 'Evet' : '')]
    );
  }
  const parsed = (r) => parseDescription(r.description);
  columns.push(
    ['Açıklamada Tramer', (r) => parsed(r).tramer],
    ['Açıklamada Cephe', (r) => parsed(r).facade],
    ['Açıklamada Anahtar Kelimeler', (r) => parsed(r).keywords],
    ['Açıklamada Ekstralar', (r) => parsed(r).extras],
    ['Açıklamadaki Telefon', (r) => extractPhones(r.description).join(', ')]
  );
  vehicleSignalNames(context && context.vehicleTerms).forEach((name) => {
    columns.push([name, (r) => (isVehicle(r) ? signalColumn(r, name, context && context.vehicleTerms) : '')]);
  });
  technicalColumnNames(records).forEach((name) => {
    columns.push([`Teknik: ${name}`, (r) => (flatTechnical(r).find(([title]) => title === name) || [])[1]]);
  });
  columns.push(['Model Donanımı', (r) => (r.technical ? Object.values(r.technical.equipment || {}).flat().join(' | ') : '')]);
  if (context && context.includeRemoteHistory) {
    columns.push(
      ['Site: İlk Fiyat', (r) => r.remoteHistory && r.remoteHistory.initialPrice],
      ['Site: Fiyat Eğilimi', (r) => r.remoteHistory && r.remoteHistory.trend],
      ['Site: Fiyat Geçmişi', (r) => (r.remoteHistory && r.remoteHistory.entries.length ? JSON.stringify(r.remoteHistory.entries) : '')]
    );
  }
  featureGroups.forEach((group) => {
    columns.push([`Özellik: ${group}`, (r) => ((r.features || {})[group] || []).join(' | ')]);
  });
  columns.push(
    ['Değişen Parçalar', (r) => r.damage && partLabels(r.damage.changed)],
    ['Boyalı Parçalar', (r) => r.damage && partLabels(r.damage.painted)],
    ['Lokal Boyalı Parçalar', (r) => r.damage && partLabels(r.damage.localPainted)],
    ['Hasar Notları', (r) => r.damage && r.damage.notes.join(' | ')],
    ['Açıklama', (r) => r.description],
    ['Fotoğraf Sayısı', (r) => (r.photos ? r.photos.length : '')],
    ['Fotoğraflar', (r) => (r.photos || []).join(' ')],
    ['Video', (r) => (r.hasVideo ? 'Evet' : '')],
    ['Enlem', (r) => r.lat],
    ['Boylam', (r) => r.lon],
    ['Öne Çıkan', (r) => (r.promoted ? 'Evet' : '')],
    ['Acil', (r) => (r.urgent ? 'Evet' : '')],
    ['Detay Alındı', (r) => (r.hasDetail ? 'Evet' : 'Hayır')],
    ['Resim', (r) => r.image],
    ['İlan Linki', (r) => r.url],
    ['İlk Görülme', (r) => r.firstSeen],
    ['Son Görülme', (r) => r.lastSeen]
  );
  const hasValue = (value) => value !== undefined && value !== null && value !== '';
  return columns
    .filter(([, read]) => records.some((record) => hasValue(read(record))))
    .map(([name, read]) => ({ name, read }));
}

function recordsToRows(records, hiddenColumns, context) {
  const hidden = hiddenColumns || [];
  const columns = basketColumns(records, context).filter((column) => !hidden.includes(column.name));
  const cell = (value) => (value === undefined || value === null ? '' : value);
  return [columns.map((column) => column.name)].concat(
    records.map((record) => columns.map((column) => cell(column.read(record))))
  );
}

/** Current-page CSV: the original column order, with the new columns added after İlan Linki */
function listPageToRows(page, context) {
  const on = (context && context.features) || {};
  const rates = on.liveRates || on.manualRates ? context.rates : null;
  const names = page.columns.filter((name) => name !== 'Resim');
  const records = page.rows.map((row) => listRowToRecord(row, page));
  const showUnitPrice = !names.includes('m² Fiyatı') && records.some((record) => unitPrice(record) !== null);
  const header = ['Resim', ...names, 'İlan Linki', 'İlan No', 'Para Birimi', 'İlan Tarihi (ISO)', 'Öne Çıkan', 'Acil'];
  if (showUnitPrice) header.push('Hesaplanan Fiyat/m²');
  if (rates) RATE_UNITS.forEach(({ label }) => header.push(`Fiyat (${label})`));
  if (on.extraData) header.push('Mağaza', 'Rozetler');

  const rows = page.rows.map((row, index) => {
    const byName = {};
    row.cells.forEach((cell) => {
      byName[cell.name] = cell.kind === 'attribute' ? normalizeNumberText(cell.value) : cell.value;
    });
    const values = [
      row.image,
      ...names.map((name) => (byName[name] === undefined ? '' : byName[name])),
      row.url,
      row.id,
      row.price.currency,
      row.dateIso,
      row.promoted ? 'Evet' : '',
      row.urgent ? 'Evet' : ''
    ];
    if (showUnitPrice) {
      const value = unitPrice(records[index]);
      values.push(value === null ? '' : value);
    }
    if (rates) {
      const converted = convertPrice(row.price, rates) || {};
      RATE_UNITS.forEach(({ code }) => values.push(converted[code] === undefined ? '' : converted[code]));
    }
    if (on.extraData) values.push(row.storeName || '', (row.badges || []).join(', '));
    return values;
  });
  return [header, ...rows];
}

function median(sorted) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function summarize(label, values, unit) {
  const numbers = values.filter((value) => value !== null && value !== undefined).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  return { label, unit: unit || '', count: numbers.length, min: numbers[0], median: median(numbers), max: numbers[numbers.length - 1] };
}

/** Works for any category: price, unit price, then every field that is mostly numeric */
function computeStats(records) {
  if (records.length === 0) return { stats: [], mixedCurrency: false };
  const currencyCounts = {};
  records.forEach((record) => {
    const currency = record.price && record.price.currency;
    if (currency) currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;
  });
  const currencies = Object.keys(currencyCounts).sort((a, b) => currencyCounts[b] - currencyCounts[a]);
  const currency = currencies[0] || '';
  // Mixed currencies can't share one min or median, so the most common one is used
  const sameCurrency = records.filter((record) => record.price && record.price.currency === currency);

  const stats = [
    summarize('Fiyat', sameCurrency.map((record) => record.price.amount), currency),
    summarize('Fiyat/m²', sameCurrency.map(unitPrice), currency)
  ];
  const names = [];
  records.forEach((record) => {
    Object.keys(record.fields || {}).forEach((key) => {
      if (!names.includes(key)) names.push(key);
    });
  });
  names
    .filter((name) => name !== 'm² Fiyatı' && !/\bNo$/i.test(name))
    .forEach((name) => {
      const raw = records.map((record) => (record.fields || {})[name]).filter((value) => value !== undefined && value !== '');
      const numeric = raw.map(toNumber);
      if (raw.length > 0 && numeric.filter((value) => value !== null).length / raw.length >= 0.8) {
        stats.push(summarize(name, numeric));
      }
    });
  return { stats: stats.filter(Boolean), mixedCurrency: currencies.length > 1, currency };
}

function exportFileName(page, extension, dateIso) {
  if (page.pageType === 'detail') return `sahibinden_ilan_${page.listing.id}_${dateIso}.${extension}`;
  let path = '';
  try {
    path = new URL(page.url).pathname;
  } catch (error) {
    path = '';
  }
  const slug = path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9.-]+/gi, '_').slice(0, 80);
  return `sahibinden_${slug || 'ilanlar'}_${dateIso}.${extension}`;
}

function safeFilePart(name) {
  return String(name).replace(/[^a-z0-9._-]/gi, '_');
}

/**
 * ============================================================================
 * EXCHANGE RATES
 * ============================================================================
 * Rates are TL per one unit. GRA is one gram of gold.
 */
const RATE_UNITS = [
  { code: 'USD', label: 'Dolar', suffix: '$', digits: 0 },
  { code: 'EUR', label: 'Euro', suffix: '€', digits: 0 },
  { code: 'GBP', label: 'Sterlin', suffix: '£', digits: 0 },
  { code: 'GRA', label: 'Gram altın', suffix: 'gr', digits: 1 }
];
const GRAMS_PER_TROY_OUNCE = 31.1034768;

function validRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseTruncgilRates(body) {
  const selling = (code) => validRate(body && body[code] && body[code].Selling);
  const rates = { USD: selling('USD'), EUR: selling('EUR'), GBP: selling('GBP'), GRA: selling('GRA') };
  if (Object.values(rates).some((rate) => rate === null)) return null;
  return { ...rates, source: 'Truncgil Finans', updatedAt: (body && body.Update_Date) || '' };
}

/** Fallback. Gold is ounce price divided into grams, so it can differ from the Turkish market's gram price. */
function parseFallbackRates(frankfurter, gold) {
  const tryPerUsd = validRate(frankfurter && frankfurter.rates && frankfurter.rates.TRY);
  const eurPerUsd = validRate(frankfurter && frankfurter.rates && frankfurter.rates.EUR);
  const gbpPerUsd = validRate(frankfurter && frankfurter.rates && frankfurter.rates.GBP);
  const ounceUsd = validRate(gold && gold.price);
  if (!tryPerUsd || !eurPerUsd || !gbpPerUsd || !ounceUsd) return null;
  return {
    USD: tryPerUsd,
    EUR: tryPerUsd / eurPerUsd,
    GBP: tryPerUsd / gbpPerUsd,
    GRA: (ounceUsd / GRAMS_PER_TROY_OUNCE) * tryPerUsd,
    source: 'Frankfurter ve Gold API (altın ons fiyatından hesaplandı)',
    updatedAt: (frankfurter && frankfurter.date) || ''
  };
}

/** A manual value wins for that unit only */
function applyManualRates(rates, manual) {
  const merged = { ...(rates || {}) };
  let changed = false;
  RATE_UNITS.forEach(({ code }) => {
    const value = validRate(manual && manual[code]);
    if (value) {
      merged[code] = value;
      changed = true;
    }
  });
  if (!changed) return rates || null;
  merged.source = rates ? `${rates.source}, elle düzeltilmiş` : 'Elle girildi';
  return merged;
}

/** { USD: 210000, EUR: ..., GRA: 1665.2 } for a price in any supported currency */
function convertPrice(price, rates) {
  if (!price || price.amount === null || price.amount === undefined || !rates) return null;
  const currency = price.currency || 'TL';
  const inTl = currency === 'TL' ? price.amount : validRate(rates[currency]) ? price.amount * rates[currency] : null;
  if (inTl === null) return null;
  const result = {};
  RATE_UNITS.forEach(({ code, digits }) => {
    const rate = validRate(rates[code]);
    if (!rate) return;
    const factor = 10 ** digits;
    result[code] = Math.round((inTl / rate) * factor) / factor;
  });
  return result;
}

/**
 * ============================================================================
 * DERIVED DATA
 * ============================================================================
 */
const PHONE_PATTERN = /(?:\+?90[\s.-]*)?(?:0[\s.-]*)?\(?0?[2-5]\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g;

/** Numbers the seller typed into the text, one format, no repeats */
function extractPhones(text) {
  const found = String(text == null ? '' : text).match(PHONE_PATTERN) || [];
  const phones = found.map((raw) => {
    const digits = raw.replace(/\D/g, '').slice(-10);
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
  });
  return [...new Set(phones)];
}

/** Pulls commonly written facts from free text. Everything here is what the seller wrote. */
function parseDescription(text) {
  const source = String(text == null ? '' : text);
  const lower = source.toLocaleLowerCase('tr');
  const result = {};

  const tramer = source.match(/tramer[^\d\n]{0,25}(\d[\d.,]*)\s*(bin)?/i);
  if (/tramer(siz|\s*(kaydı\s*)?yok)/i.test(lower)) result.tramer = 'Yok';
  else if (tramer) {
    const amount = Number(tramer[1].replace(/\./g, '').replace(',', '.'));
    result.tramer = tramer[2] ? amount * 1000 : amount;
  }

  const facade = [...new Set((lower.match(/(güney|kuzey|doğu|batı)(\s*-?\s*(güney|kuzey|doğu|batı))?\s*cephe/g) || []))];
  if (facade.length > 0) result.facade = facade.join(', ');

  const keywords = [
    ['Acil', /\bacil\b/],
    ['Pazarlık payı var', /pazarlık\s*pay/],
    ['Pazarlık yok', /pazarlık\s*(yok|yapılmaz)|son\s*fiyat/],
    ['Takas', /\btakas\b/],
    ['Kiracılı', /kiracılı/],
    ['Boş', /\bboş\s*(daire|teslim|durumda)/],
    ['Krediye uygun', /krediye\s*uygun/],
    ['Kat mülkiyeti', /kat\s*mülkiyet/],
    ['Kat irtifakı', /kat\s*irtifak/],
    ['Hisseli tapu', /hisseli/],
    ['İmarlı', /imarlı|konut\s*imar/],
    ['Yola cepheli', /yola\s*(sıfır|cephe)/],
    ['Elektrik var', /elektrik(\s*(var|mevcut|hattı))/],
    ['Su var', /\bsu\s*(var|mevcut|hattı)/],
    ['Bakımlı', /bakımlı|bakımları\s*yapıl/],
    ['Boyasız', /boyasız/],
    ['Değişensiz', /değişensiz/]
  ];
  const found = keywords.filter(([, pattern]) => pattern.test(lower)).map(([label]) => label);
  if (found.length > 0) result.keywords = found.join(', ');

  const lines = source.split('\n').map((line) => line.trim());
  const start = lines.findIndex((line) => /^ekstra(lar)?\s*:?$/i.test(line));
  if (start !== -1) {
    const extras = [];
    for (let index = start + 1; index < lines.length && lines[index]; index += 1) {
      extras.push(lines[index].replace(/^[·•*\-\s]+/, ''));
    }
    if (extras.length > 0) result.extras = extras.join(' | ');
  }
  return result;
}

/** Ordered [label, value] pairs. A value only appears when its inputs exist in this listing. */
/**
 * ============================================================================
 * VEHICLES
 * ============================================================================
 * Everything here reads data the opened listing page already holds. Signals are
 * what the seller wrote, shown in their words: no claim about the car is made.
 */
const VEHICLE_SIGNALS = [
  ['Şase, podye, direk', 'sase|podye|podya|direk(?!t)|diregi'],
  ['Airbag', 'airbag|hava yasti'],
  ['KM', '(?:orjinal|orijinal)\\s+km|km\\s+(?:orjinal|orijinal|degis)|km\\s*\\S*\\s*(?:orjinal|orijinal)'],
  ['Tramer ve hasar kaydı', 'tramer|hasar\\s+kay'],
  ['Muayene', 'muayene|vize'],
  ['Ekspertiz', 'ekspertiz|expertiz|eksper'],
  ['Bakım', 'triger|bakim']
];
const SIGNAL_REACH = 6;

/** Same length as the input, so positions carry over. "AIRBAG", "aırbag" and "airbag" all match. */
function foldText(text) {
  return text.toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

function findSnippets(text, source) {
  const words = String(text == null ? '' : text).normalize('NFC').split(/\s+/).filter(Boolean);
  const folded = words.map(foldText);
  const starts = [];
  let offset = 0;
  folded.forEach((word) => {
    starts.push(offset);
    offset += word.length + 1;
  });
  const wordAt = (position) => {
    let index = 0;
    while (index + 1 < starts.length && starts[index + 1] <= position) index += 1;
    return index;
  };
  const snippets = [];
  let covered = -1;
  for (const match of folded.join(' ').matchAll(new RegExp(`(?<!\\p{L})(?:${source})`, 'gu'))) {
    const first = wordAt(match.index);
    if (first <= covered) continue;
    const last = wordAt(match.index + match[0].length - 1);
    const from = Math.max(0, first - SIGNAL_REACH);
    const to = Math.min(words.length, last + SIGNAL_REACH + 1);
    snippets.push({
      before: `${from > 0 ? '… ' : ''}${words.slice(from, first).join(' ')}`.trim(),
      match: words.slice(first, last + 1).join(' '),
      after: `${words.slice(last + 1, to).join(' ')}${to < words.length ? ' …' : ''}`.trim()
    });
    covered = to - 1;
    if (snippets.length === 2) break;
  }
  return snippets;
}

function customTermSource(term) {
  return foldText(String(term).normalize('NFC').trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

/** [{ label, snippets }] for each topic the description mentions, then the user's own search words */
function vehicleSignals(description, customTerms) {
  const signals = [];
  VEHICLE_SIGNALS.forEach(([label, source]) => {
    const snippets = findSnippets(description, source);
    if (snippets.length > 0) signals.push({ label, snippets });
  });
  (customTerms || []).map((term) => String(term).trim()).filter(Boolean).forEach((term) => {
    const snippets = findSnippets(description, customTermSource(term));
    if (snippets.length > 0) signals.push({ label: term, snippets, custom: true });
  });
  return signals;
}

function signalText(signal) {
  return signal.snippets.map(({ before, match, after }) => [before, match, after].filter(Boolean).join(' ')).join(' | ');
}

function vehicleSignalNames(customTerms) {
  return [
    ...VEHICLE_SIGNALS.map(([label]) => `Açıklama: ${label}`),
    ...(customTerms || []).map((term) => String(term).trim()).filter(Boolean).map((term) => `Arama: ${term}`)
  ];
}

function signalColumn(record, name, customTerms) {
  const label = name.replace(/^(Açıklama|Arama): /, '');
  const signal = vehicleSignals(record.description, customTerms).find((item) => item.label === label);
  return signal ? signalText(signal) : '';
}

function isVehicle(record) {
  if ((record.category || []).some((name) => /^vasıta$/i.test(String(name).trim()))) return true;
  const fields = record.fields || {};
  return !!record.damage || (fields.KM !== undefined && fields['Yıl'] !== undefined);
}

function damageCounts(damage) {
  if (!damage) return null;
  return {
    changed: damage.changed.length,
    painted: damage.painted.length,
    localPainted: damage.localPainted.length,
    original: damage.originalCount
  };
}

/** Specs as [title, value]. The model year in the MTV title would otherwise make one column per model. */
function flatTechnical(record) {
  const seen = new Set();
  const rows = [];
  Object.values((record.technical && record.technical.sections) || {}).forEach((section) => {
    Object.entries(section).forEach(([title, value]) => {
      const clean = title.replace(/\s*\(\d{4} model.*\)\s*$/, '');
      if (seen.has(clean)) return;
      seen.add(clean);
      rows.push([clean, value]);
    });
  });
  return rows;
}

function technicalColumnNames(records) {
  const names = [];
  records.forEach((record) => {
    flatTechnical(record).forEach(([title]) => {
      if (!names.includes(title)) names.push(title);
    });
  });
  return names;
}

function vehiclePeerKey(record) {
  const fields = record.fields || {};
  if (fields.Marka && fields.Seri) return `${fields.Marka} ${fields.Seri}`;
  const category = record.category || [];
  if (category.length >= 4) return `${category[2]} ${category[3]}`;
  return fields.Marka || null;
}

function middleOf(values) {
  const sorted = values.filter((value) => value !== null && value !== undefined && value > 0).sort((a, b) => a - b);
  return sorted.length ? median(sorted) : null;
}

function percentFrom(value, base) {
  return value && base ? Math.round(((value - base) / base) * 100) : null;
}

/** This car against the same make and series in the basket. Needs 2 others, prefers close model years. */
function vehicleComparison(record, records) {
  const key = vehiclePeerKey(record);
  if (!key || !record.price || !record.price.amount) return null;
  const peers = records.filter((other) => other.id !== record.id
    && isVehicle(other)
    && vehiclePeerKey(other) === key
    && other.price && other.price.amount
    && other.price.currency === record.price.currency);
  const year = toNumber((record.fields || {})['Yıl']);
  const near = year === null ? [] : peers.filter((other) => {
    const otherYear = toNumber((other.fields || {})['Yıl']);
    return otherYear !== null && Math.abs(otherYear - year) <= 2;
  });
  const closeYears = near.length >= 2;
  const group = closeYears ? near : peers;
  if (group.length < 2) return null;
  const medianPrice = middleOf(group.map((other) => other.price.amount));
  const medianKm = middleOf(group.map((other) => toNumber((other.fields || {}).KM)));
  return {
    key,
    closeYears,
    count: group.length,
    medianPrice,
    medianKm,
    currency: record.price.currency,
    priceDiff: percentFrom(record.price.amount, medianPrice),
    kmDiff: percentFrom(toNumber((record.fields || {}).KM), medianKm)
  };
}

/** One summary row per make and series, largest group first */
function vehicleGroups(records) {
  const groups = new Map();
  records.filter(isVehicle).forEach((record) => {
    const key = vehiclePeerKey(record);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return [...groups.entries()].map(([key, members]) => {
    const { currency } = computeStats(members);
    const prices = members.filter((record) => record.price && record.price.currency === currency).map((record) => record.price.amount);
    return {
      key,
      count: members.length,
      currency,
      medianPrice: middleOf(prices),
      minPrice: prices.filter((price) => price > 0).length ? Math.min(...prices.filter((price) => price > 0)) : null,
      medianKm: middleOf(members.map((record) => toNumber((record.fields || {}).KM)))
    };
  }).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'tr'));
}

function computedFields(record, context) {
  const now = new Date((context && context.now) || Date.now());
  const fields = record.fields || {};
  const out = [];
  const add = (label, value) => {
    if (value !== null && value !== undefined && Number.isFinite(value)) out.push([label, value]);
  };
  const round1 = (value) => Math.round(value * 10) / 10;
  const number = (name) => toNumber(fields[name]);

  if (record.dateIso) {
    const days = Math.floor((now - new Date(`${record.dateIso}T00:00:00`)) / 86400000);
    if (days >= 0) add('Yayında (gün)', days);
  }
  const gross = number('m² (Brüt)');
  const net = number('m² (Net)');
  if (gross && net) add('Net/Brüt (%)', Math.round((net / gross) * 100));
  const dues = number('Aidat (TL)');
  if (dues && gross) add('m² Başına Aidat', round1(dues / gross));

  const year = number('Yıl');
  if (year && year > 1900 && year <= now.getFullYear()) {
    const age = now.getFullYear() - year;
    add('Araç Yaşı', age);
    const km = number('KM');
    if (km !== null) add('Yıllık KM', age > 0 ? Math.round(km / age) : km);
  }
  if (record.damage) {
    add('Değişen Parça Sayısı', record.damage.changed.length);
    add('Boyalı Parça Sayısı', record.damage.painted.length + record.damage.localPainted.length);
  }

  const land = number('m²');
  const kaks = number('Kaks (Emsal)');
  if (land && kaks) {
    const buildable = Math.round(land * kaks);
    add('Emsal İnşaat Alanı (m²)', buildable);
    if (record.price && record.price.amount) add('İnşaat m² Maliyeti', Math.round(record.price.amount / buildable));
  }

  const unit = unitPrice(record);
  const medianUnit = context && context.medianUnitPrice;
  if (unit && medianUnit) add('Medyana Göre Fark (%)', Math.round(((unit - medianUnit) / medianUnit) * 100));
  return out;
}

const DEFAULT_SCORE_WEIGHTS = { price: 60, freshness: 15, photos: 10, damage: 15 };

/** 0-100 from the basket's own data. Each part only counts when this listing has the data for it. */
function dealScore(record, context, weights) {
  const w = { ...DEFAULT_SCORE_WEIGHTS, ...(weights || {}) };
  const parts = [];
  const unit = unitPrice(record);
  const clamp = (value) => Math.max(0, Math.min(100, value));
  if (unit && context.medianUnitPrice) {
    parts.push([w.price, clamp(50 - ((unit - context.medianUnitPrice) / context.medianUnitPrice) * 100)]);
  } else if (record.price && record.price.amount && context.medianPrice) {
    parts.push([w.price, clamp(50 - ((record.price.amount - context.medianPrice) / context.medianPrice) * 100)]);
  }
  if (record.dateIso) {
    const days = (new Date(context.now || Date.now()) - new Date(`${record.dateIso}T00:00:00`)) / 86400000;
    parts.push([w.freshness, clamp(100 - days * 2)]);
  }
  if (record.photos) parts.push([w.photos, clamp(record.photos.length * 5)]);
  if (record.damage) {
    const damaged = record.damage.changed.length * 2 + record.damage.painted.length + record.damage.localPainted.length * 0.5;
    parts.push([w.damage, clamp(100 - damaged * 10)]);
  }
  const total = parts.reduce((sum, [weight]) => sum + Number(weight), 0);
  if (total <= 0) return null;
  return Math.round(parts.reduce((sum, [weight, value]) => sum + Number(weight) * value, 0) / total);
}

function basketContext(records, now) {
  const middle = (values) => {
    const sorted = values.filter((value) => value !== null && value !== undefined && value > 0).sort((a, b) => a - b);
    return sorted.length ? median(sorted) : null;
  };
  return {
    now,
    medianUnitPrice: middle(records.map(unitPrice)),
    medianPrice: middle(records.map((record) => record.price && record.price.amount))
  };
}

function recordsToGeoJson(records) {
  const features = records
    .filter((record) => toCoordinate(record.lat) !== null && toCoordinate(record.lon) !== null)
    .map((record) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [toCoordinate(record.lon), toCoordinate(record.lat)] },
      properties: {
        id: record.id,
        title: record.title,
        price: record.price ? record.price.amount : null,
        currency: record.price ? record.price.currency : '',
        url: record.url
      }
    }));
  return { type: 'FeatureCollection', features };
}

function toCoordinate(value) {
  const number = Number(value);
  return value !== '' && value !== null && value !== undefined && Number.isFinite(number) ? number : null;
}

function recordsToKml(records) {
  const escape = (text) => String(text == null ? '' : text).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const places = recordsToGeoJson(records).features.map(({ geometry, properties }) => {
    const price = properties.price === null ? '' : `${properties.price} ${properties.currency}`;
    return `    <Placemark><name>${escape(properties.title)}</name><description>${escape(`${price} ${properties.url}`.trim())}</description><Point><coordinates>${geometry.coordinates[0]},${geometry.coordinates[1]}</coordinates></Point></Placemark>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n${places.join('\n')}\n  </Document>\n</kml>\n`;
}

/** Tabs and line breaks would split cells when pasted into a sheet */
function toTsv(rows) {
  return rows
    .map((row) => row.map((cell) => csvSafeCell(cell).replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n');
}

/** Each preset names the columns to keep. Everything else is hidden, so it can't lose data. */
const COLUMN_PRESETS = {
  emlak: { label: 'Emlak', keep: ['İlan No', 'Başlık', 'Fiyat', 'Para Birimi', 'Hesaplanan Fiyat/m²', 'Konum', 'm² (Brüt)', 'm² (Net)', 'Oda Sayısı', 'Bina Yaşı', 'Bulunduğu Kat', 'Kat Sayısı', 'Isıtma', 'Aidat (TL)', 'Site Adı', 'Kimden', 'İlan Tarihi (ISO)', 'İlan Linki'] },
  arsa: { label: 'Arsa', keep: ['İlan No', 'Başlık', 'Fiyat', 'Para Birimi', 'm²', 'm² Fiyatı', 'Konum', 'İmar Durumu', 'Ada No', 'Parsel No', 'Kaks (Emsal)', 'Gabari', 'Tapu Durumu', 'Kimden', 'İlan Tarihi (ISO)', 'İlan Linki'] },
  vasita: { label: 'Vasıta', keep: ['İlan No', 'Başlık', 'Fiyat', 'Para Birimi', 'Marka', 'Seri', 'Model', 'Yıl', 'KM', 'Yakıt / Motor Tipi', 'Vites', 'Kasa Tipi', 'Renk', 'Ağır Hasar Kayıtlı', 'Motor Gücü', 'Motor Hacmi', 'Çekiş', 'Değişen Parçalar', 'Boyalı Parçalar', 'Lokal Boyalı Parçalar', 'Hasar Notları', 'Değişen Parça Sayısı', 'Boyalı Parça Sayısı', 'Yıllık KM', 'Açıklamada Tramer', 'Açıklama: Şase, podye, direk', 'Açıklama: Airbag', 'Açıklama: KM', 'Açıklama: Tramer ve hasar kaydı', 'Açıklama: Muayene', 'Açıklamadaki Telefon', 'Konum', 'Kimden', 'İlan Tarihi (ISO)', 'İlan Linki'] }
};

function hiddenColumnsForPreset(presetId, allNames) {
  const preset = COLUMN_PRESETS[presetId];
  return preset ? allNames.filter((name) => !preset.keep.includes(name)) : [];
}

/** Filters by free text, a tag and a price range, then sorts. The input array is left as it is. */
function filterAndSortRecords(records, options, annotations) {
  const { search = '', tag = '', minPrice = null, maxPrice = null, sortBy = 'lastSeen', descending = true } = options || {};
  const needle = search.trim().toLocaleLowerCase('tr');
  const notes = annotations || {};
  const valueOf = (record) => {
    if (sortBy === 'price') return record.price ? record.price.amount : null;
    if (sortBy === 'unitPrice') return unitPrice(record);
    if (sortBy === 'date') return record.dateIso || null;
    if (sortBy === 'title') return record.title;
    if (sortBy === 'rating') return notes[record.id] ? notes[record.id].rating || null : null;
    if (sortBy === 'score') return options.scoreOf ? options.scoreOf(record) : null;
    return record.lastSeen || null;
  };
  const filtered = records.filter((record) => {
    if (needle) {
      const haystack = `${record.title} ${record.id} ${record.location || ''} ${Object.values(record.fields || {}).join(' ')}`.toLocaleLowerCase('tr');
      if (!haystack.includes(needle)) return false;
    }
    if (tag && !((notes[record.id] || {}).tags || []).includes(tag)) return false;
    const amount = record.price ? record.price.amount : null;
    if (minPrice !== null && (amount === null || amount < minPrice)) return false;
    if (maxPrice !== null && (amount === null || amount > maxPrice)) return false;
    return true;
  });
  // Listings without the sorted value always go last, whichever way the sort runs
  return filtered.sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    const order = typeof left === 'string' ? left.localeCompare(right, 'tr') : left - right;
    return descending ? -order : order;
  });
}

function snapshotFromPage(page, now) {
  const listings = {};
  page.rows.forEach((row) => {
    listings[row.id] = { title: row.title, url: row.url, amount: row.price.amount, currency: row.price.currency };
  });
  return { url: page.url, category: page.category || [], total: page.total, savedAt: now, listings };
}

function diffSnapshots(previous, current) {
  const added = [];
  const missing = [];
  const priceChanged = [];
  Object.entries(current.listings).forEach(([id, listing]) => {
    const before = previous.listings[id];
    if (!before) {
      added.push({ id, ...listing });
    } else if (before.amount !== listing.amount || before.currency !== listing.currency) {
      priceChanged.push({ id, ...listing, previousAmount: before.amount, previousCurrency: before.currency });
    }
  });
  Object.entries(previous.listings).forEach(([id, listing]) => {
    if (!current.listings[id]) missing.push({ id, ...listing });
  });
  return { added, missing, priceChanged };
}

/** Same search, ignoring the page offset, so page 1 and page 2 are one saved search */
function searchKey(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('pagingOffset');
    parsed.searchParams.delete('viewType');
    return parsed.origin + parsed.pathname + parsed.search;
  } catch (error) {
    return String(url);
  }
}

/** Addresses of the next pages of a search, stopping at the last page the site reports */
function nextPageUrls(page, maxPages) {
  const urls = [];
  let parsed;
  try {
    parsed = new URL(page.url);
  } catch (error) {
    return urls;
  }
  const pageSize = page.rows.length;
  if (pageSize === 0) return urls;
  const start = Number(parsed.searchParams.get('pagingOffset')) || 0;
  for (let index = 1; index <= maxPages; index += 1) {
    const offset = start + pageSize * index;
    if (page.total !== null && page.total !== undefined && offset >= page.total) break;
    parsed.searchParams.set('pagingOffset', String(offset));
    urls.push(parsed.href);
  }
  return urls;
}

/** Equal-width bins for the price histogram; empty bins stay in so gaps remain visible */
function histogramBins(values, binCount) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (numbers.length === 0) return [];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  if (min === max) return [{ from: min, to: max, count: numbers.length }];
  const size = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({ from: min + size * index, to: min + size * (index + 1), count: 0 }));
  numbers.forEach((value) => {
    bins[Math.min(binCount - 1, Math.floor((value - min) / size))].count += 1;
  });
  return bins;
}

/** Rejects anything that isn't our own backup file before it can touch stored data */
function parseBackup(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: 'Dosya okunamadı. JSON biçiminde değil.' };
  }
  if (!body || body.app !== 'ilan-veri-indirici' || typeof body.basket !== 'object' || body.basket === null || Array.isArray(body.basket)) {
    return { ok: false, error: 'Bu dosya bu eklentinin yedeği değil.' };
  }
  const validRecord = (record) => record && typeof record === 'object' && /^\d+$/.test(String(record.id)) && typeof record.title === 'string';
  const basket = {};
  Object.values(body.basket).forEach((record) => {
    if (validRecord(record)) basket[record.id] = record;
  });
  return {
    ok: true,
    data: {
      basket,
      annotations: body.annotations && typeof body.annotations === 'object' ? body.annotations : {},
      savedSearches: body.savedSearches && typeof body.savedSearches === 'object' ? body.savedSearches : {},
      hiddenColumns: Array.isArray(body.hiddenColumns) ? body.hiddenColumns.filter((name) => typeof name === 'string') : [],
      vehicleTerms: Array.isArray(body.vehicleTerms) ? body.vehicleTerms.filter((term) => typeof term === 'string') : []
    }
  };
}

/**
 * ============================================================================
 * TKGM PARCEL LINK
 * ============================================================================
 */
/** "Denizli Mh." and TKGM's "DENİZLİ" compare equal */
function normalizeAdminName(name) {
  return String(name == null ? '' : name)
    .toLocaleLowerCase('tr')
    .replace(/\b(mahallesi|mahalle|mah|mh|köyü|köy)\b\.?/g, ' ')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseAdminList(body) {
  return ((body && body.features) || [])
    .map((feature) => feature.properties)
    .filter((item) => item && item.id && item.text)
    .map((item) => ({ id: item.id, text: item.text }));
}

function findAdminId(list, name) {
  const wanted = normalizeAdminName(name);
  if (!wanted) return null;
  const match = list.find((item) => normalizeAdminName(item.text) === wanted);
  return match ? match.id : null;
}

/** The numbers TKGM needs from a listing, or null when the seller left them out */
function parcelFromFields(fields) {
  const clean = (value) => (/^\d+$/.test(String(value == null ? '' : value).trim()) ? String(value).trim() : null);
  const ada = clean((fields || {})['Ada No']);
  const parsel = clean((fields || {})['Parsel No']);
  return ada && parsel ? { ada, parsel } : null;
}

function tkgmParcelUrl(neighbourhoodId, ada, parsel, now) {
  return `https://parselsorgu.tkgm.gov.tr/#ara/idari/${neighbourhoodId}/${ada}/${parsel}/${now}`;
}

/** Injects extractor.js into the tab's isolated world, then calls one of its functions */
async function runInTab(tabId, functionName, args) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['extractor.js'] });
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (name, callArgs) => self[name](...callArgs),
    args: [functionName, args || []]
  });
  return results[0].result;
}

if (typeof module !== 'undefined') {
  module.exports = {
    csvSafeCell,
    toCsv,
    normalizeNumberText,
    toNumber,
    unitPrice,
    splitLocationCell,
    listRowToRecord,
    detailToRecord,
    mergeRecord,
    mergePage,
    basketColumns,
    recordsToRows,
    listPageToRows,
    computeStats,
    exportFileName,
    safeFilePart,
    RATE_UNITS,
    parseTruncgilRates,
    parseFallbackRates,
    applyManualRates,
    convertPrice,
    extractPhones,
    isVehicle,
    vehicleSignals,
    signalText,
    damageCounts,
    vehicleComparison,
    vehicleGroups,
    flatTechnical,
    parseDescription,
    computedFields,
    dealScore,
    basketContext,
    recordsToGeoJson,
    recordsToKml,
    toTsv,
    COLUMN_PRESETS,
    hiddenColumnsForPreset,
    filterAndSortRecords,
    snapshotFromPage,
    diffSnapshots,
    searchKey,
    nextPageUrls,
    histogramBins,
    parseBackup,
    normalizeAdminName,
    parseAdminList,
    findAdminId,
    parcelFromFields,
    tkgmParcelUrl
  };
}
