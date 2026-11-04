// dashboard.js - The workspace. It works from locally saved data and sends nothing to the listing site.

const PAGE_SIZE = 100;
const VIEWS = [
  { id: 'basket', label: 'Sepet', icon: 'basket' },
  { id: 'vehicles', label: 'Araç', icon: 'car' },
  { id: 'emlak', label: 'Emlak', icon: 'home' },
  { id: 'analysis', label: 'Analiz', icon: 'chart', needs: ['charts', 'dealScore'] },
  { id: 'searches', label: 'Kayıtlı aramalar', icon: 'bookmark', needs: ['snapshots'] },
  { id: 'data', label: 'Veri ve yedek', icon: 'database' },
  { id: 'settings', label: 'Ayarlar', icon: 'sliders' }
];

const state = {
  features: normalizeFeatures({}),
  records: [],
  annotations: {},
  hiddenColumns: [],
  scoreWeights: { ...DEFAULT_SCORE_WEIGHTS },
  rates: null,
  ratesResult: null,
  filters: { search: '', tag: '', minPrice: null, maxPrice: null, sortBy: 'lastSeen', descending: true },
  selected: new Set(),
  expanded: new Set(),
  shown: PAGE_SIZE,
  scatterField: '',
  statusText: '',
  vehicleTerms: [],
  vehicleFilters: { series: '', damage: '', sortBy: 'page', descending: false },
  emlakFilters: { subtype: '', sortBy: 'page', descending: false }
};

async function loadState() {
  const stored = await chrome.storage.local.get(['basket', 'annotations', 'hiddenColumns', 'scoreWeights', 'vehicleTerms']);
  state.features = await loadFeatures();
  state.records = Object.values(stored.basket || {});
  state.annotations = stored.annotations || {};
  state.hiddenColumns = stored.hiddenColumns || [];
  state.vehicleTerms = stored.vehicleTerms || [];
  state.scoreWeights = { ...DEFAULT_SCORE_WEIGHTS, ...(stored.scoreWeights || {}) };
  state.ratesResult = await loadRates(state.features, false).catch(() => ({ status: 'error', rates: null }));
  state.rates = state.ratesResult.rates;
}

const context = () => ({
  features: state.features,
  rates: state.rates,
  annotations: state.annotations,
  scoreWeights: state.scoreWeights,
  vehicleTerms: state.vehicleTerms,
  now: Date.now(),
  includeRemoteHistory: state.features.bulkPriceHistory
});

function currentView() {
  const id = location.hash.slice(1);
  return VIEWS.some((view) => view.id === id) ? id : 'basket';
}

function scoreFunction() {
  const derived = basketContext(state.records, Date.now());
  return (record) => dealScore(record, derived, state.scoreWeights);
}

function visibleRecords() {
  const on = state.features;
  const filters = on.basketFilters
    ? { ...state.filters, scoreOf: on.dealScore ? scoreFunction() : null }
    : { sortBy: 'lastSeen', descending: true };
  return filterAndSortRecords(state.records, filters, state.annotations);
}

function setStatus(text) {
  state.statusText = text;
  const line = $('statusLine');
  if (line) line.textContent = text;
}

function titleRow(title, subtitle, actions) {
  return el('div', { class: 'title-row' }, [
    el('div', {}, [el('h1', { text: title }), subtitle ? el('p', { class: 'muted', text: subtitle }) : null]),
    actions || null
  ]);
}

/** A view whose feature is off offers its switch right there, and the view appears the moment it is on */
function offCard(featureIds) {
  const card = el('section', { class: 'panel off-card' });
  card.appendChild(el('h2', { text: 'Bu bölüm kapalı' }));
  featureIds.forEach((id) => {
    const feature = getFeature(id);
    const input = el('input', { type: 'checkbox', 'aria-label': feature.title });
    input.addEventListener('change', () => setFeature(feature, input.checked));
    card.appendChild(el('div', { class: 'feature-main', style: 'padding: 8px 0' }, [
      el('div', {}, [
        el('div', { class: 'feature-title' }, [
          el('span', { text: feature.title }),
          el('span', { class: `pill pill-${feature.risk}`, text: RISK_LABELS[feature.risk] })
        ]),
        el('p', { class: 'feature-desc', text: feature.desc })
      ]),
      el('label', { class: 'switch' }, [input, el('span')])
    ]));
  });
  return card;
}

/**
 * ============================================================================
 * NAVIGATION
 * ============================================================================
 */
function renderNav() {
  const nav = $('nav');
  nav.textContent = '';
  const current = currentView();
  VIEWS.forEach((view) => {
    const off = view.needs && !view.needs.some((id) => state.features[id]);
    const onCount = view.id === 'settings' ? FEATURES.filter((feature) => state.features[feature.id]).length : 0;
    const link = el('a', { href: `#${view.id}`, icon: view.icon, 'aria-current': view.id === current ? 'page' : null }, [
      el('span', { text: view.label })
    ]);
    if (view.id === 'basket' && state.records.length > 0) link.appendChild(el('span', { class: 'nav-state num', text: formatNumber(state.records.length) }));
    if (off) link.appendChild(el('span', { class: 'nav-state', text: 'Kapalı' }));
    if (onCount > 0) link.appendChild(el('span', { class: 'nav-state num', text: `${onCount} açık` }));
    nav.appendChild(link);
  });
}

/**
 * ============================================================================
 * BASKET VIEW
 * ============================================================================
 */
