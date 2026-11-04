// extractor.js - Read-only page extraction for sahibinden.com
// Injected on demand into the extension's isolated world.
// Rules: never write to the page DOM, never open dialogs, never log to the page console.
// Everything is driven by the page's own headers and labels, so new categories need no code.
// Uses textContent (not innerText) so the same code works on documents from DOMParser.

function sbClean(value) {
  return String(value == null ? '' : value).replace(/­/g, '').replace(/\s+/g, ' ').trim();
}

function sbText(element) {
  return element ? sbClean(element.textContent) : '';
}

/** Text with line breaks preserved (descriptions, two-line location cells) */
function sbMultilineText(element) {
  if (!element) return '';
  const out = [];
  const walk = (node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        out.push(child.textContent.replace(/\s+/g, ' '));
      } else if (child.nodeType === 1) {
        const tag = child.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') return;
        if (tag === 'BR') {
          out.push('\n');
          return;
        }
        const isBlock = /^(P|DIV|LI|UL|OL|H[1-6]|TR|TABLE|SECTION)$/.test(tag);
        if (isBlock) out.push('\n');
        walk(child);
        if (isBlock) out.push('\n');
      }
    });
  };
  walk(element);
  return out.join('')
    .replace(/­/g, '')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "1.228.000 TL" -> { amount: 1228000, currency: 'TL', raw } */
function sbParseMoney(text) {
  const raw = sbClean(text);
  const match = raw.match(/(\d[\d.,]*)\s*(TL|USD|EUR|GBP|₺|\$|€|£)?/i);
  if (!match) return { amount: null, currency: '', raw };
  const number = match[1].replace(/\./g, '').replace(',', '.');
  const symbols = { '₺': 'TL', '$': 'USD', '€': 'EUR', '£': 'GBP' };
  const unit = match[2] || '';
  return {
    amount: Number(number),
    currency: symbols[unit] || unit.toUpperCase(),
    raw
  };
}

/** "04 Kasım 2026" -> "2026-11-04" */
function sbParseDate(text) {
  const months = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
  const match = sbClean(text).match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!match) return '';
  const month = months.indexOf(match[2].toLocaleLowerCase('tr'));
  if (month === -1) return '';
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function sbImageUrl(img) {
  if (!img) return '';
  // Gallery photos keep the real URL in data-src until they are shown
  const candidates = [img.getAttribute('data-src'), img.getAttribute('src')];
  const url = candidates.find((value) => value && /^https?:/.test(value) && !/blank/i.test(value));
  return url || '';
}

function sbAbsoluteUrl(href, pageUrl) {
  if (!href) return '';
  try {
    const url = new URL(href, pageUrl);
    return url.origin + url.pathname;
  } catch (error) {
    return '';
  }
}

function sbJsonLd(doc) {
  const found = { breadcrumb: [], hasVideo: false };
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      [].concat(JSON.parse(script.textContent)).forEach((entry) => {
        if (entry['@type'] === 'VideoObject') found.hasVideo = true;
        if (entry['@type'] === 'BreadcrumbList') {
          found.breadcrumb = (entry.itemListElement || [])
            .map((item) => sbClean(item.name || (item.item && item.item.name)))
            .filter((name) => name && name !== 'Anasayfa');
        }
      });
    } catch (error) {
      // Malformed JSON-LD only costs the category path
    }
  });
  return found;
}

function sbIsBlocked(doc, hasContent) {
  if (doc.querySelector('#px-captcha, .g-recaptcha, .h-captcha, #challenge-form, iframe[src*="captcha" i]')) {
    return true;
  }
  if (hasContent) return false;
  return /captcha|olağan ?dışı|doğrulama|just a moment|access denied|erişim engel/i.test(doc.title || '');
}

/** Title icons: the store's logo carries the store's name, the others say video, tour, new */
function sbExtractRowBadges(row) {
  const icons = [...row.querySelectorAll('.titleIcon')];
  const titleOf = (icon) => sbClean(icon.getAttribute('title') || icon.getAttribute('alt'));
  const store = icons.find((icon) => icon.classList.contains('store-icon'));
  const storeName = store ? titleOf(store) : '';
  const badges = icons
    .filter((icon) => !icon.classList.contains('store-icon'))
    .map(titleOf)
    .filter((title) => title && title !== storeName);
  return { storeName, badges: [...new Set(badges)] };
}

