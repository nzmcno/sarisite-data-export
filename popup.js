// popup.js - The extension's main screen, in the side panel and in the small window alike.
// The page is only read (see extractor.js). Files are built here, so nothing is added to the page.

const app = {
  run: 0,
  tab: null,
  url: '',
  page: null,
  loading: false,
  features: normalizeFeatures({}),
  basket: {},
  terms: [],
  ratesResult: { status: 'off', rates: null },
  search: '',
  sort: 'page',
  expanded: new Set(),
  openFolds: new Set(),
  vehicleFilters: { series: '', damage: '', sortBy: 'peer', descending: false },
  vehicleExpanded: new Set()
};

const QUICK_FACTS = ['Yıl', 'KM', 'Yakıt / Motor Tipi', 'Vites', 'Motor Gücü', 'Renk', 'm² (Brüt)', 'm²', 'Oda Sayısı', 'Bina Yaşı', 'Bulunduğu Kat', 'İmar Durumu'];
const isSahibinden = (url) => /^https?:\/\/([a-z0-9-]+\.)?sahibinden\.com\//i.test(url || '');
const inPopup = () => document.documentElement.classList.contains('in-popup');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Reads the open page again right before an export, so the file matches what is on screen */
async function readPage() {
  app.tab = await getActiveTab();
  app.page = await runInTab(app.tab.id, 'extractPage');
  return app.page;
}

function pageProblem(page) {
  if (page.pageType === 'blocked') return 'Site doğrulama sayfası gösteriyor. Eklenti bu sayfada çalışmaz. Doğrulamayı sen tamamla, sonra tekrar aç.';
  if (page.pageType === 'other') return 'Burası liste veya ilan sayfası değil. Bir sahibinden arama sonucu ya da ilan aç.';
  if (page.pageType === 'list' && page.rows.length === 0) {
    return 'Tablo var ama ilan satırı yok. Sonuç boş olabilir ya da sitenin yapısı değişmiş olabilir.';
  }
  return '';
}

const setPageMessage = (text) => { $('pageMessage').textContent = text; };

/**
 * ============================================================================
 * START AND LIVE UPDATES
 * ============================================================================
 */
function selectTab(button) {
  document.querySelectorAll('.tab-button').forEach((other) => {
    other.classList.toggle('active', other === button);
    other.setAttribute('aria-selected', String(other === button));
  });
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
  $(`${button.getAttribute('data-tab')}-tab`).classList.add('active');
  drawActions();
}

document.addEventListener('DOMContentLoaded', async () => {
  hydrateBrand();
  hydrateIcons();
  renderThemePicker($('themePicker'));
  renderSurfacePicker();
  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => selectTab(button));
  });
  $('openPanelBtn').hidden = !inPopup();
  app.features = await loadFeatures();
  renderFeatureList();
  await refresh(true);
  refreshGuarded();
  onFeaturesChanged(applyFeatureChange);
  chrome.tabs.onActivated.addListener(() => refresh(true));
  chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
    if ((change.status === 'complete' || change.status === 'loading') && tab.active) refresh(change.status === 'complete');
  });
});

/** A switch changed here or in the workspace: redraw everything it affects right away */
async function applyFeatureChange() {
  app.features = await loadFeatures();
  renderFeatureList();
  await refresh(false);
  refreshGuarded();
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.imageProgress) {
    const { done, total, errorCount } = changes.imageProgress.newValue;
    const errors = errorCount > 0 ? `, ${errorCount} hata` : '';
    $('imageStats').textContent = done === total
      ? `İndirme bitti: ${total - errorCount}/${total}${errors}`
      : `İndiriliyor: ${done}/${total}${errors}. Pencereyi kapatsan da devam eder.`;
  }
  if (changes.basket || changes.vehicleTerms || changes.manualRates) refresh(false);
  if (changes.actionSurface) renderSurfacePicker();
  if (changes.guardedState) refreshGuarded();
});

/** readAgain reads the open page. Without it, a basket or switch change redraws from the last read. */
async function refresh(readAgain) {
  const run = ++app.run;
  const tab = await getActiveTab();
  const stored = await chrome.storage.local.get(['basket', 'vehicleTerms']);
  const features = await loadFeatures();
  if (run !== app.run) return;
  app.features = features;
  app.basket = stored.basket || {};
  app.terms = stored.vehicleTerms || [];

  const urlChanged = ((tab && tab.url) || '') !== app.url || (tab && app.tab && tab.id !== app.tab.id);
  app.tab = tab;
  app.loading = !!tab && isSahibinden(tab.url) && tab.status !== 'complete';
  if (urlChanged) resetForNewPage(tab);
  if (!tab || !isSahibinden(tab.url) || app.loading) {
    app.page = null;
  } else if (readAgain || !app.page) {
    let page;
    try {
      page = await runInTab(tab.id, 'extractPage');
    } catch (error) {
      page = { pageType: 'unreadable' };
    }
    if (run !== app.run) return;
    app.page = page;
  }

  try {
    app.ratesResult = await loadRates(features, false);
  } catch (error) {
    app.ratesResult = { status: 'error', rates: null };
  }
  if (run !== app.run) return;
  drawPage();
  drawVehicles();
  renderBasket();
}