function exportButtons() {
  const on = state.features;
  const empty = state.records.length === 0;
  const holder = el('div', { class: 'btn-row' });
  const button = (label, icon, onclick, primary) => el('button', {
    class: primary ? 'btn btn-primary' : 'btn', type: 'button', icon, text: label, disabled: empty, onclick
  });
  if (on.tsvCopy) {
    holder.appendChild(button('Tablo olarak kopyala', 'copy', async () => {
      await navigator.clipboard.writeText(toTsv(recordsToRows(visibleRecords(), state.hiddenColumns, context())));
      setStatus('Panoya kopyalandı. Google Sheets veya Excel’e yapıştırabilirsin.');
    }));
  }
  if (on.mapExport) {
    const located = recordsToGeoJson(visibleRecords()).features.length;
    holder.appendChild(el('button', {
      class: 'btn', type: 'button', icon: 'map', text: `KML (${located})`, disabled: located === 0,
      title: located === 0 ? 'Konum için ilan sayfasından eklenmiş ilan gerekir' : '',
      onclick: () => downloadTextFile(recordsToKml(visibleRecords()), `sahibinden_harita_${todayIso()}.kml`, 'application/vnd.google-earth.kml+xml')
    }));
    holder.appendChild(el('button', {
      class: 'btn', type: 'button', icon: 'map', text: `GeoJSON (${located})`, disabled: located === 0,
      onclick: () => downloadJson(recordsToGeoJson(visibleRecords()), `sahibinden_harita_${todayIso()}.geojson`)
    }));
  }
  holder.appendChild(button('JSON', 'braces', () => downloadJson(visibleRecords(), `sahibinden_sepet_${todayIso()}.json`)));
  holder.appendChild(button('CSV indir', 'download', () => {
    downloadCsv(recordsToRows(visibleRecords(), state.hiddenColumns, context()), `sahibinden_sepet_${todayIso()}.csv`);
    setStatus(`${visibleRecords().length} ilan indirildi.`);
  }, true));
  return holder;
}

function renderKpis() {
  const { stats, mixedCurrency, currency } = computeStats(state.records);
  const stat = (label) => stats.find((item) => item.label === label);
  const price = stat('Fiyat');
  const unit = stat('Fiyat/m²');
  const detailed = state.records.filter((record) => record.hasDetail).length;
  const kpi = (label, value, sub) => el('div', { class: 'kpi' }, [
    el('div', { class: 'kpi-label', text: label }),
    el('div', { class: 'kpi-value', text: value }),
    sub ? el('div', { class: 'kpi-sub', text: sub }) : null
  ]);
  return el('section', { class: 'kpis' }, [
    kpi('Medyan fiyat', price ? `${formatNumber(price.median)} ${currency}` : '-', mixedCurrency ? `Yalnızca ${currency} ilanlardan` : `${state.records.length} ilan üzerinden`),
    kpi('En düşük fiyat', price ? formatNumber(price.min) : '-', price ? currency : ''),
    kpi('Medyan fiyat/m²', unit ? formatNumber(unit.median) : '-', unit ? currency : 'm² bilgisi olan ilan yok'),
    kpi('Tüm detayı olan', `${formatNumber(detailed)} / ${formatNumber(state.records.length)}`, 'ilan sayfasından eklenenler')
  ]);
}

function renderRatesBlock() {
  const holder = el('div');
  if (!state.rates) return holder;
  const { stats } = computeStats(state.records);
  const stat = stats.find((item) => item.label === 'Fiyat');
  if (!stat) return holder;
  renderRatesStrip(holder, { amount: stat.median, currency: stat.unit }, state.ratesResult, async () => {
    state.ratesResult = await loadRates(state.features, true);
    state.rates = state.ratesResult.rates;
    renderView();
  });
  const foot = holder.querySelector('.rates-foot span');
  if (foot) foot.prepend('Medyan fiyat. ');
  return holder;
}

function filtersBar(onChange) {
  const holder = el('div', { class: 'filters' });
  const on = state.features;
  if (!on.basketFilters) return holder;

  const search = el('input', { type: 'search', placeholder: 'Başlık, no, konum, özellik', 'aria-label': 'Sepette ara' });
  search.value = state.filters.search;
  search.addEventListener('input', () => {
    state.filters.search = search.value;
    state.shown = PAGE_SIZE;
    onChange();
  });
  holder.appendChild(search);

  const numberFilter = (key, label) => {
    const input = el('input', { type: 'number', min: '0', class: 'num', placeholder: label, 'aria-label': label });
    input.value = state.filters[key] === null ? '' : state.filters[key];
    input.addEventListener('change', () => {
      state.filters[key] = input.value === '' ? null : Number(input.value);
      state.shown = PAGE_SIZE;
      onChange();
    });
    return input;
  };
  holder.append(numberFilter('minPrice', 'En az fiyat'), numberFilter('maxPrice', 'En çok fiyat'));

  const sortOptions = [['lastSeen', 'Son eklenen'], ['price', 'Fiyat'], ['unitPrice', 'Fiyat/m²'], ['date', 'İlan tarihi'], ['title', 'Başlık']];
  if (on.notesTags) sortOptions.push(['rating', 'Puanım']);
  if (on.dealScore) sortOptions.push(['score', 'Fırsat puanı']);
  const sort = el('select', { 'aria-label': 'Sırala' }, sortOptions.map(([value, label]) => el('option', { value, text: label })));
  sort.value = state.filters.sortBy;
  sort.addEventListener('change', () => {
    state.filters.sortBy = sort.value;
    onChange();
  });
  const direction = el('select', { 'aria-label': 'Sıralama yönü' }, [
    el('option', { value: 'desc', text: 'Azalan' }),
    el('option', { value: 'asc', text: 'Artan' })
  ]);
  direction.value = state.filters.descending ? 'desc' : 'asc';
  direction.addEventListener('change', () => {
    state.filters.descending = direction.value === 'desc';
    onChange();
  });
  holder.append(sort, direction);

  if (on.notesTags) {
    const tags = [...new Set(Object.values(state.annotations).flatMap((note) => note.tags || []))].sort((a, b) => a.localeCompare(b, 'tr'));
    if (tags.length > 0) {
      const tag = el('select', { 'aria-label': 'Etikete göre filtrele' }, [
        el('option', { value: '', text: 'Tüm etiketler' }),
        ...tags.map((name) => el('option', { value: name, text: name }))
      ]);
      tag.value = state.filters.tag;
      tag.addEventListener('change', () => {
        state.filters.tag = tag.value;
        onChange();
      });
      holder.appendChild(tag);
    }
  }
  return holder;
}