function sbExtractList(doc, pageUrl) {
  const table = doc.querySelector('#searchResultsTable');
  const seenNames = {};
  const columns = [...table.querySelectorAll('thead tr td')].map((cell, index) => {
    const text = sbText(cell);
    const ignored = cell.classList.contains('searchResultsIgnoredColumn') || cell.classList.contains('ignore-me');
    let name = index === 0 ? 'Resim' : text || `Sütun ${index}`;
    seenNames[name] = (seenNames[name] || 0) + 1;
    if (seenNames[name] > 1) name = `${name} ${seenNames[name]}`;
    return { index, name, ignored };
  });

  const rows = [...table.querySelectorAll('tbody tr[data-id]')].map((row) => {
    const titleLink = row.querySelector('.classifiedTitle');
    const result = {
      id: row.getAttribute('data-id'),
      url: sbAbsoluteUrl(titleLink && titleLink.getAttribute('href'), pageUrl),
      title: sbText(titleLink),
      image: sbImageUrl(row.querySelector('.searchResultsLargeThumbnail img')),
      promoted: row.classList.contains('searchResultsPromoSuper'),
      urgent: row.classList.contains('searchResultsFireSale'),
      ...sbExtractRowBadges(row),
      price: { amount: null, currency: '', raw: '' },
      dateRaw: '',
      dateIso: '',
      cells: []
    };
    const dataCurrency = row.getAttribute('data-currency') || '';
    const tds = row.querySelectorAll('td');
    let priceSeen = false;

    columns.forEach((column) => {
      const cell = tds[column.index];
      if (!cell || column.index === 0 || column.ignored || cell.classList.contains('ignore-me')) return;
      let kind = 'attribute';
      let value = sbText(cell);

      if (cell.classList.contains('searchResultsTitleValue')) {
        kind = 'title';
        value = result.title;
      } else if (cell.classList.contains('searchResultsPriceValue')) {
        const span = cell.querySelector('span');
        const money = sbParseMoney(sbText(span) || sbText(cell));
        // m² Fiyatı shares this class but has no span, so only the first one is the price
        kind = priceSeen ? 'unitPrice' : 'price';
        if (!priceSeen) {
          priceSeen = true;
          result.price = { ...money, currency: money.currency || dataCurrency };
        }
        value = money.amount === null ? money.raw : money.amount;
      } else if (cell.classList.contains('searchResultsDateValue')) {
        kind = 'date';
        const spans = cell.querySelectorAll('span');
        value = spans.length >= 2 ? `${sbText(spans[0])} ${sbText(spans[1])}` : sbText(cell);
        result.dateRaw = value;
        result.dateIso = sbParseDate(value);
      } else if (cell.classList.contains('searchResultsLocationValue')) {
        kind = 'location';
        value = sbMultilineText(cell).split('\n').map(sbClean).filter(Boolean).join(' / ');
      } else if (cell.classList.contains('searchResultsTagAttributeValue')) {
        kind = 'tag';
      }
      result.cells.push({ name: column.name, kind, value });
    });
    return result;
  });

  return sbListResult(doc, pageUrl, columns.filter((column) => !column.ignored).map((column) => column.name), rows);
}