function resetForNewPage(tab) {
  app.url = (tab && tab.url) || '';
  app.expanded.clear();
  app.search = '';
  setPageMessage('');
  $('imageResults').hidden = true;
  $('emptyState').hidden = false;
  $('emptyState').textContent = 'İlan sayfasında tüm fotoğraflar, liste sayfasında ilan görselleri gelir.';
}

/**
 * ============================================================================
 * PAGE TAB
 * ============================================================================
 */
function drawPage() {
  const { page } = app;
  const host = $('pageMain');
  const scroll = $('csv-tab').scrollTop;
  let parts;
  if (app.loading) {
    parts = stateBlock('Sayfa yükleniyor', 'Yüklenince rapor burada belirir.');
  } else if (!page) {
    parts = stateBlock('Bir sahibinden sayfası aç', 'Liste veya ilan sayfasına geçince rapor burada kendiliğinden belirir.');
  } else if (page.pageType === 'unreadable') {
    parts = stateBlock('Bu sayfa okunamadı', 'Sayfayı yenileyip tekrar dene.');
  } else if (pageProblem(page)) {
    parts = [el('div', { class: 'notice', icon: 'alert' }, el('span', { text: pageProblem(page) }))];
  } else {
    parts = page.pageType === 'detail' ? detailView(page) : listView(page);
  }
  host.replaceChildren(...parts.filter(Boolean));
  $('csv-tab').scrollTop = scroll;
  drawActions();
}

function stateBlock(title, text) {
  return [el('div', { class: 'state' }, [el('h2', { text: title }), el('p', { class: 'small muted', text })])];
}

function ratesBlock(price) {
  if (!price) return null;
  const holder = el('div');
  const { features } = app;
  if (!features.liveRates && !features.manualRates) {
    holder.appendChild(el('button', {
      class: 'btn-link', type: 'button', text: 'Dolar, euro, sterlin ve gram altın olarak göster',
      onclick: () => setFeature(getFeature('liveRates'), true)
    }));
    return holder;
  }
  renderRatesStrip(holder, price, app.ratesResult, async () => {
    app.ratesResult = await loadRates(features, true).catch(() => app.ratesResult);
    drawPage();
    drawVehicles();
  });
  return holder;
}

function detailView(page) {
  const { listing } = page;
  const record = detailToRecord(listing);
  const saved = app.basket[record.id];
  const history = saved ? saved.priceHistory || [] : [];
  const last = history[history.length - 1];
  const others = Object.values(app.basket);
  const facts = QUICK_FACTS.filter((name) => record.fields[name]).slice(0, 6);
  const chip = (name) => {
    if (name === 'KM') return `${formatNumber(toNumber(record.fields.KM))} km`;
    if (name === 'Yıl') return record.fields[name];
    return `${name.replace(/ \/.*$/, '')}: ${record.fields[name]}`;
  };

  const hero = el('section', { class: 'card' }, [
    el('p', { class: 'crumb', text: (listing.category || []).join(' › ') }),
    el('h2', { class: 'hero-title', text: listing.title }),
    el('p', { class: 'hero-figure', text: formatPrice(listing.price) }),
    el('p', { class: 'hero-note', text: listing.location.raw }),
    last ? el('p', { class: 'hero-note', text: `Önceki fiyat ${formatNumber(last.amount)} ${last.currency}` }) : null,
    facts.length > 0 ? el('div', { class: 'chips' }, facts.map((name) => el('span', { class: 'pill pill-neutral num', text: chip(name) }))) : null,
    saved ? el('div', { class: 'hero-tags' }, el('span', { class: 'pill pill-accent', text: 'Sepette' })) : null
  ]);

  const vehicle = isVehicle(record);
  const comparison = vehicle ? vehicleComparison(record, others) : null;
  const insights = listingInsights(record, app.features, { ...basketContext(others, Date.now()), now: Date.now() });
  const parcel = parcelFromFields(listing.attributes);
  const links = el('div', { class: 'link-row' }, [
    app.features.tkgm ? el('button', {
      class: 'btn', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç', disabled: !parcel,
      title: parcel ? `Ada ${parcel.ada}, Parsel ${parcel.parsel}` : 'Bu ilanda ada ve parsel bilgisi yok',
      onclick: () => openTkgmParcel(listing.location, parcel, setPageMessage)
    }) : null,
    vehicle && listing.id ? el('a', {
      href: `https://x.com/search?q=${encodeURIComponent(`#${listing.id}`)}`, target: '_blank', rel: 'noopener', text: 'X’te bu ilanı ara'
    }) : null
  ]);

  return [
    hero,
    ratesBlock(listing.price),
    comparison ? renderPeerComparison(comparison) : null,
    renderVehicleReport(record, app.terms),
    renderPhones(record),
    insights.length > 0 ? el('section', { class: 'card', id: 'pageInsights' }, [el('h2', { class: 'card-title', text: 'Bu ilan hakkında' }), renderFacts(insights)]) : null,
    app.features.notesTags ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Notların' }), renderNoteEditor(record.id)]) : null,
    renderTechnical(record, app.openFolds),
    descriptionFold(record),
    links.childElementCount > 0 ? links : null
  ];
}

