// ui.js - Helpers shared by the popup, side panel and workspace pages

const ICON_PATHS = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  basket: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  flask: '<path d="M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.5a1 1 0 0 0 .9 1.5h12.8a1 1 0 0 0 .9-1.5l-5.1-10.1a2 2 0 0 1-.2-.9V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  sliders: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
  open: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-5"/><path d="M13 17V7"/><path d="M18 17v-9"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  compare: '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  map: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'
};

function iconSvg(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

function hydrateIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach((holder) => {
    holder.insertAdjacentHTML('afterbegin', iconSvg(holder.getAttribute('data-icon')));
    holder.removeAttribute('data-icon');
  });
}

/** Builds elements with textContent, so text taken from a page is never parsed as HTML */
function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.append(value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'icon') node.insertAdjacentHTML('afterbegin', iconSvg(value));
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  });
  [].concat(children || []).filter(Boolean).forEach((child) => {
    node.append(child);
  });
  return node;
}

const $ = (id) => document.getElementById(id);
const todayIso = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value, digits) => Number(value).toLocaleString('tr-TR', digits === undefined ? undefined : { maximumFractionDigits: digits });

function formatPrice(price) {
  if (!price) return '';
  if (price.amount === null || price.amount === undefined) return price.raw || '';
  return `${formatNumber(price.amount)} ${price.currency || ''}`.trim();
}

function downloadTextFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  chrome.downloads.download({ url, filename, conflictAction: 'uniquify', saveAs: false }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}

function downloadCsv(rows, filename) {
  // BOM ekleyerek UTF-8 formatını belirt
  downloadTextFile(`﻿${toCsv(rows)}`, filename, 'text/csv;charset=utf-8;');
}

function downloadJson(data, filename) {
  downloadTextFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

/** Saves a switch. Every open extension page hears the storage change and redraws itself. */
async function setFeature(feature, on) {
  if (on) {
    for (const dependency of feature.requires || []) await saveFeature(dependency, true);
  }
  await saveFeature(feature.id, on);
  await chrome.runtime.sendMessage({ action: 'features-changed' });
}

/** Calls back when any switch changes, in this page or another one */
function onFeaturesChanged(callback) {
  let timer = null;
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.features && !changes.sessionFeatures) return;
    clearTimeout(timer);
    timer = setTimeout(callback, 30);
  });
}

/**
 * The list of switches, used by the popup and the workspace. High-risk ones ask here in the row:
 * a native dialog can close the popup and lose the answer.
 */
function renderFeatureSettings(container, features, onStatus) {
  const focused = document.activeElement && document.activeElement.getAttribute('aria-label');
  container.textContent = '';
  FEATURE_GROUPS.forEach((group) => {
    const members = FEATURES.filter((feature) => feature.group === group.id);
    const onCount = members.filter((feature) => features[feature.id]).length;
    const list = el('div', { class: 'feature-list' });
    members.forEach((feature) => list.appendChild(renderFeatureRow(feature, features, onStatus)));
    container.appendChild(el('section', { class: 'feature-group' }, [
      el('div', { class: 'feature-group-head' }, [
        el('h2', { text: group.title }),
        el('span', { class: 'small muted', text: `${onCount}/${members.length} açık` })
      ]),
      list
    ]));
  });
  if (focused) {
    const again = container.querySelector(`[aria-label="${focused}"]`);
    if (again) again.focus();
  }
}

function renderFeatureRow(feature, features, onStatus) {
  const on = features[feature.id];
  const input = el('input', { type: 'checkbox', 'aria-label': feature.title });
  input.checked = on;
  const confirmBox = el('div', { class: 'feature-confirm', hidden: true }, [
    el('div', { class: 'notice', icon: 'alert' }, el('span', {
      text: 'Bu özellik siteye ek istek gönderir. Site bunu otomasyon sayıp hesabını kısıtlayabilir, kullanım koşullarına da aykırı olabilir. Risk sana aittir.'
    })),
    el('div', { class: 'btn-row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Riski kabul ediyorum, aç',
        onclick: async () => {
          await setFeature(feature, true);
          onStatus(`${feature.title} açıldı. Burada görünür: ${feature.where}.`);
        }
      }),
      el('button', {
        class: 'btn', type: 'button', text: 'Vazgeç',
        onclick: () => {
          confirmBox.hidden = true;
          input.checked = false;
        }
      })
    ])
  ]);
  input.addEventListener('change', async () => {
    if (input.checked && feature.risk === 'high') {
      confirmBox.hidden = false;
      return;
    }
    await setFeature(feature, input.checked);
    onStatus(input.checked ? `${feature.title} açıldı. Burada görünür: ${feature.where}.` : `${feature.title} kapatıldı.`);
  });
  const row = el('div', { class: `feature-row${on ? ' is-on' : ''}` }, [
    el('div', { class: 'feature-main' }, [
      el('div', {}, [
        el('div', { class: 'feature-title' }, [
          el('span', { text: feature.title }),
          el('span', { class: `pill pill-${feature.risk}`, text: RISK_LABELS[feature.risk] })
        ]),
        el('p', { class: 'feature-desc', text: feature.desc }),
        on ? el('p', { class: 'feature-where', text: `Burada görünür: ${feature.where}` }) : null
      ]),
      el('label', { class: 'switch' }, [input, el('span')])
    ]),
    confirmBox
  ]);
  if (feature.id === 'manualRates' && on) row.appendChild(renderManualRates());
  return row;
}