function selectionActions() {
  const holder = el('div', { id: 'selectionActions', class: 'btn-row' });
  const count = state.selected.size;
  const chosen = () => state.records.filter((record) => state.selected.has(record.id));
  holder.appendChild(el('button', {
    class: 'btn', type: 'button', icon: 'download', text: `Seçilenleri CSV${count ? ` (${count})` : ''}`, disabled: count === 0,
    onclick: () => downloadCsv(recordsToRows(chosen(), state.hiddenColumns, context()), `sahibinden_secilen_${todayIso()}.csv`)
  }));
  holder.appendChild(el('button', {
    class: 'btn', type: 'button', icon: 'compare', text: `Karşılaştır${count ? ` (${count})` : ''}`, disabled: count < 2,
    title: count < 2 ? 'En az 2 ilan seç' : '',
    onclick: () => chrome.tabs.create({ url: `compare.html#${[...state.selected].join(',')}` })
  }));
  holder.appendChild(el('button', {
    class: 'btn', type: 'button', icon: 'trash', text: 'Sil', disabled: count === 0, title: 'Seçilen ilanları sepetten siler',
    onclick: async () => {
      await chrome.runtime.sendMessage({ action: 'basket-remove', data: { ids: [...state.selected] } });
      state.selected.clear();
    }
  }));
  return holder;
}

/** Selects every listing the filters leave, also those past the "show more" button */
function selectAllBox(records, table) {
  const box = el('input', { type: 'checkbox', id: 'selectAll', 'aria-label': `Tümünü seç (${records.length} ilan)`, title: `Tümünü seç (${records.length} ilan)` });
  const chosen = records.filter((record) => state.selected.has(record.id)).length;
  box.checked = records.length > 0 && chosen === records.length;
  box.indeterminate = chosen > 0 && chosen < records.length;
  box.addEventListener('change', () => {
    records.forEach((record) => {
      if (box.checked) state.selected.add(record.id);
      else state.selected.delete(record.id);
    });
    renderListingRows(table);
  });
  return box;
}

function refreshSelectAll() {
  const box = $('selectAll');
  if (!box) return;
  const records = visibleRecords();
  const chosen = records.filter((record) => state.selected.has(record.id)).length;
  box.checked = records.length > 0 && chosen === records.length;
  box.indeterminate = chosen > 0 && chosen < records.length;
}

function refreshSelectionActions() {
  const old = $('selectionActions');
  if (old) old.replaceWith(selectionActions());
}

function renderDetailContent(record, columnCount) {
  const on = state.features;
  const left = el('div', { class: 'detail-fields' });
  const right = el('div', { class: 'detail-fields' });

  const facts = listingInsights(record, on, { ...basketContext(state.records, Date.now()), now: Date.now() });
  if (facts.length > 0) left.appendChild(renderFacts(facts));
  const fields = Object.entries(record.fields || {}).slice(0, 12).map(([key, value]) => [key, value]);
  if (facts.length === 0 && fields.length > 0) left.appendChild(renderFacts(fields));

  if (on.tkgm) {
    const parcel = parcelFromFields(record.fields);
    const place = { il: (record.fields || {})['İl'], ilce: (record.fields || {})['İlçe'], mahalle: (record.fields || {})['Mahalle'] };
    const ready = parcel && place.il && place.ilce && place.mahalle;
    left.appendChild(el('div', {}, el('button', {
      class: 'btn', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç', disabled: !ready,
      title: ready ? `Ada ${parcel.ada}, Parsel ${parcel.parsel}` : 'Bu ilanda il, ilçe, mahalle, ada ve parsel birlikte yok',
      onclick: () => openTkgmParcel(place, parcel, setStatus)
    })));
  }

  if (on.notesTags) {
    right.appendChild(renderNoteEditor(record.id, (annotations) => { state.annotations = annotations; }));
  }
  const phones = renderPhones(record);
  if (phones) right.appendChild(phones);
  const report = renderVehicleReport(record, state.vehicleTerms);
  if (report) right.prepend(report);

  return el('tr', { class: 'detail-row' }, el('td', { colspan: String(columnCount) }, el('div', { class: 'detail-grid' }, [left, right])));
}