function descriptionFold(record) {
  if (!record.description) return null;
  const fold = el('details', { class: 'fold' }, [
    el('summary', { text: 'İlan açıklaması' }),
    el('p', { class: 'description-text', text: record.description })
  ]);
  if (app.openFolds.has('description')) fold.open = true;
  fold.addEventListener('toggle', () => {
    if (fold.open) app.openFolds.add('description');
    else app.openFolds.delete('description');
  });
  return el('section', { class: 'card', style: 'padding-top: 4px; padding-bottom: 4px' }, fold);
}

function listRows(page, records) {
  const needle = app.search.trim().toLocaleLowerCase('tr');
  const pairs = page.rows.map((row, index) => ({ row, record: records[index] }));
  const matching = needle
    ? pairs.filter(({ record }) => `${record.title} ${record.id} ${record.location}`.toLocaleLowerCase('tr').includes(needle))
    : pairs;
  const price = ({ record }) => (record.price && record.price.amount) || null;
  const km = ({ record }) => toNumber((record.fields || {}).KM);
  const missingLast = (read, direction) => (a, b) => {
    const [first, second] = [read(a), read(b)];
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return (first - second) * direction;
  };
  const sorters = { priceUp: missingLast(price, 1), priceDown: missingLast(price, -1), km: missingLast(km, 1) };
  return app.sort === 'page' ? matching : [...matching].sort(sorters[app.sort]);
}

function listView(page) {
  const records = page.rows.map((row) => listRowToRecord(row, page));
  const medianPrice = pageMedianPrice(records);
  const hero = el('section', { class: 'card' }, [
    el('p', { class: 'crumb', text: (page.category || []).join(' › ') || 'Arama sonuçları' }),
    medianPrice ? el('p', { class: 'hero-figure', text: formatPrice(medianPrice) }) : null,
    el('p', { class: 'hero-note', text: `${medianPrice ? 'Medyan fiyat · ' : ''}Bu sayfada ${page.rows.length} ilan${page.total ? `, aramada ${formatNumber(page.total)}` : ''}` }),
    app.features.snapshots ? el('div', { class: 'hero-tags' }, el('button', { class: 'btn', type: 'button', icon: 'bookmark', text: 'Aramayı kaydet', onclick: saveSearch })) : null
  ]);

  const statsHolder = el('div');
  renderStats(statsHolder, records);
  const statsCard = statsHolder.childElementCount > 0 ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Bu sayfanın özeti' }), statsHolder]) : null;

  const rowsHost = el('div', { class: 'row-list' });
  const drawRows = () => {
    const shown = listRows(page, records);
    rowsHost.replaceChildren(...shown.map((item) => listRow(page, item.row, item.record, medianPrice)));
    if (shown.length === 0) rowsHost.appendChild(el('p', { class: 'small muted', text: 'Aramana uyan ilan yok.', style: 'padding: 12px 0' }));
  };
  const search = el('input', { type: 'search', placeholder: 'Bu sayfada ara', 'aria-label': 'Bu sayfada ara' });
  search.value = app.search;
  search.addEventListener('input', () => {
    app.search = search.value;
    drawRows();
  });
  const sort = el('select', { 'aria-label': 'Sırala' }, [
    ['page', 'Sayfa sırası'], ['priceUp', 'Fiyat artan'], ['priceDown', 'Fiyat azalan'], ['km', 'KM artan']
  ].map(([value, text]) => el('option', { value, text })));
  sort.value = app.sort;
  sort.addEventListener('change', () => {
    app.sort = sort.value;
    drawRows();
  });
  drawRows();

  return [
    hero,
    ratesBlock(medianPrice),
    statsCard,
    el('section', { class: 'card' }, [el('div', { class: 'list-tools' }, [search, sort]), rowsHost])
  ];
}