/** Gallery view has no table: each card is a cell with "Label: value" lines */
function sbExtractGallery(doc, pageUrl) {
  const columns = ['Resim', 'İlan Başlığı', 'Fiyat'];
  const rows = [...doc.querySelectorAll('td.searchResultsGalleryItem[data-id]')].map((card) => {
    const titleLink = card.querySelector('.classifiedTitle');
    const title = sbText(titleLink);
    const priceElement = card.querySelector('.searchResultsPriceValue');
    const money = sbParseMoney(sbText(priceElement && priceElement.querySelector('span')) || sbText(priceElement));
    const price = { ...money, currency: money.currency || card.getAttribute('data-currency') || '' };
    const result = {
      id: card.getAttribute('data-id'),
      url: sbAbsoluteUrl(titleLink && titleLink.getAttribute('href'), pageUrl),
      title,
      image: sbImageUrl(card.querySelector('.searchResultsLargeThumbnail img')),
      promoted: card.classList.contains('searchResultsPromoSuper'),
      urgent: card.classList.contains('searchResultsFireSale'),
      ...sbExtractRowBadges(card),
      price,
      dateRaw: '',
      dateIso: '',
      cells: [
        { name: 'İlan Başlığı', kind: 'title', value: title },
        { name: 'Fiyat', kind: 'price', value: price.amount === null ? price.raw : price.amount }
      ]
    };
    card.querySelectorAll('.searchResultsGallerySubContent > div').forEach((line) => {
      const text = sbText(line);
      const separator = text.indexOf(':');
      if (separator === -1) return;
      const name = sbClean(text.slice(0, separator));
      let value = sbClean(text.slice(separator + 1));
      let kind = 'attribute';
      if (/tarih/i.test(name)) {
        kind = 'date';
        result.dateRaw = value;
        result.dateIso = sbParseDate(value);
      } else if (/fiyat/i.test(name)) {
        kind = 'unitPrice';
        const unit = sbParseMoney(value);
        value = unit.amount === null ? unit.raw : unit.amount;
      } else if (/^(il|ilçe|semt|mahalle)\b/i.test(name)) {
        kind = 'location';
      }
      if (!columns.includes(name)) columns.push(name);
      result.cells.push({ name, kind, value });
    });
    return result;
  });
  return sbListResult(doc, pageUrl, columns, rows);
}

function sbListResult(doc, pageUrl, columns, rows) {
  const summary = sbText(doc.querySelector('.result-text, .resultsTextWrapper, #resultsCount'));
  const totalMatch = summary.match(/(\d[\d.]*)\s*ilan/);
  return {
    pageType: 'list',
    url: pageUrl,
    columns,
    rows,
    total: totalMatch ? Number(totalMatch[1].replace(/\./g, '')) : null,
    category: sbJsonLd(doc).breadcrumb
  };
}

function sbExtractDamage(doc) {
  const parts = [...doc.querySelectorAll('.car-parts > *')];
  // That list also repeats the part names under group titles. Those are already in the parts above.
  const noteElements = [...doc.querySelectorAll('.car-damage-info-list li:not(.pair-title):not(.selected-damage)')];
  if (parts.length === 0 && noteElements.length === 0) return null;
  const damage = { changed: [], painted: [], localPainted: [], originalCount: 0, notes: noteElements.map(sbText).filter(Boolean) };
  parts.forEach((part) => {
    const classes = String(part.className);
    const name = classes.trim().split(/\s+/)[0];
    if (/local-painted/.test(classes)) damage.localPainted.push(name);
    else if (/painted/.test(classes)) damage.painted.push(name);
    else if (/changed/.test(classes)) damage.changed.push(name);
    else if (/original/.test(classes)) damage.originalCount += 1;
  });
  return damage;
}

/** The model's general specs and standard equipment, as the listing page already holds them */
function sbExtractTechnical(doc) {
  const root = doc.querySelector('#technical-details');
  if (!root) return null;
  const sections = {};
  root.querySelectorAll('h3').forEach((heading) => {
    const table = heading.nextElementSibling;
    if (!table || table.tagName !== 'TABLE') return;
    const rows = {};
    table.querySelectorAll('tr').forEach((row) => {
      const title = sbText(row.querySelector('td.title'));
      const value = sbText(row.querySelector('td.value'));
      if (title && value) rows[title] = value;
    });
    if (Object.keys(rows).length > 0) sections[sbText(heading)] = rows;
  });
  const equipment = {};
  let category = 'Diğer';
  const equipmentTable = root.querySelector('.equipments li table');
  if (equipmentTable) {
    equipmentTable.querySelectorAll('tr').forEach((row) => {
      const heading = row.querySelector('td[colspan] b');
      if (heading) {
        category = sbText(heading);
        return;
      }
      const item = sbText(row.querySelector('td.equipmentDescription'));
      if (!item) return;
      if (!equipment[category]) equipment[category] = [];
      equipment[category].push(item);
    });
  }
  if (Object.keys(sections).length === 0 && Object.keys(equipment).length === 0) return null;
  return { sections, equipment };
}

/**
 * Business details only. The personal name is left alone, and so is the phone field:
 * the site keeps that number encrypted on purpose and it is not decoded here.
 */