function renderListingRows(table) {
  const on = state.features;
  const records = visibleRecords();
  const scoreOf = on.dealScore ? scoreFunction() : null;
  const head = table.querySelector('thead');
  const body = table.querySelector('tbody');
  head.textContent = '';
  body.textContent = '';

  const headRow = el('tr', {}, [
    el('th', {}, selectAllBox(records, table)),
    el('th', { 'aria-label': 'Görsel' }),
    el('th', { text: 'İlan' }),
    el('th', { class: 'right', text: 'Fiyat' }),
    el('th', { class: 'right', text: 'Fiyat/m²' }),
    el('th', { class: 'right', text: 'İlan tarihi' }),
    on.dealScore ? el('th', { class: 'right', text: 'Fırsat', title: 'Sepetteki verilerle hesaplanır, tavsiye değildir' }) : null,
    el('th', { 'aria-label': 'Detay' })
  ]);
  head.appendChild(headRow);

  records.slice(0, state.shown).forEach((record) => {
    const unit = unitPrice(record);
    const change = (record.priceHistory || []).slice(-1)[0];
    const converted = state.rates ? convertPrice(record.price, state.rates) : null;
    const check = el('input', { type: 'checkbox', 'aria-label': `${record.title} seç` });
    check.checked = state.selected.has(record.id);
    check.addEventListener('change', () => {
      if (check.checked) state.selected.add(record.id);
      else state.selected.delete(record.id);
      refreshSelectionActions();
      refreshSelectAll();
    });
    const isOpen = state.expanded.has(record.id);
    const score = scoreOf ? scoreOf(record) : null;

    body.appendChild(el('tr', { class: 'listing-row' }, [
      el('td', {}, check),
      el('td', {}, record.image ? el('img', { class: 'thumb', src: record.image, alt: '', loading: 'lazy' }) : el('div', { class: 'thumb' })),
      el('td', { class: 'cell-title' }, [
        el('a', { href: record.url, target: '_blank', rel: 'noopener', text: record.title }),
        el('span', { class: 'cell-sub', text: `#${record.id}${record.location ? ` · ${record.location}` : ''}` })
      ]),
      el('td', { class: 'right' }, [
        el('span', { class: 'cell-price', text: formatPrice(record.price) }),
        change ? el('span', { class: 'cell-sub', text: `önceki ${formatNumber(change.amount)} ${change.currency}` }) : null,
        converted ? el('span', { class: 'cell-sub', text: `${formatNumber(converted.USD)} $ · ${formatNumber(converted.GRA, 1)} gr` }) : null
      ]),
      el('td', { class: 'right', text: unit ? formatNumber(unit) : '-' }),
      el('td', { class: 'right', text: record.dateIso || '-' }),
      on.dealScore ? el('td', { class: 'right' }, el('span', { class: 'pill pill-accent num', text: score === null ? '-' : String(score) })) : null,
      el('td', { class: 'right' }, el('button', {
        class: 'expand', type: 'button', icon: 'chevron', 'aria-label': 'Detayı aç veya kapat', 'aria-expanded': String(isOpen),
        onclick: () => {
          if (isOpen) state.expanded.delete(record.id);
          else state.expanded.add(record.id);
          renderListingRows(table);
        }
      }))
    ]));
    if (isOpen) body.appendChild(renderDetailContent(record, headRow.children.length));
  });

  const emptyText = $('emptyTable');
  emptyText.hidden = records.length > 0;
  emptyText.textContent = state.records.length === 0
    ? 'Sepet boş. Eklentiyi bir sahibinden sayfasında açıp Sepete ekle düğmesini kullan.'
    : 'Bu filtrelere uyan ilan yok.';

  const more = $('moreHolder');
  more.textContent = '';
  if (records.length > state.shown) {
    more.appendChild(el('button', {
      class: 'btn', type: 'button', text: `Daha fazla göster (${formatNumber(records.length - state.shown)} ilan kaldı)`,
      onclick: () => {
        state.shown += PAGE_SIZE;
        renderListingRows(table);
      }
    }));
  }
  refreshSelectionActions();
}

function viewBasket(view) {
  view.appendChild(titleRow('Sepet', state.records.length === 0 ? 'Henüz ilan yok' : `${formatNumber(state.records.length)} ilan`, exportButtons()));
  view.appendChild(el('p', { id: 'statusLine', class: 'status-line', role: 'status', text: state.statusText }));
  if (state.records.length > 0) {
    view.appendChild(renderKpis());
    view.appendChild(renderRatesBlock());
  }
  const table = el('table', { class: 'listings' }, [el('thead'), el('tbody')]);
  view.appendChild(el('section', {}, [
    el('div', { class: 'toolbar', style: 'margin-bottom: 14px' }, [filtersBar(() => renderListingRows(table)), selectionActions()]),
    el('div', { class: 'table-wrap' }, table),
    el('p', { id: 'emptyTable', class: 'empty-text', hidden: true }),
    el('div', { id: 'moreHolder', style: 'margin-top: 12px' })
  ]));
  renderListingRows(table);
}