function listRow(page, row, record, medianPrice) {
  const saved = app.basket[record.id];
  const isOpen = app.expanded.has(record.id);
  const fields = record.fields || {};
  const diff = medianPrice && record.price && record.price.amount && record.price.currency === medianPrice.currency
    ? Math.round(((record.price.amount - medianPrice.amount) / medianPrice.amount) * 100)
    : null;
  const counts = saved ? damageCounts(saved.damage) : null;
  const meta = [
    fields['Yıl'],
    toNumber(fields.KM) !== null ? `${formatNumber(toNumber(fields.KM))} km` : fields['m² (Brüt)'] ? `${fields['m² (Brüt)']} m²` : fields['m²'] ? `${fields['m²']} m²` : null,
    diff === null || diff === 0 ? null : `Medyandan %${Math.abs(diff)} ${diff < 0 ? 'düşük' : 'yüksek'}`,
    counts ? `${counts.changed} D, ${counts.painted} B, ${counts.localPainted} L` : null,
    saved ? 'Sepette' : null
  ].filter(Boolean);

  const holder = el('div', { class: 'list-row' }, el('div', { class: 'list-row-main' }, [
    record.image ? el('img', { class: 'list-thumb', src: record.image, alt: '', loading: 'lazy' }) : el('div', { class: 'list-thumb' }),
    el('div', { style: 'min-width: 0' }, [
      el('a', { class: 'list-title', href: record.url, target: '_blank', rel: 'noopener', text: record.title, title: record.title }),
      el('div', { class: 'list-price', text: formatPrice(record.price) }),
      el('div', { class: 'list-meta' }, meta.map((text) => el('span', { text })))
    ]),
    expandButton(isOpen, () => {
      if (isOpen) app.expanded.delete(record.id);
      else app.expanded.add(record.id);
      drawPage();
    })
  ]));
  if (isOpen) holder.appendChild(listRowDetail(page, row, record));
  return holder;
}

function expandButton(isOpen, onclick) {
  return el('button', {
    class: 'expand', type: 'button', icon: 'chevron', 'aria-label': 'Ayrıntıyı aç veya kapat', 'aria-expanded': String(isOpen), onclick
  });
}

function listRowDetail(page, row, record) {
  const saved = app.basket[record.id];
  const parts = [];
  if (saved && saved.hasDetail) {
    parts.push(renderVehicleReport(saved, app.terms), renderPhones(saved));
    const comparison = isVehicle(saved) ? vehicleComparison(saved, Object.values(app.basket)) : null;
    if (comparison) parts.push(renderPeerComparison(comparison));
  } else if (app.features.readWithoutOpening) {
    parts.push(el('button', {
      class: 'btn', type: 'button', icon: 'search', text: 'Açmadan oku (yüksek risk)',
      title: 'Siteye 1 istek gönderir ve günlük sınıra sayılır',
      onclick: async (event) => {
        event.currentTarget.disabled = true;
        setPageMessage('İlan okunuyor...');
        const result = await chrome.runtime.sendMessage({ action: 'enrich-start', data: { tabId: app.tab.id, listings: [{ id: record.id, url: record.url }] } });
        setPageMessage(result.status === 'error' ? result.error : 'İstek gönderildi. Sonuç gelince burada görünür.');
      }
    }));
  } else {
    parts.push(el('p', { class: 'small muted', text: 'Hasar ve teknik bilgi ilan sayfasındadır. İlanı açıp sepete eklersen burada da görünür. Açmadan okumak Ayarlar’daki yüksek riskli bir özelliktir.' }));
  }
  if (!saved) {
    parts.push(el('button', {
      class: 'btn', type: 'button', icon: 'plus', text: 'Bu ilanı sepete ekle',
      onclick: () => chrome.runtime.sendMessage({ action: 'basket-add-page', data: { page: { ...page, rows: [row] } } })
    }));
  }
  return el('div', { class: 'list-row-detail' }, parts.filter(Boolean));
}

async function saveSearch() {
  try {
    const page = await readPage();
    if (page.pageType !== 'list') return;
    const key = searchKey(page.url);
    const { savedSearches = {} } = await chrome.storage.local.get('savedSearches');
    const current = snapshotFromPage(page, new Date().toISOString());
    const diff = savedSearches[key] ? diffSnapshots(savedSearches[key], current) : null;
    savedSearches[key] = { ...current, lastDiff: diff };
    await chrome.storage.local.set({ savedSearches });
    setPageMessage(diff
      ? `Son kayda göre ${diff.added.length} yeni, ${diff.missing.length} görünmeyen, ${diff.priceChanged.length} fiyatı değişen ilan.`
      : 'Arama kaydedildi. Bir sonraki kayıtta farkları gösterir.');
  } catch (error) {
    setPageMessage('Arama kaydedilemedi.');
  }
}