function sbExtractSeller(doc) {
  const box = doc.querySelector('.classifiedUserBox, .user-info-module');
  if (!box) return { storeName: '', license: '', memberSince: '' };
  const since = sbText(box).match(/Hesap açma tarihi\s*:?\s*([^\d\s]+\s+\d{4})/i);
  return {
    storeName: sbText(box.querySelector('.user-info-store-name a')),
    license: sbText(box.querySelector('.user-info-license-id-value')),
    memberSince: since ? sbClean(since[1]) : sbText(box.querySelector('.tipitip-target strong'))
  };
}

function sbExtractDetail(doc, pageUrl) {
  const attributes = {};
  doc.querySelectorAll('.classifiedInfoList .classifiedInfoItem').forEach((item) => {
    const key = sbText(item.querySelector('dt'));
    if (key) attributes[key] = sbText(item.querySelector('dd'));
  });

  const features = {};
  doc.querySelectorAll('#classifiedProperties h3').forEach((heading) => {
    const next = heading.nextElementSibling;
    if (!next || next.tagName !== 'UL') return;
    features[sbText(heading)] = [...next.querySelectorAll('li.selected')].map(sbText).filter(Boolean);
  });

  let photos = [...doc.querySelectorAll('.classifiedDetailMainPhoto img')].map(sbImageUrl).filter(Boolean);
  if (photos.length === 0) {
    photos = [...doc.querySelectorAll('.classifiedDetailThumbList img')]
      .map(sbImageUrl)
      .filter(Boolean)
      .map((url) => url.replace('/thmb_', '/x5_'));
  }
  photos = [...new Set(photos)];

  const locationLinks = [...doc.querySelectorAll('.classifiedLocation a')].map(sbText).filter(Boolean);
  const map = doc.querySelector('#gmap');
  const usableMap = map && map.getAttribute('data-corrupt') !== 'true';
  const ld = sbJsonLd(doc);
  const id = attributes['İlan No'] || '';
  const dateRaw = attributes['İlan Tarihi'] || '';
  delete attributes['İlan No'];
  delete attributes['İlan Tarihi'];

  return {
    id,
    url: sbAbsoluteUrl(pageUrl, pageUrl),
    title: sbText(doc.querySelector('.classifiedDetailTitle h1')),
    price: sbParseMoney(sbText(doc.querySelector('.classifiedPriceValue, .classifiedPrice h3, .classifiedPrice'))),
    dateRaw,
    dateIso: sbParseDate(dateRaw),
    category: ld.breadcrumb,
    location: {
      raw: sbText(doc.querySelector('.classifiedLocation')),
      il: locationLinks[0] || '',
      ilce: locationLinks[1] || '',
      mahalle: locationLinks[2] || ''
    },
    attributes,
    features,
    damage: sbExtractDamage(doc),
    technical: sbExtractTechnical(doc),
    description: sbMultilineText(doc.querySelector('#classifiedDescription')),
    photos,
    lat: usableMap ? map.getAttribute('data-lat') || '' : '',
    lon: usableMap ? map.getAttribute('data-lon') || '' : '',
    hasVideo: ld.hasVideo,
    seller: sbExtractSeller(doc),
    media: {
      video: !!doc.querySelector('.videoLink'),
      clip: !!doc.querySelector('.photo-clip-link'),
      tour: !!doc.querySelector('.virtualTourLink')
    }
  };
}

/** Classify a document and pull everything out of it. Seller names and the protected phone field are never read. */
function sbExtractFromDocument(doc, pageUrl) {
  const hasTable = !!doc.querySelector('#searchResultsTable');
  const hasGallery = !!doc.querySelector('td.searchResultsGalleryItem[data-id]');
  const hasDetail = !!doc.querySelector('.classifiedDetail .classifiedInfoList');
  if (sbIsBlocked(doc, hasTable || hasGallery || hasDetail)) return { pageType: 'blocked', url: pageUrl };
  if (hasDetail) return { pageType: 'detail', url: pageUrl, listing: sbExtractDetail(doc, pageUrl) };
  if (hasTable) return sbExtractList(doc, pageUrl);
  if (hasGallery) return sbExtractGallery(doc, pageUrl);
  return { pageType: 'other', url: pageUrl };
}

function extractPage() {
  return sbExtractFromDocument(document, location.href);
}