/**
 * ============================================================================
 * ANALYSIS VIEW
 * ============================================================================
 * One hue, thin marks, one y-axis. Hover shows exact values, and the basket table is the text view.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function niceTicks(min, max, count) {
  if (max <= min) return [min];
  const rawStep = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((value) => value >= rawStep) || rawStep;
  const ticks = [];
  for (let tick = Math.floor(min / step) * step; tick <= max + step * 0.999; tick += step) ticks.push(Math.round(tick * 1e6) / 1e6);
  return ticks;
}

function shortNumber(value) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${formatNumber(value / 1e9, 1)} Mr`;
  if (abs >= 1e6) return `${formatNumber(value / 1e6, 1)} Mn`;
  if (abs >= 1e3) return `${formatNumber(value / 1e3, 0)} B`;
  return formatNumber(value, 1);
}

function chartFrame(width, height, margin) {
  const svg = svgEl('svg', { class: 'chart-svg', viewBox: `0 0 ${width} ${height}`, role: 'img' });
  const holder = el('div', { class: 'chart-holder' }, svg);
  const tip = el('div', { class: 'chart-tip', hidden: true });
  holder.appendChild(tip);
  const showTip = (event, text) => {
    const box = holder.getBoundingClientRect();
    tip.textContent = text;
    tip.hidden = false;
    const x = event.clientX - box.left;
    tip.style.left = `${Math.max(0, Math.min(x + 10, box.width - tip.offsetWidth - 2))}px`;
    tip.style.top = `${Math.max(0, event.clientY - box.top - 34)}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  return {
    svg, holder, showTip, hideTip,
    plot: { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom }
  };
}

function drawYAxis(frame, ticks, y) {
  ticks.forEach((tick) => {
    const position = y(tick);
    frame.svg.appendChild(svgEl('line', { class: tick === 0 ? 'chart-base' : 'chart-grid', x1: frame.plot.left, x2: frame.plot.right, y1: position, y2: position }));
    frame.svg.appendChild(svgEl('text', { x: frame.plot.left - 8, y: position + 4, 'text-anchor': 'end' }, shortNumber(tick)));
  });
}

function renderHistogram(records, unit) {
  const prices = records.filter((record) => record.price && record.price.currency === unit).map((record) => record.price.amount).filter(Number.isFinite);
  const bins = histogramBins(prices, Math.min(12, Math.max(4, Math.ceil(Math.sqrt(prices.length)))));
  const frame = chartFrame(560, 240, { left: 44, right: 12, top: 12, bottom: 28 });
  const { plot } = frame;
  const maxCount = Math.max(...bins.map((bin) => bin.count));
  const ticks = niceTicks(0, maxCount, 4).filter((tick) => Number.isInteger(tick));
  const top = ticks[ticks.length - 1] || 1;
  const y = (value) => plot.bottom - (value / top) * (plot.bottom - plot.top);
  drawYAxis(frame, ticks, y);

  const slot = (plot.right - plot.left) / bins.length;
  bins.forEach((bin, index) => {
    const x = plot.left + slot * index;
    if (bin.count > 0) {
      const barTop = y(bin.count);
      const radius = Math.min(4, plot.bottom - barTop);
      const right = x + slot - 2;
      frame.svg.appendChild(svgEl('path', {
        class: 'chart-mark',
        d: `M${x} ${plot.bottom}V${barTop + radius}Q${x} ${barTop} ${x + radius} ${barTop}H${right - radius}Q${right} ${barTop} ${right} ${barTop + radius}V${plot.bottom}Z`
      }));
    }
    const hit = svgEl('rect', { class: 'chart-hit', x, y: plot.top, width: slot, height: plot.bottom - plot.top });
    hit.addEventListener('mousemove', (event) => {
      frame.showTip(event, `${shortNumber(bin.from)} - ${shortNumber(bin.to)} ${unit}: ${bin.count} ilan`);
    });
    hit.addEventListener('mouseleave', frame.hideTip);
    frame.svg.appendChild(hit);
  });

  const every = Math.ceil(bins.length / 5);
  bins.forEach((bin, index) => {
    if (index % every === 0) {
      frame.svg.appendChild(svgEl('text', { x: plot.left + slot * index, y: plot.bottom + 18, 'text-anchor': index === 0 ? 'start' : 'middle' }, shortNumber(bin.from)));
    }
  });
  frame.svg.setAttribute('aria-label', `${prices.length} ilanın fiyat dağılımı`);
  return { node: frame.holder, count: prices.length };
}

function renderScatter(records, unit, field) {
  const points = records
    .map((record) => ({ record, x: toNumber((record.fields || {})[field]), y: record.price && record.price.currency === unit ? record.price.amount : null }))
    .filter((point) => point.x !== null && point.y !== null);
  const frame = chartFrame(560, 240, { left: 44, right: 16, top: 12, bottom: 28 });
  const { plot } = frame;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const yTicks = niceTicks(0, Math.max(...ys), 4);
  const xTicks = niceTicks(Math.min(...xs), Math.max(...xs), 5);
  const yTop = yTicks[yTicks.length - 1];
  const xMin = xTicks[0];
  const xMax = xTicks[xTicks.length - 1] === xMin ? xMin + 1 : xTicks[xTicks.length - 1];
  const y = (value) => plot.bottom - (value / yTop) * (plot.bottom - plot.top);
  const x = (value) => plot.left + ((value - xMin) / (xMax - xMin)) * (plot.right - plot.left);
  const isYear = field === 'Yıl';
  drawYAxis(frame, yTicks, y);
  xTicks.forEach((tick, index) => {
    frame.svg.appendChild(svgEl('text', { x: x(tick), y: plot.bottom + 18, 'text-anchor': index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle' }, isYear ? String(tick) : shortNumber(tick)));
  });
  points.forEach((point) => {
    frame.svg.appendChild(svgEl('circle', { class: 'chart-mark', cx: x(point.x), cy: y(point.y), r: 5, stroke: 'var(--surface)', 'stroke-width': 2, 'fill-opacity': 0.9 }));
  });
  points.forEach((point) => {
    const hit = svgEl('circle', { class: 'chart-hit', cx: x(point.x), cy: y(point.y), r: 11 });
    hit.addEventListener('mousemove', (event) => {
      frame.showTip(event, `${point.record.title.slice(0, 40)}: ${field} ${isYear ? point.x : formatNumber(point.x)}, ${formatNumber(point.y)} ${unit}`);
    });
    hit.addEventListener('mouseleave', frame.hideTip);
    frame.svg.appendChild(hit);
  });
  frame.svg.setAttribute('aria-label', `${points.length} ilan için fiyat ve ${field} ilişkisi`);
  return { node: frame.holder, count: points.length };
}

function chartsBlock(host) {
  const records = visibleRecords();
  const { currency } = computeStats(records);
  host.textContent = '';
  if (records.length < 2 || !currency) {
    host.appendChild(el('section', { class: 'panel' }, el('p', { class: 'empty-text', text: 'Grafik için sepette fiyatı olan en az 2 ilan gerekir.' })));
    return;
  }
  const candidates = ['KM', 'm² (Brüt)', 'm²', 'Yıl', 'm² (Net)'].filter((field) => records.filter((record) => toNumber((record.fields || {})[field]) !== null).length >= 2);
  if (!candidates.includes(state.scatterField)) state.scatterField = candidates[0] || '';

  const histogram = renderHistogram(records, currency);
  const parts = [el('section', { class: 'panel' }, [
    el('div', { class: 'chart-head' }, el('h2', { text: `Fiyat dağılımı (${currency})` })),
    histogram.node,
    el('p', { class: 'small muted', text: `${histogram.count} ilan. Yatay eksen fiyat, dikey eksen ilan sayısı.` })
  ])];
  if (state.scatterField) {
    const select = el('select', { 'aria-label': 'Yatay eksen' }, candidates.map((field) => el('option', { value: field, text: field })));
    select.value = state.scatterField;
    select.addEventListener('change', () => {
      state.scatterField = select.value;
      chartsBlock(host);
    });
    const scatter = renderScatter(records, currency, state.scatterField);
    parts.push(el('section', { class: 'panel' }, [
      el('div', { class: 'chart-head' }, [el('h2', { text: `Fiyat ve ${state.scatterField}` }), select]),
      scatter.node,
      el('p', { class: 'small muted', text: `${scatter.count} ilan. Dikey eksen fiyat (${currency}).` })
    ]));
  }
  host.appendChild(el('div', { class: 'charts' }, parts));
}

function viewAnalysis(view) {
  view.appendChild(titleRow('Analiz', 'Sepetteki ilanlar'));
  const on = state.features;
  if (!on.charts && !on.dealScore) {
    view.appendChild(offCard(['charts', 'dealScore']));
    return;
  }
  if (on.charts) {
    const host = el('div');
    view.appendChild(host);
    chartsBlock(host);
  } else {
    view.appendChild(offCard(['charts']));
  }
  if (on.dealScore) {
    const labels = { price: 'Fiyat', freshness: 'Yenilik', photos: 'Fotoğraf', damage: 'Hasar' };
    view.appendChild(el('section', { class: 'panel' }, [
      el('h2', { text: 'Fırsat puanı ağırlıkları' }),
      el('p', { class: 'panel-note', text: 'Puan, ilanı yalnızca sepetteki diğer ilanlarla karşılaştırır. Tavsiye değildir. Bir ilanda olmayan veri hesaba katılmaz. Puanı Sepet tablosunda görürsün.' }),
      el('div', { class: 'weights' }, Object.entries(labels).map(([key, label]) => {
        const input = el('input', { type: 'number', min: '0', max: '100', class: 'num' });
        input.value = state.scoreWeights[key];
        input.addEventListener('change', async () => {
          state.scoreWeights[key] = Math.max(0, Number(input.value) || 0);
          await chrome.storage.local.set({ scoreWeights: state.scoreWeights });
        });
        return el('label', { class: 'field' }, [el('span', { text: label }), input]);
      }))
    ]));
  } else {
    view.appendChild(offCard(['dealScore']));
  }
}

/**
 * ============================================================================
 * DUPLICATES AND SAVED SEARCHES
 * ============================================================================
 */