/**
 * ============================================================================
 * PAGE EXPORT BAR
 * ============================================================================
 */
async function withFreshPage(action) {
  try {
    const page = await readPage();
    const problem = pageProblem(page);
    if (problem) {
      setPageMessage(problem);
      return;
    }
    await action(page);
  } catch (error) {
    console.error('Error reading page:', error);
    setPageMessage('Veri okunamadı. Sayfayı yenileyip tekrar dene.');
  }
}

function drawActions() {
  const bar = $('pageActions');
  const { page } = app;
  const usable = page && page.pageType !== 'unreadable' && !pageProblem(page);
  bar.hidden = !usable || !$('csv-tab').classList.contains('active');
  if (bar.hidden) {
    bar.textContent = '';
    return;
  }
  bar.replaceChildren(
    el('button', {
      id: 'downloadCsvBtn', class: 'btn btn-primary', type: 'button', icon: 'download', text: 'CSV indir',
      onclick: () => withFreshPage(async (fresh) => {
        const context = await exportContext(app.features, app.ratesResult.rates);
        const rows = fresh.pageType === 'list'
          ? listPageToRows(fresh, context)
          : recordsToRows([{ ...detailToRecord(fresh.listing), priceHistory: [] }], [], context);
        downloadCsv(rows, exportFileName(fresh, 'csv', todayIso()));
        setPageMessage(fresh.pageType === 'list' ? `${fresh.rows.length} ilan indirildi.` : 'İlan indirildi.');
      })
    }),
    el('button', {
      id: 'addPageBtn', class: 'btn', type: 'button', icon: 'plus', text: 'Sepete ekle',
      onclick: () => withFreshPage(async (fresh) => {
        const result = await chrome.runtime.sendMessage({ action: 'basket-add-page', data: { page: fresh } });
        setPageMessage(result.status === 'success'
          ? `Sepet: ${result.counts.new} yeni, ${result.counts.updated} güncellendi, ${result.counts.priceChanged} fiyatı değişti.`
          : 'Sepete eklenemedi.');
      })
    }),
    el('button', {
      id: 'downloadJsonBtn', class: 'btn', type: 'button', text: 'JSON',
      onclick: () => withFreshPage(async (fresh) => {
        downloadJson(fresh, exportFileName(fresh, 'json', todayIso()));
        setPageMessage('JSON indirildi.');
      })
    })
  );
}

/**
 * ============================================================================
 * VEHICLES TAB
 * ============================================================================
 */
function drawVehicles() {
  const board = $('vehicleBoard');
  const records = Object.values(app.basket);
  const vehicles = records.filter(isVehicle);
  const parts = [];

  if (vehicles.length === 0) {
    parts.push(...stateBlock('Sepette araç ilanı yok', 'Bir araç ilanını ya da listesini Sayfa bölümünden sepete ekle. Hasar şeması için ilan sayfasından eklemek gerekir.'));
    parts.push(renderTermsEditor(app.terms, 'card'));
    board.replaceChildren(...parts);
    return;
  }

  const groups = vehicleGroups(vehicles);
  if (groups.length > 0) {
    parts.push(el('section', { class: 'card' }, [
      el('h2', { class: 'card-title', text: 'Seri özeti' }),
      el('div', {}, groups.slice(0, 8).map((group) => el('div', { class: 'series-row' }, [
        el('div', {}, [
          el('div', { style: 'font-weight: 600', text: group.key }),
          el('div', { class: 'muted', text: `${formatNumber(group.count)} ilan${group.medianKm ? `, medyan ${formatNumber(group.medianKm)} km` : ''}` })
        ]),
        el('div', { class: 'series-figures' }, [
          el('div', { style: 'font-weight: 650', text: group.medianPrice ? `${formatNumber(group.medianPrice)} ${group.currency}` : '-' }),
          el('div', { class: 'muted', text: group.minPrice ? `en düşük ${formatNumber(group.minPrice)}` : '' })
        ])
      ])))
    ]));
  }

  const rowsHost = el('div', { class: 'row-list' });
  const drawRows = () => {
    const rows = filterVehicles(records, app.vehicleFilters);
    rowsHost.replaceChildren(...rows.map((record) => vehicleRow(record, vehicles, drawRows)));
    if (rows.length === 0) rowsHost.appendChild(el('p', { class: 'small muted', style: 'padding: 12px 0', text: 'Bu filtrelere uyan araç yok. Hasar filtreleri yalnızca ilan sayfasından eklenen ilanlarda çalışır.' }));
  };
  drawRows();

  parts.push(
    el('section', { class: 'card' }, [
      el('div', { class: 'group-header' }, [
        el('h2', { text: `${formatNumber(vehicles.length)} araç ilanı` }),
        el('button', {
          class: 'btn', type: 'button', icon: 'download', text: 'CSV',
          onclick: async () => {
            const { hiddenColumns = [] } = await chrome.storage.local.get('hiddenColumns');
            const context = await exportContext(app.features, app.ratesResult.rates);
            downloadCsv(recordsToRows(filterVehicles(records, app.vehicleFilters), hiddenColumns, context), `sahibinden_arac_${todayIso()}.csv`);
          }
        })
      ]),
      el('div', { style: 'margin-bottom: 8px' }, renderVehicleFilters(records, app.vehicleFilters, drawRows)),
      rowsHost
    ]),
    renderTermsEditor(app.terms, 'card')
  );
  const scroll = $('vehicles-tab').scrollTop;
  board.replaceChildren(...parts);
  $('vehicles-tab').scrollTop = scroll;
}