function renderManualRates() {
  const holder = el('div', { class: 'manual-rates' });
  chrome.storage.local.get('manualRates').then(({ manualRates = {} }) => {
    RATE_UNITS.forEach(({ code, label }) => {
      const input = el('input', { type: 'number', min: '0', step: 'any', class: 'num', placeholder: 'Canlı kur' });
      input.value = manualRates[code] || '';
      input.addEventListener('change', async () => {
        const { manualRates: latest = {} } = await chrome.storage.local.get('manualRates');
        latest[code] = input.value === '' ? null : Number(input.value);
        await chrome.storage.local.set({ manualRates: latest });
      });
      holder.appendChild(el('label', { class: 'field' }, [el('span', { text: `1 ${label} (TL)` }), input]));
    });
  });
  return holder;
}

function renderThemePicker(container) {
  container.textContent = '';
  const choice = currentThemeChoice();
  const picker = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Tema' });
  [['light', 'Açık'], ['dark', 'Koyu'], ['system', 'Sistem']].forEach(([value, label]) => {
    picker.appendChild(el('button', {
      type: 'button', text: label, 'aria-pressed': String(choice === value),
      onclick: () => {
        setThemeChoice(value);
        renderThemePicker(container);
      }
    }));
  });
  container.appendChild(picker);
}

/** What the switched-on data features add for one listing, as label and value pairs */
function listingInsights(record, features, context) {
  const facts = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null && value !== '') facts.push([label, value]);
  };
  if (features.computedFields) {
    computedFields(record, context || {}).forEach(([label, value]) => add(label, formatNumber(value, 1)));
  }
  if (features.descriptionParsing) {
    const parsed = parseDescription(record.description);
    add('Açıklamada tramer', typeof parsed.tramer === 'number' ? `${formatNumber(parsed.tramer)} TL` : parsed.tramer);
    add('Açıklamada cephe', parsed.facade);
    add('Açıklamada geçenler', parsed.keywords);
    add('Açıklamada ekstralar', parsed.extras);
  }
  if (features.extraData) {
    add('Mağaza', record.storeName);
    add('Yetki belge no', record.license);
    add('Üyelik', record.memberSince);
    add('Rozetler', (record.badges || []).join(', '));
    const media = record.media || {};
    add('Medya', [media.video && 'Video', media.clip && 'Klip', media.tour && 'Sanal tur'].filter(Boolean).join(', '));
  }
  return facts;
}

function renderFacts(facts) {
  const list = el('dl', { class: 'facts' });
  facts.forEach(([label, value]) => {
    list.append(el('dt', { text: label }), el('dd', { text: String(value) }));
  });
  return list;
}

/** Opens the parcel on the TKGM map. When a name can't be matched it opens the search page instead. */
async function openTkgmParcel(place, parcel, onStatus) {
  const result = await chrome.runtime.sendMessage({ action: 'tkgm-link', data: { ...place, ...parcel } }).catch(() => null);
  if (result && result.status === 'success') {
    chrome.tabs.create({ url: result.url });
    return;
  }
  const text = `${place.il} / ${place.ilce} / ${place.mahalle}, Ada ${parcel.ada}, Parsel ${parcel.parsel}`;
  await navigator.clipboard.writeText(text).catch(() => {});
  onStatus(`${result && result.error ? result.error : 'TKGM servisine ulaşılamadı.'} Bilgiler panoya kopyalandı, arama sayfası açılıyor.`);
  setTimeout(() => chrome.tabs.create({ url: 'https://parselsorgu.tkgm.gov.tr/' }), 1800);
}