const vehicleRows = () => filterVehicles(state.records, state.vehicleFilters);

function photoCell(record) {
  return el('td', {}, record.image ? el('img', { class: 'thumb', src: record.image, alt: '', loading: 'lazy' }) : el('div', { class: 'thumb' }));
}

function expandCell(isOpen, toggle) {
  return el('td', { class: 'right' }, el('button', {
    class: 'expand', type: 'button', icon: 'chevron', 'aria-label': 'Detayı aç veya kapat', 'aria-expanded': String(isOpen), onclick: toggle
  }));
}

function renderVehicleRows(table) {
  const rows = vehicleRows();
  const head = table.querySelector('thead');
  const body = table.querySelector('tbody');
  const headers = ['Fotoğraf', 'Seri', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Renk', 'Fiyat', 'İlan Tarihi', 'İl / İlçe', 'Ortalama Yıllık KM', 'Hasar', ''];
  const rightAligned = ['Yıl', 'KM', 'Fiyat', 'Ortalama Yıllık KM'];
  head.replaceChildren(el('tr', {}, headers.map((text) => el('th', { class: text === 'Ortalama Yıllık KM' ? 'right th-wrap' : rightAligned.includes(text) ? 'right' : null, text }))));
  body.textContent = '';
  rows.forEach((record) => {
    const fields = record.fields || {};
    const facts = vehicleFacts(record, Date.now());
    const yearly = facts.find(([name]) => name === 'Ortalama Yıllık KM');
    const isOpen = state.expanded.has(record.id);
    body.appendChild(el('tr', { class: 'listing-row' }, [
      photoCell(record),
      el('td', { text: fields.Seri || (record.category || [])[3] || '-' }),
      el('td', { text: fields.Model || '-' }),
      el('td', { class: 'cell-title' }, el('a', { href: record.url, target: '_blank', rel: 'noopener', text: record.title })),
      el('td', { class: 'right', text: fields['Yıl'] || '-' }),
      el('td', { class: 'right', text: toNumber(fields.KM) === null ? '-' : formatNumber(toNumber(fields.KM)) }),
      el('td', { text: fields.Renk || '-' }),
      el('td', { class: 'right cell-price', text: formatPrice(record.price) }),
      el('td', { class: 'nowrap', text: record.dateRaw || '-' }),
      el('td', { text: recordPlace(record) || '-' }),
      el('td', { class: 'right', text: yearly ? yearly[1] : '-' }),
      el('td', {}, renderDamageChips(record)),
      expandCell(isOpen, () => {
        if (isOpen) state.expanded.delete(record.id);
        else state.expanded.add(record.id);
        renderVehicleRows(table);
      })
    ]));
    if (isOpen) {
      const report = renderVehicleReport(record, state.vehicleTerms);
      body.appendChild(el('tr', { class: 'detail-row' }, el('td', { colspan: String(headers.length) }, el('div', { class: 'detail-grid' }, [
        el('div', { class: 'detail-fields' }, [
          renderPhotoBlock(record, setStatus),
          facts.length > 0 ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Kesin bilgiler' }), renderFacts(facts)]) : null,
          renderPhones(record),
          renderDescription(record, state.expanded)
        ].filter(Boolean)),
        el('div', { class: 'detail-fields' }, [
          report || el('p', { class: 'small muted', text: 'Hasar bilgisi için ilanı açıp sepete ekle.' }),
          renderTechnical(record)
        ].filter(Boolean))
      ]))));
    }
  });
  $('vehicleEmpty').hidden = rows.length > 0;
}

function renderEmlakRows(table) {
  const rows = filterEmlak(state.records, state.emlakFilters);
  const names = [];
  rows.forEach((record) => {
    emlakSpecs(record).forEach(([name]) => {
      if (!names.includes(name) && name !== 'İlan Tarihi' && name !== 'Konum' && names.length < 6) names.push(name);
    });
  });
  const headers = ['Fotoğraf', 'İlan Başlığı', ...names, 'Fiyat', 'Fiyat/m²', 'İlan Tarihi', 'Konum', ''];
  table.querySelector('thead').replaceChildren(el('tr', {}, headers.map((text) => el('th', { class: text === 'Fiyat' || text === 'Fiyat/m²' ? 'right' : null, text }))));
  const body = table.querySelector('tbody');
  body.textContent = '';
  rows.forEach((record) => {
    const facts = emlakFacts(record, Date.now());
    const unit = facts.find(([name]) => name === 'Fiyat/m²');
    const isOpen = state.expanded.has(record.id);
    const parcel = parcelFromFields(record.fields);
    const fields = record.fields || {};
    const place = { il: fields['İl'], ilce: fields['İlçe'], mahalle: fields['Mahalle'] };
    body.appendChild(el('tr', { class: 'listing-row' }, [
      photoCell(record),
      el('td', { class: 'cell-title' }, [
        el('a', { href: record.url, target: '_blank', rel: 'noopener', text: record.title }),
        el('span', { class: 'cell-sub', text: emlakSubtype(record).label })
      ]),
      ...names.map((name) => el('td', { text: fields[name] || '-' })),
      el('td', { class: 'right cell-price', text: formatPrice(record.price) }),
      el('td', { class: 'right', text: unit ? unit[1] : '-' }),
      el('td', { class: 'nowrap', text: record.dateRaw || '-' }),
      el('td', { text: recordPlace(record) || '-' }),
      expandCell(isOpen, () => {
        if (isOpen) state.expanded.delete(record.id);
        else state.expanded.add(record.id);
        renderEmlakRows(table);
      })
    ]));
    if (isOpen) {
      body.appendChild(el('tr', { class: 'detail-row' }, el('td', { colspan: String(headers.length) }, el('div', { class: 'detail-grid' }, [
        el('div', { class: 'detail-fields' }, [renderPhotoBlock(record, setStatus)].filter(Boolean)),
        el('div', { class: 'detail-fields' }, [
          facts.length > 0 ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Kesin bilgiler' }), renderFacts(facts)]) : null,
          state.features.tkgm && parcel && place.il && place.ilce && place.mahalle ? el('div', {}, el('button', {
            class: 'btn', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç',
            onclick: () => openTkgmParcel(place, parcel, setStatus)
          })) : null,
          renderPhones(record)
        ].filter(Boolean))
      ]))));
    }
  });
}

function viewEmlak(view) {
  const estate = state.records.filter(isRealEstate);
  view.appendChild(titleRow('Emlak', estate.length === 0 ? 'Sepette emlak ilanı yok' : `Sepette ${formatNumber(estate.length)} emlak ilanı`,
    el('button', {
      class: 'btn btn-primary', type: 'button', icon: 'download', text: 'CSV indir', disabled: estate.length === 0,
      onclick: () => downloadCsv(recordsToRows(filterEmlak(state.records, state.emlakFilters), state.hiddenColumns, context()), `sahibinden_emlak_${todayIso()}.csv`)
    })));
  view.appendChild(el('p', { id: 'statusLine', class: 'status-line', role: 'status', text: state.statusText }));
  if (estate.length === 0) {
    view.appendChild(el('section', { class: 'panel' }, el('p', { class: 'empty-text', text: 'Bir emlak listesini ya da ilanını açıp sepete ekle.' })));
    return;
  }
  const table = el('table', { class: 'listings' }, [el('thead'), el('tbody')]);
  view.appendChild(el('section', {}, [
    el('div', { class: 'filters', style: 'margin-bottom: 14px' }, [
      renderEmlakChips(state.records, state.emlakFilters.subtype, (id) => {
        state.emlakFilters.subtype = id;
        renderView();
      }),
      renderEmlakSort(state.emlakFilters, () => renderEmlakRows(table))
    ]),
    el('div', { class: 'table-wrap' }, table)
  ]));
  renderEmlakRows(table);
}

function viewVehicles(view) {
  const vehicles = state.records.filter(isVehicle);
  view.appendChild(el('p', { id: 'statusLine', class: 'status-line', role: 'status', text: state.statusText }));
  view.appendChild(titleRow('Araç', vehicles.length === 0 ? 'Sepette araç ilanı yok' : `Sepette ${formatNumber(vehicles.length)} araç ilanı`,
    el('button', {
      class: 'btn btn-primary', type: 'button', icon: 'download', text: 'CSV indir', disabled: vehicles.length === 0,
      onclick: () => downloadCsv(recordsToRows(vehicleRows(), state.hiddenColumns, context()), `sahibinden_arac_${todayIso()}.csv`)
    })));
  if (vehicles.length === 0) {
    view.appendChild(el('section', { class: 'panel' }, el('p', { class: 'empty-text', text: 'Bir araç ilanını ya da listesini açıp sepete ekle. Hasar şeması ve teknik veriler için ilan sayfasından eklemek gerekir.' })));
    view.appendChild(renderTermsEditor(state.vehicleTerms, 'panel'));
    return;
  }

  const groups = vehicleGroups(vehicles);
  if (groups.length > 0) {
    const summary = el('table', { class: 'listings' }, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: 'Marka ve seri' }),
        el('th', { class: 'right', text: 'İlan' }),
        el('th', { class: 'right', text: 'En düşük' }),
        el('th', { class: 'right', text: 'Medyan fiyat' }),
        el('th', { class: 'right', text: 'Medyan KM' })
      ])),
      el('tbody', {}, groups.slice(0, 12).map((group) => el('tr', {}, [
        el('td', { text: group.key }),
        el('td', { class: 'right', text: formatNumber(group.count) }),
        el('td', { class: 'right', text: group.minPrice ? `${formatNumber(group.minPrice)} ${group.currency}` : '-' }),
        el('td', { class: 'right cell-price', text: group.medianPrice ? `${formatNumber(group.medianPrice)} ${group.currency}` : '-' }),
        el('td', { class: 'right', text: group.medianKm ? formatNumber(group.medianKm) : '-' })
      ])))
    ]);
    view.appendChild(el('section', { class: 'panel' }, [el('h2', { text: 'Seri özeti' }), el('div', { class: 'table-wrap' }, summary)]));
  }

  const table = el('table', { class: 'listings' }, [el('thead'), el('tbody')]);
  view.appendChild(el('section', {}, [
    el('div', { style: 'margin-bottom: 14px' }, renderVehicleFilters(vehicles, state.vehicleFilters, () => renderVehicleRows(table))),
    el('div', { class: 'table-wrap' }, table),
    el('p', { id: 'vehicleEmpty', class: 'empty-text', hidden: true, text: 'Bu filtrelere uyan araç yok. Hasar filtreleri yalnızca ilan sayfasından eklenen ilanlarda çalışır.' })
  ]));
  renderVehicleRows(table);
  view.appendChild(renderTermsEditor(state.vehicleTerms, 'panel'));
}