function vehicleRow(record, vehicles, redraw) {
  const fields = record.fields || {};
  const isOpen = app.vehicleExpanded.has(record.id);
  const comparison = vehicleComparison(record, vehicles);
  const yearly = computedFields(record, { now: Date.now() }).find(([name]) => name === 'Yıllık KM');
  const tramer = parseDescription(record.description).tramer;
  const meta = [
    fields['Yıl'],
    toNumber(fields.KM) !== null ? `${formatNumber(toNumber(fields.KM))} km` : null,
    yearly ? `yılda ${formatNumber(yearly[1])} km` : null,
    tramer === undefined ? null : `Tramer ${typeof tramer === 'number' ? `${formatNumber(tramer)} TL` : tramer}`,
    comparison && comparison.priceDiff !== null ? `Seriye göre ${peerDiffText(comparison)}` : null
  ].filter(Boolean);
  const holder = el('div', { class: 'list-row' }, el('div', { class: 'list-row-main' }, [
    record.image ? el('img', { class: 'list-thumb', src: record.image, alt: '', loading: 'lazy' }) : el('div', { class: 'list-thumb' }),
    el('div', { style: 'min-width: 0' }, [
      el('a', { class: 'list-title', href: record.url, target: '_blank', rel: 'noopener', text: record.title, title: record.title }),
      el('div', { class: 'list-price', text: formatPrice(record.price) }),
      el('div', { class: 'list-meta' }, meta.map((text) => el('span', { text }))),
      el('div', { style: 'margin-top: 3px' }, renderDamageChips(record))
    ]),
    expandButton(isOpen, () => {
      if (isOpen) app.vehicleExpanded.delete(record.id);
      else app.vehicleExpanded.add(record.id);
      redraw();
    })
  ]));
  if (isOpen) {
    const parts = [
      comparison ? renderPeerComparison(comparison) : null,
      renderVehicleReport(record, app.terms),
      renderPhones(record),
      renderTechnical(record, app.openFolds)
    ].filter(Boolean);
    holder.appendChild(el('div', { class: 'list-row-detail' }, parts.length > 0 ? parts : el('p', { class: 'small muted', text: 'Hasar ve teknik bilgi için ilanı açıp sepete ekle.' })));
  }
  return holder;
}

/**
 * ============================================================================
 * BASKET
 * ============================================================================
 */
async function loadBasket() {
  const { basket = {}, hiddenColumns = [] } = await chrome.storage.local.get(['basket', 'hiddenColumns']);
  const records = Object.values(basket).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  return { records, hiddenColumns };
}

const openWorkspace = () => chrome.tabs.create({ url: 'dashboard.html' });
$('openWorkspaceBtn').addEventListener('click', openWorkspace);
$('basketOpenBtn').addEventListener('click', openWorkspace);
$('openPanelBtn').addEventListener('click', () => {
  chrome.sidePanel.open({ windowId: app.tab.windowId });
  window.close();
});