/** The current rates, with manual values applied. Asks for nothing when both switches are off. */
async function loadRates(features, force) {
  if (!features.liveRates && !features.manualRates) return { status: 'off', rates: null };
  let result = { status: 'off', rates: null };
  if (features.liveRates) result = await chrome.runtime.sendMessage({ action: 'rates-get', data: { force: !!force } });
  if (features.manualRates) {
    const { manualRates = {} } = await chrome.storage.local.get('manualRates');
    const merged = applyManualRates(result.rates, manualRates);
    return { ...result, status: merged ? (result.status === 'stale' ? 'stale' : 'success') : result.status, rates: merged };
  }
  return result;
}

/** Everything the export needs to know, gathered once */
async function exportContext(features, rates) {
  const { annotations = {}, scoreWeights } = await chrome.storage.local.get(['annotations', 'scoreWeights']);
  return {
    features,
    rates,
    annotations,
    scoreWeights,
    now: Date.now(),
    includeRemoteHistory: features.bulkPriceHistory
  };
}

function renderStats(container, records) {
  const { stats, mixedCurrency, currency } = computeStats(records);
  container.textContent = '';
  if (stats.length === 0) return;

  const table = el('table', { class: 'stats-table' });
  const head = table.insertRow();
  ['', 'En düşük', 'Medyan', 'En yüksek'].forEach((label) => {
    head.appendChild(el('th', { text: label, scope: 'col' }));
  });
  stats.slice(0, 6).forEach((stat) => {
    const row = table.insertRow();
    row.insertCell().textContent = stat.unit ? `${stat.label} (${stat.unit})` : stat.label;
    // A model year is a label, not a quantity, so it gets no thousands separator
    [stat.min, stat.median, stat.max].forEach((value) => {
      row.insertCell().textContent = stat.label === 'Yıl' ? String(value) : formatNumber(value);
    });
  });
  container.appendChild(table);
  if (mixedCurrency) {
    container.appendChild(el('p', {
      class: 'message',
      text: `Birden fazla para birimi var. Fiyatlar yalnızca ${currency} ilanlardan hesaplandı.`
    }));
  }
}

function ratesTimeText(result) {
  const { rates, status } = result;
  const time = rates.fetchedAt
    ? new Date(rates.fetchedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : '';
  if (status === 'stale') return `Güncellenemedi, son veri ${time}`;
  return time ? `Kur: ${rates.source}, ${time}` : `Kur: ${rates.source}`;
}

/** The price in dollars, euros, pounds and grams of gold, or nothing without a rate */
function renderRatesStrip(container, price, result, onRefresh) {
  container.textContent = '';
  if (!result || !result.rates) {
    if (result && result.status === 'error') {
      container.appendChild(el('p', { class: 'message', text: 'Kurlar alınamadı. İnternet bağlantını kontrol edip tekrar dene.' }));
    }
    return;
  }
  const converted = convertPrice(price, result.rates);
  if (!converted) return;
  const cells = RATE_UNITS
    .filter(({ code }) => converted[code] !== undefined)
    .map(({ code, label, suffix }) => el('div', { class: 'rates-cell' }, [
      el('span', { class: 'rates-cell-label', text: label }),
      el('span', { class: 'rates-cell-value', text: `${formatNumber(converted[code], code === 'GRA' ? 1 : 0)} ${suffix}` })
    ]));
  const foot = el('div', { class: 'rates-foot' }, [
    el('span', { text: ratesTimeText(result) }),
    onRefresh ? el('button', { class: 'btn-link', type: 'button', text: 'Yenile', onclick: onRefresh }) : null
  ]);
  container.appendChild(el('div', { class: 'rates' }, [el('div', { class: 'rates-cells' }, cells), foot]));
}

/** The median of a results page, as a price object the strip can convert */
function pageMedianPrice(records) {
  const { stats } = computeStats(records);
  const stat = stats.find((item) => item.label === 'Fiyat');
  return stat ? { amount: stat.median, currency: stat.unit, raw: '' } : null;
}

const BRAND_MARK = '<svg class="brand-mark" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="7" fill="var(--accent)"/><path d="M13.6 6H8a2 2 0 0 0-2 2v5.6a2 2 0 0 0 .59 1.41l5.4 5.4a2 2 0 0 0 2.82 0l5.6-5.6a2 2 0 0 0 0-2.82l-5.4-5.4A2 2 0 0 0 13.6 6" fill="var(--on-accent)"/><circle cx="10.2" cy="10.2" r="1.5" fill="var(--accent)"/></svg>';

function hydrateBrand(root) {
  (root || document).querySelectorAll('[data-brand-mark]').forEach((holder) => {
    holder.insertAdjacentHTML('afterbegin', BRAND_MARK);
    holder.removeAttribute('data-brand-mark');
  });
}