async function viewSearches(view) {
  if (!state.features.snapshots) {
    view.appendChild(titleRow('Kayıtlı aramalar', 'Bir aramadaki değişiklikleri izle'));
    view.appendChild(offCard(['snapshots']));
    return;
  }
  const { savedSearches = {} } = await chrome.storage.local.get('savedSearches');
  const entries = Object.entries(savedSearches);
  view.appendChild(titleRow('Kayıtlı aramalar', `${entries.length} arama`));
  if (entries.length === 0) {
    view.appendChild(el('section', { class: 'panel' }, el('p', { class: 'empty-text', text: 'Eklentiyi bir liste sayfasında açıp Aramayı kaydet düğmesini kullan.' })));
    return;
  }
  const list = el('div', { class: 'list-rows' });
  entries.forEach(([key, search]) => {
    const diff = search.lastDiff;
    list.appendChild(el('div', {}, [
      el('span', {}, [
        el('a', { href: search.url, target: '_blank', rel: 'noopener', text: (search.category || []).join(' › ') || search.url }),
        el('span', { class: 'cell-sub', text: `${Object.keys(search.listings).length} ilan, ${new Date(search.savedAt).toLocaleString('tr-TR')}${diff ? ` · ${diff.added.length} yeni, ${diff.missing.length} görünmeyen, ${diff.priceChanged.length} fiyatı değişen` : ''}` })
      ]),
      el('button', {
        class: 'btn', type: 'button', icon: 'trash', text: 'Sil',
        onclick: async () => {
          const { savedSearches: latest = {} } = await chrome.storage.local.get('savedSearches');
          delete latest[key];
          await chrome.storage.local.set({ savedSearches: latest });
          renderView();
        }
      })
    ]));
  });
  view.appendChild(el('section', { class: 'panel' }, [
    el('p', { class: 'panel-note', style: 'margin-top: 0', text: 'Kıyas yalnızca kaydedilen sayfadaki ilanlar içindir. Görünmeyen bir ilan kalkmış olabilir ya da başka sayfaya geçmiş olabilir.' }),
    list
  ]));
}