async function renderBasket() {
  const { records } = await loadBasket();
  const withDetail = records.filter((record) => record.hasDetail).length;
  const count = $('basketCount');
  count.hidden = records.length === 0;
  count.textContent = formatNumber(records.length);
  $('basketSummary').textContent = records.length === 0 ? 'Sepet boş' : `${formatNumber(records.length)} ilan`;
  $('basketCaption').textContent = records.length === 0
    ? 'Gezdiğin sayfaları Sayfa bölümünden ekle.'
    : `${withDetail} ilanın tüm detayı var`;
  ['basketCsvBtn', 'basketJsonBtn'].forEach((id) => { $(id).disabled = records.length === 0; });
  renderStats($('basketStats'), records);
  $('basketStats').hidden = $('basketStats').childElementCount === 0;

  const list = $('basketList');
  list.textContent = '';
  list.hidden = records.length === 0;
  records.slice(0, 5).forEach((record) => {
    list.appendChild(el('div', { class: 'basket-row' }, [
      el('span', { class: 'basket-row-title', text: record.title, title: record.title }),
      el('span', { class: 'basket-row-price', text: formatPrice(record.price) })
    ]));
  });
}

$('basketCsvBtn').addEventListener('click', async () => {
  const { records, hiddenColumns } = await loadBasket();
  if (records.length === 0) return;
  const context = await exportContext(app.features, app.ratesResult.rates);
  downloadCsv(recordsToRows(records, hiddenColumns, context), `sahibinden_sepet_${todayIso()}.csv`);
  $('basketMessage').textContent = `${records.length} ilan indirildi.`;
});

$('basketJsonBtn').addEventListener('click', async () => {
  const { records } = await loadBasket();
  if (records.length === 0) return;
  downloadJson(records, `sahibinden_sepet_${todayIso()}.json`);
  $('basketMessage').textContent = 'JSON indirildi.';
});

/**
 * ============================================================================
 * IMAGE DOWNLOAD
 * ============================================================================
 */
let imageFolder = 'images';

$('scanImagesBtn').addEventListener('click', async () => {
  const scanButton = $('scanImagesBtn');
  scanButton.disabled = true;
  try {
    const tab = await getActiveTab();
    const { folder, groups } = await runInTab(tab.id, 'scanPageForImages');
    imageFolder = folder;
    displayImageGroups(groups);
    $('emptyState').hidden = true;
  } catch (error) {
    console.error('Error scanning images:', error);
    $('emptyState').hidden = false;
    $('emptyState').textContent = 'Bu sayfa taranamadı. Sahibinden dışındaki bir sitedeysen, o sekmedeyken eklenti simgesine tıklayıp tekrar dene.';
  }
  scanButton.disabled = false;
});

async function startImageDownload(images, summary) {
  const result = await chrome.runtime.sendMessage({
    action: 'download-images',
    data: { images, folder: imageFolder }
  });
  const stats = $('imageStats');
  if (result.status === 'started') {
    stats.textContent = `İndiriliyor: 0/${result.totalImages}. Pencereyi kapatsan da devam eder.`;
  } else {
    stats.textContent = result.error === 'busy' ? 'Önceki indirme hâlâ sürüyor.' : summary;
  }
}

function displayImageGroups(imageGroups) {
  const containerDiv = $('imageGroupsContainer');
  const downloadAllBtn = $('downloadAllBtn');
  const groups = Object.values(imageGroups);
  const allImages = groups.flatMap((group) => group.images);
  const summary = `${allImages.length} görsel bulundu`;

  $('imageResults').hidden = false;
  $('imageStats').textContent = summary;
  downloadAllBtn.disabled = allImages.length === 0;
  downloadAllBtn.onclick = () => startImageDownload(allImages, summary);

  containerDiv.textContent = '';
  if (allImages.length === 0) {
    containerDiv.appendChild(el('p', { class: 'empty-text', text: 'Sayfada görsel bulunamadı.' }));
    return;
  }

  groups.forEach((group) => {
    const grid = el('div', { class: 'image-grid' });
    group.images.slice(0, 8).forEach((imageData) => {
      grid.appendChild(el('div', { class: 'image-item' }, [
        el('img', { src: imageData.url, alt: imageData.alt || '', loading: 'lazy' }),
        el('button', {
          class: 'image-download', type: 'button', icon: 'download',
          title: 'Bu görseli indir', 'aria-label': 'Bu görseli indir',
          onclick: () => startImageDownload([imageData], summary)
        })
      ]));
    });
    if (group.images.length > 8) {
      grid.appendChild(el('div', { class: 'image-item image-more', text: `+${group.images.length - 8}` }));
    }
    containerDiv.appendChild(el('div', { class: 'image-group' }, [
      el('div', { class: 'group-header' }, [
        el('div', {}, [
          el('h2', { text: group.renderedDimensions }),
          el('p', { class: 'small muted', text: `${group.images.length} görsel` })
        ]),
        el('button', {
          class: 'btn', type: 'button', icon: 'download', text: 'İndir',
          onclick: () => startImageDownload(group.images, summary)
        })
      ]),
      grid
    ]));
  });
}