/** Experimental tab only: read one listing without opening it. Runs in the sahibinden tab. */
async function fetchListingInPage(url) {
  const target = new URL(url);
  if (target.origin !== location.origin) return { status: 'unexpected' };
  const response = await fetch(target.href, { credentials: 'same-origin' });
  if (!response.ok) return { status: 'http', code: response.status };
  const html = await response.text();
  const page = sbExtractFromDocument(new DOMParser().parseFromString(html, 'text/html'), response.url);
  if (page.pageType === 'blocked') return { status: 'blocked' };
  if (page.pageType !== 'detail' || !page.listing.id) return { status: 'unexpected' };
  return { status: 'ok', listing: page.listing };
}

/** High-risk tools only: read another results page of the open search */
async function fetchListPageInPage(url) {
  const target = new URL(url);
  if (target.origin !== location.origin) return { status: 'unexpected' };
  const response = await fetch(target.href, { credentials: 'same-origin' });
  if (!response.ok) return { status: 'http', code: response.status };
  const html = await response.text();
  const page = sbExtractFromDocument(new DOMParser().parseFromString(html, 'text/html'), target.href);
  if (page.pageType === 'blocked') return { status: 'blocked' };
  if (page.pageType !== 'list') return { status: 'unexpected' };
  return { status: 'ok', page };
}

/** High-risk tools only: the same call the site makes when you click the price history icon */
async function fetchPriceHistoryInPage(id) {
  if (!/^\d+$/.test(String(id))) return { status: 'unexpected' };
  const response = await fetch(`/ajax/classified/${id}/loadPriceInfoWithHistory`, {
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  });
  if (!response.ok) return { status: 'http', code: response.status };
  let body;
  try {
    body = await response.json();
  } catch (error) {
    return { status: 'blocked' };
  }
  if (!body || !body.success || !body.data) return { status: 'unexpected' };
  const { initialPrice, realPrice, trend, sortedHistory } = body.data;
  return { status: 'ok', history: { initialPrice, realPrice, trend, entries: sortedHistory || [] } };
}

/** Image tab: listing photos on sahibinden pages, a full size-grouped scan on other sites */
function scanPageForImages() {
  const page = extractPage();
  const group = (title, images) => ({
    renderedDimensions: title,
    type: 'İlan',
    images: images.map((image) => ({ ...image, type: 'jpg', alt: '', actualWidth: 0, actualHeight: 0 }))
  });

  if (page.pageType === 'detail') {
    const { id, photos } = page.listing;
    return {
      folder: `sahibinden_${id}`,
      groups: photos.length === 0 ? {} : {
        photos: group('İlan fotoğrafları', photos.map((url, index) => ({
          url,
          filename: `${id}_${String(index + 1).padStart(2, '0')}`
        })))
      }
    };
  }
  if (page.pageType === 'list') {
    const images = page.rows.filter((row) => row.image).map((row) => ({ url: row.image, filename: row.id }));
    return {
      folder: 'sahibinden_liste_gorselleri',
      groups: images.length === 0 ? {} : { listing: group('Liste küçük resimleri', images) }
    };
  }

  const seen = new Set();
  const groups = {};
  const typeOf = (url) => {
    const extension = url.split(/[?#]/)[0].split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(extension) ? extension : 'unknown';
  };
  const add = (url, width, height, naturalWidth, naturalHeight, alt) => {
    if (!url || !url.startsWith('http') || seen.has(url) || width === 0 || height === 0) return;
    seen.add(url);
    const type = typeOf(url);
    const key = `${Math.round(width)}x${Math.round(height)}-${type}`;
    if (!groups[key]) {
      groups[key] = { renderedDimensions: `${Math.round(width)}×${Math.round(height)}`, area: width * height, type, images: [] };
    }
    groups[key].images.push({ url, alt, type, actualWidth: naturalWidth, actualHeight: naturalHeight });
  };

  document.querySelectorAll('img').forEach((img) => {
    add(img.src, img.offsetWidth, img.offsetHeight, img.naturalWidth, img.naturalHeight, img.alt || '');
  });
  document.querySelectorAll('*').forEach((element) => {
    const match = window.getComputedStyle(element).backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (match) add(match[1], element.offsetWidth, element.offsetHeight, element.offsetWidth, element.offsetHeight, '');
  });

  const sorted = {};
  Object.keys(groups)
    .sort((a, b) => groups[b].images.length - groups[a].images.length || groups[b].area - groups[a].area)
    .forEach((key) => { sorted[key] = groups[key]; });
  return { folder: `${location.hostname.replace('www.', '')}_images`, groups: sorted };
}