/**
 * ============================================================================
 * DATA AND BACKUP VIEW
 * ============================================================================
 */
function columnsBlock() {
  return renderColumnPicker(state.records, context(), state.hiddenColumns, state.features, 'panel', (hidden) => { state.hiddenColumns = hidden; });
}

function backupBlock() {
  return state.features.backup ? renderBackupBlock('panel', setStatus) : offCard(['backup']);
}

function viewData(view) {
  view.appendChild(titleRow('Veri ve yedek', 'Dışa aktarılan sütunlar ve yedekler'));
  view.appendChild(el('p', { id: 'statusLine', class: 'status-line', role: 'status', text: state.statusText }));
  view.appendChild(columnsBlock());
  view.appendChild(backupBlock());
  view.appendChild(el('section', { class: 'panel danger-zone' }, [
    el('div', {}, [
      el('h2', { text: 'Sepeti boşalt' }),
      el('p', { class: 'small muted', text: 'Tüm ilanlar bu tarayıcıdan silinir. Notların ve kayıtlı aramaların kalır.' })
    ]),
    el('button', {
      class: 'btn btn-danger', type: 'button', icon: 'trash', text: 'Sepeti boşalt', disabled: state.records.length === 0,
      onclick: async () => {
        if (!confirm(`Sepetteki ${state.records.length} ilan silinsin mi? Bu geri alınamaz.`)) return;
        await chrome.runtime.sendMessage({ action: 'basket-clear' });
        state.selected.clear();
      }
    })
  ]));
}

/**
 * ============================================================================
 * SETTINGS VIEW
 * ============================================================================
 */
function viewSettings(view) {
  const onCount = FEATURES.filter((feature) => state.features[feature.id]).length;
  view.appendChild(titleRow('Ayarlar', `${FEATURES.length} özellikten ${onCount} tanesi açık. Temel indirme ve sepet her zaman çalışır.`,
    el('button', {
      class: 'btn', type: 'button', text: 'Hepsini kapat', disabled: onCount === 0,
      onclick: async () => {
        await resetAllFeatures();
        await chrome.runtime.sendMessage({ action: 'features-changed' });
      }
    })));
  const themeHolder = el('div');
  renderThemePicker(themeHolder);
  view.appendChild(el('div', { class: 'theme-row' }, [el('h2', { text: 'Tema' }), themeHolder]));
  view.appendChild(el('p', { id: 'statusLine', class: 'status-line', role: 'status', text: state.statusText }));
  const list = el('div', { class: 'settings-layout' });
  renderFeatureSettings(list, state.features, setStatus);
  view.appendChild(list);
}

/**
 * ============================================================================
 * PAGE
 * ============================================================================
 */
async function renderView() {
  renderNav();
  const view = $('view');
  const scroll = window.scrollY;
  const fresh = el('div', { id: 'view', class: 'view' });
  const renderers = { basket: viewBasket, analysis: viewAnalysis, vehicles: viewVehicles, emlak: viewEmlak, searches: viewSearches, data: viewData, settings: viewSettings };
  view.replaceWith(fresh);
  await renderers[currentView()](fresh);
  window.scrollTo(0, scroll);
}

let renderTimer = null;
function reloadAndRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(async () => {
    await loadState();
    await renderView();
  }, 30);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.basket || changes.features || changes.sessionFeatures || changes.savedSearches || changes.manualRates || changes.vehicleTerms) reloadAndRender();
});
window.addEventListener('hashchange', () => {
  state.statusText = '';
  window.scrollTo(0, 0);
  renderView();
});

hydrateBrand();
loadState().then(renderView);