/**
 * ============================================================================
 * EXPERIMENTAL TOOLS
 * ============================================================================
 */
const GUARDED_TOOLS = [
  { feature: 'readWithoutOpening', label: 'Bu listedeki ilanları oku' },
  { feature: 'autoPagination', label: 'Sonraki sayfaları oku' },
  { feature: 'bulkPriceHistory', label: 'Fiyat geçmişini al' }
];

async function startGuardedTool(feature) {
  const message = $('guardedMessage');
  try {
    const page = await readPage();
    if (page.pageType !== 'list' || page.rows.length === 0) {
      message.textContent = 'Önce bir liste sayfası aç.';
      return;
    }
    const { basket = {} } = await chrome.storage.local.get('basket');
    const tabId = app.tab.id;
    let request;
    if (feature === 'readWithoutOpening') {
      const listings = page.rows
        .filter((row) => row.url && !(basket[row.id] && basket[row.id].hasDetail))
        .map((row) => ({ id: row.id, url: row.url }));
      request = { action: 'enrich-start', data: { tabId, listings } };
    } else if (feature === 'autoPagination') {
      request = { action: 'paginate-start', data: { tabId, page } };
    } else {
      // Only listings already in the basket, since that is where the history gets saved
      const ids = page.rows.map((row) => row.id).filter((id) => basket[id] && !basket[id].remoteHistory);
      request = { action: 'history-start', data: { tabId, ids } };
    }
    const result = await chrome.runtime.sendMessage(request);
    if (result.status === 'error') message.textContent = result.error;
    refreshGuarded();
  } catch (error) {
    message.textContent = 'Sayfa okunamadı.';
  }
}

async function refreshGuarded() {
  const status = await chrome.runtime.sendMessage({ action: 'guarded-status' });
  if (!status || status.status === 'error') return;
  const cooling = status.cooldownUntil > Date.now();
  const enabled = GUARDED_TOOLS.filter((tool) => app.features[tool.feature]);
  const holder = $('guardedTools');
  holder.textContent = '';
  $('guardedOff').hidden = enabled.length > 0;

  if (status.running) {
    holder.appendChild(el('button', {
      class: 'btn btn-danger', type: 'button', icon: 'stop', text: 'Durdur',
      onclick: () => chrome.runtime.sendMessage({ action: 'guarded-stop' })
    }));
  } else {
    enabled.forEach((tool) => {
      holder.appendChild(el('button', {
        class: 'btn', type: 'button', icon: 'play', text: tool.label, disabled: cooling,
        onclick: () => startGuardedTool(tool.feature)
      }));
    });
  }
  $('guardedLimits').textContent = enabled.length > 0
    ? `Çalışma başına en fazla ${status.maxListingsPerRun} ilan veya ${status.maxPagesPerRun} sayfa, günde ${status.maxPerDay} istek, istekler arası ${status.delaySeconds} sn. Bugün: ${status.usedToday}.`
    : '';
  if (status.running) {
    $('guardedMessage').textContent = `${status.label}: ${status.done}/${status.total}. Bu sekmede kal.`;
  } else if (cooling) {
    const minutes = Math.ceil((status.cooldownUntil - Date.now()) / 60000);
    $('guardedMessage').textContent = `${status.lastMessage} Kalan süre: ${minutes} dk.`;
  } else {
    $('guardedMessage').textContent = status.lastMessage;
  }
}

/**
 * ============================================================================
 * SETTINGS
 * ============================================================================
 */
function renderFeatureList() {
  renderFeatureSettings($('featureList'), app.features, (text) => { $('settingsMessage').textContent = text; });
  const onCount = FEATURES.filter((feature) => app.features[feature.id]).length;
  const badge = $('featureCount');
  badge.hidden = onCount === 0;
  badge.textContent = String(onCount);
}

async function renderSurfacePicker() {
  const { actionSurface = 'panel' } = await chrome.storage.local.get('actionSurface');
  const picker = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Simgeye tıklayınca' });
  [['panel', 'Yan panel'], ['popup', 'Küçük pencere']].forEach(([value, label]) => {
    picker.appendChild(el('button', {
      type: 'button', text: label, 'aria-pressed': String(actionSurface === value),
      onclick: () => chrome.storage.local.set({ actionSurface: value })
    }));
  });
  $('surfacePicker').replaceChildren(picker);
}

$('allOffBtn').addEventListener('click', async () => {
  await resetAllFeatures();
  await chrome.runtime.sendMessage({ action: 'features-changed' });
  $('settingsMessage').textContent = 'Tüm özellikler kapatıldı.';
});
