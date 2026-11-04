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
  vehicleFilters: { series: '', damage: '', sortBy: 'page', descending: false },
  vehicleExpanded: new Set(),
  vehicleScope: null,
  emlakFilters: { subtype: '', sortBy: 'page', descending: false },
  emlakExpanded: new Set(),
  emlakScope: null,
  basketFilters: { search: '', kind: '', sortBy: 'lastSeen', descending: true },
  basketSelected: new Set(),
  basketExpanded: new Set(),
  basketShown: 50,
  clearAsked: false
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
  if (changes.basket || changes.vehicleTerms || changes.manualRates || changes.savedSearches) refresh(false);
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
  drawEmlak();
  renderBasket();
}

function resetForNewPage(tab) {
  app.url = (tab && tab.url) || '';
  app.expanded.clear();
  app.search = '';
  app.vehicleScope = null;
  app.emlakScope = null;
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
    drawEmlak();
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

  const mileage = vehicleMileage(record, Date.now());
  const hero = el('section', { class: 'card' }, [
    el('p', { class: 'crumb', text: (listing.category || []).join(' › ') }),
    el('h2', { class: 'hero-title', text: listing.title }),
    el('p', { class: 'hero-figure', text: formatPrice(listing.price) }),
    el('p', { class: 'hero-note', text: listing.location.raw }),
    mileage ? el('p', { class: 'hero-note', text: mileage.sentence }) : null,
    last ? el('p', { class: 'hero-note', text: `Önceki fiyat ${formatNumber(last.amount)} ${last.currency}` }) : null,
    facts.length > 0 ? el('div', { class: 'chips' }, facts.map((name) => el('span', { class: 'pill pill-neutral num', text: chip(name) }))) : null,
    saved ? el('div', { class: 'hero-tags' }, el('span', { class: 'pill pill-accent', text: 'Sepette' })) : null
  ]);

  const insights = listingInsights(record, app.features, { ...basketContext(others, Date.now()), now: Date.now() });
  const parcel = parcelFromFields(listing.attributes);
  const links = el('div', { class: 'link-row' }, [
    app.features.tkgm ? el('button', {
      class: 'btn', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç', disabled: !parcel,
      title: parcel ? `Ada ${parcel.ada}, Parsel ${parcel.parsel}` : 'Bu ilanda ada ve parsel bilgisi yok',
      onclick: () => openTkgmParcel(listing.location, parcel, setPageMessage)
    }) : null
  ]);

  return [
    hero,
    ratesBlock(listing.price),
    renderVehicleReport(record, app.terms),
    renderPhones(record),
    renderDescription(record, app.openFolds),
    insights.length > 0 ? el('section', { class: 'card', id: 'pageInsights' }, [el('h2', { class: 'card-title', text: 'Bu ilan hakkında' }), renderFacts(insights)]) : null,
    app.features.notesTags ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Notların' }), renderNoteEditor(record.id)]) : null,
    renderTechnical(record, app.openFolds),
    links.childElementCount > 0 ? links : null
  ];
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
    rowsHost.replaceChildren(...shown.map((item) => listRow(page, item.row, item.record)));
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

function listRow(page, row, record) {
  const saved = app.basket[record.id];
  const isOpen = app.expanded.has(record.id);
  const fields = record.fields || {};
  const mileage = vehicleMileage(record, Date.now());
  const counts = saved ? damageCounts(saved.damage) : null;
  const meta = [
    fields['Yıl'],
    toNumber(fields.KM) !== null ? `${formatNumber(toNumber(fields.KM))} km` : fields['m² (Brüt)'] ? `${fields['m² (Brüt)']} m²` : fields['m²'] ? `${fields['m²']} m²` : null,
    mileage ? mileage.short : null,
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

/** A listing known only from a results table. Its description is read by opening it, or by the high-risk switch. */
function unreadListing(record, say) {
  if (!app.features.readWithoutOpening || !app.page || !record.url) {
    return el('p', { class: 'small muted', text: 'Açıklama, hasar ve teknik bilgi ilan sayfasındadır. İlanı açıp sepete eklersen burada da görünür. Açmadan okumak Deneysel’deki yüksek riskli bir özelliktir.' });
  }
  return el('button', {
    class: 'btn', type: 'button', icon: 'search', text: 'Açmadan oku (yüksek risk)',
    title: 'Siteye 1 istek gönderir ve günlük sınıra sayılır',
    onclick: async (event) => {
      event.currentTarget.disabled = true;
      say('İlan okunuyor...');
      const result = await chrome.runtime.sendMessage({ action: 'enrich-start', data: { tabId: app.tab.id, listings: [{ id: record.id, url: record.url }] } });
      say(result.status === 'error' ? result.error : 'İstek gönderildi. Sonuç gelince burada görünür.');
    }
  });
}

function descriptionOrRead(record, say) {
  if (record.description) return renderDescription(record, app.openFolds);
  return record.hasDetail ? null : unreadListing(record, say);
}

function listRowDetail(page, row, record) {
  const saved = app.basket[record.id];
  const parts = [];
  if (saved && saved.hasDetail) {
    parts.push(renderVehicleReport(saved, app.terms), renderPhones(saved), renderDescription(saved, app.openFolds));
  } else {
    parts.push(unreadListing(record, setPageMessage));
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
/** The open page's listings, with anything already saved about them */
function pageListings() {
  const { page } = app;
  if (!page) return [];
  const saved = (record) => withSaved(record, app.basket[record.id]);
  if (page.pageType === 'detail') return [saved(detailToRecord(page.listing))];
  if (page.pageType === 'list') return page.rows.map((row) => saved(listRowToRecord(row, page)));
  return [];
}

/** Which listings a board shows. It starts on the open page when that page has any of its kind. */
function boardScope(chosen, belongs) {
  const onPage = pageListings().filter(belongs);
  const inBasket = Object.values(app.basket).filter(belongs);
  const scope = chosen || (onPage.length > 0 ? 'page' : 'basket');
  return { scope, onPage, inBasket, records: scope === 'page' ? onPage : inBasket };
}

function scopePicker(scope, onPage, inBasket, onPick) {
  const picker = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Hangi ilanlar' });
  [['page', `Bu sayfa (${formatNumber(onPage.length)})`], ['basket', `Sepet (${formatNumber(inBasket.length)})`]].forEach(([value, label]) => {
    picker.appendChild(el('button', { type: 'button', text: label, 'aria-pressed': String(scope === value), onclick: () => onPick(value) }));
  });
  return picker;
}

/** A row of the open results page, so one listing can go to the basket from a board */
function addListingButton(record) {
  if (app.basket[record.id] || !app.page) return null;
  const { page } = app;
  const row = page.pageType === 'list' ? page.rows.find((item) => item.id === record.id) : null;
  if (page.pageType === 'list' && !row) return null;
  return el('button', {
    class: 'btn', type: 'button', icon: 'plus', text: 'Sepete ekle',
    onclick: () => chrome.runtime.sendMessage({ action: 'basket-add-page', data: { page: row ? { ...page, rows: [row] } : page } })
  });
}

function listingCard({ record, specs, summary, chips, isOpen, onToggle, details }) {
  const holder = el('div', { class: 'list-row' }, el('div', { class: 'card-row-main' }, [
    record.image ? el('img', { class: 'card-thumb', src: record.image, alt: '', loading: 'lazy' }) : el('div', { class: 'card-thumb' }),
    el('div', { style: 'min-width: 0' }, [
      el('a', { class: 'list-title', href: record.url, target: '_blank', rel: 'noopener', text: record.title, title: record.title }),
      el('div', { class: 'list-price', text: formatPrice(record.price) }),
      renderSpecs(specs),
      summary.length > 0 ? el('div', { class: 'list-meta', style: 'margin-top: 4px' }, summary.map((text) => el('span', { text }))) : null,
      chips ? el('div', { style: 'margin-top: 4px' }, chips) : null
    ]),
    expandButton(isOpen, onToggle)
  ]));
  if (isOpen) holder.appendChild(el('div', { class: 'list-row-detail' }, details().filter(Boolean)));
  return holder;
}

function factsCard(title, facts) {
  return facts.length > 0 ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: title }), renderFacts(facts)]) : null;
}

/**
 * ============================================================================
 * VEHICLES TAB
 * ============================================================================
 */
function drawVehicles() {
  const board = $('vehicleBoard');
  const { scope, onPage, inBasket, records } = boardScope(app.vehicleScope, isVehicle);
  const parts = [];
  const picker = scopePicker(scope, onPage, inBasket, (value) => {
    app.vehicleScope = value;
    drawVehicles();
  });

  if (records.length === 0) {
    parts.push(picker, ...stateBlock(scope === 'page' ? 'Bu sayfada araç ilanı yok' : 'Sepette araç ilanı yok', 'Bir araç listesi ya da ilanı açınca burada görünür. Hasar şeması için ilan sayfası gerekir.'));
    parts.push(renderTermsEditor(app.terms, 'card'));
    board.replaceChildren(...parts);
    return;
  }

  const groups = vehicleGroups(records);
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
    rowsHost.replaceChildren(...rows.map((record) => vehicleCard(record, drawRows)));
    if (rows.length === 0) rowsHost.appendChild(el('p', { class: 'small muted', style: 'padding: 12px 0', text: 'Bu filtrelere uyan araç yok. Hasar filtreleri yalnızca ilan sayfası okunmuş ilanlarda çalışır.' }));
  };
  drawRows();

  parts.unshift(el('div', { class: 'board-head' }, [
    picker,
    el('button', {
      class: 'btn', type: 'button', icon: 'download', text: 'CSV',
      onclick: async () => {
        const { hiddenColumns = [] } = await chrome.storage.local.get('hiddenColumns');
        const context = await exportContext(app.features, app.ratesResult.rates);
        downloadCsv(recordsToRows(filterVehicles(records, app.vehicleFilters), hiddenColumns, context), `sahibinden_arac_${todayIso()}.csv`);
      }
    })
  ]));
  parts.push(
    el('section', { class: 'card' }, [
      el('div', { style: 'margin-bottom: 8px' }, renderVehicleFilters(records, app.vehicleFilters, drawRows)),
      rowsHost
    ]),
    renderTermsEditor(app.terms, 'card')
  );
  const scroll = $('vehicles-tab').scrollTop;
  board.replaceChildren(...parts);
  $('vehicles-tab').scrollTop = scroll;
}

function vehicleCard(record, redraw) {
  const now = Date.now();
  const say = (text) => { $('boardMessage').textContent = text; };
  const facts = vehicleFacts(record, now);
  const mileage = vehicleMileage(record, now);
  const isOpen = app.vehicleExpanded.has(record.id);
  return listingCard({
    record,
    isOpen,
    specs: vehicleSpecs(record),
    summary: mileage ? [mileage.sentence] : [],
    chips: renderDamageChips(record),
    onToggle: () => {
      if (isOpen) app.vehicleExpanded.delete(record.id);
      else app.vehicleExpanded.add(record.id);
      redraw();
    },
    details: () => [
      renderPhotoBlock(record, say),
      addListingButton(record),
      factsCard('Kesin bilgiler', facts),
      renderVehicleReport(record, app.terms),
      renderPhones(record),
      descriptionOrRead(record, say),
      renderTechnical(record, app.openFolds)
    ]
  });
}

/**
 * ============================================================================
 * REAL ESTATE TAB
 * ============================================================================
 */
function drawEmlak() {
  const board = $('emlakBoard');
  const { scope, onPage, inBasket, records } = boardScope(app.emlakScope, isRealEstate);
  const picker = scopePicker(scope, onPage, inBasket, (value) => {
    app.emlakScope = value;
    app.emlakFilters.subtype = '';
    drawEmlak();
  });
  const browse = el('section', { class: 'card' }, [
    el('h2', { class: 'card-title', text: 'Sahibinden’de kategoriye git' }),
    el('div', { class: 'link-chips' }, EMLAK_SUBTYPES.map((subtype) => el('a', {
      href: emlakCategoryLink(subtype, app.url), target: '_blank', rel: 'noopener', text: subtype.label
    })))
  ]);
  if (records.length === 0) {
    board.replaceChildren(picker, ...stateBlock(scope === 'page' ? 'Bu sayfada emlak ilanı yok' : 'Sepette emlak ilanı yok', 'Bir emlak listesi ya da ilanı açınca burada görünür.'), browse);
    return;
  }
  if (app.emlakFilters.subtype && !emlakCounts(records).some((item) => item.id === app.emlakFilters.subtype)) app.emlakFilters.subtype = '';

  const rowsHost = el('div', { class: 'row-list' });
  const drawRows = () => {
    const rows = filterEmlak(records, app.emlakFilters);
    rowsHost.replaceChildren(...rows.map((record) => emlakCard(record, drawRows)));
  };
  drawRows();
  const chips = () => renderEmlakChips(records, app.emlakFilters.subtype, (id) => {
    app.emlakFilters.subtype = id;
    drawEmlak();
  });
  const scroll = $('emlak-tab').scrollTop;
  board.replaceChildren(
    el('div', { class: 'board-head' }, [
      picker,
      el('button', {
        class: 'btn', type: 'button', icon: 'download', text: 'CSV',
        onclick: async () => {
          const { hiddenColumns = [] } = await chrome.storage.local.get('hiddenColumns');
          const context = await exportContext(app.features, app.ratesResult.rates);
          downloadCsv(recordsToRows(filterEmlak(records, app.emlakFilters), hiddenColumns, context), `sahibinden_emlak_${todayIso()}.csv`);
        }
      })
    ]),
    chips(),
    el('section', { class: 'card' }, [
      el('div', { style: 'margin-bottom: 8px' }, renderEmlakSort(app.emlakFilters, drawRows)),
      rowsHost
    ]),
    browse
  );
  $('emlak-tab').scrollTop = scroll;
}

function emlakCard(record, redraw) {
  const facts = emlakFacts(record, Date.now());
  const unit = facts.find(([name]) => name === 'Fiyat/m²');
  const isOpen = app.emlakExpanded.has(record.id);
  const subtype = emlakSubtype(record);
  const parcel = parcelFromFields(record.fields);
  const place = { il: (record.fields || {})['İl'], ilce: (record.fields || {})['İlçe'], mahalle: (record.fields || {})['Mahalle'] };
  const status = (text) => { $('emlakMessage').textContent = text; };
  return listingCard({
    record,
    isOpen,
    specs: emlakSpecs(record),
    summary: [subtype.label, unit ? `m² ${unit[1]}` : null].filter(Boolean),
    onToggle: () => {
      if (isOpen) app.emlakExpanded.delete(record.id);
      else app.emlakExpanded.add(record.id);
      redraw();
    },
    details: () => [
      renderPhotoBlock(record, status),
      addListingButton(record),
      factsCard('Kesin bilgiler', facts),
      app.features.tkgm && parcel && place.il && place.ilce && place.mahalle ? el('button', {
        class: 'btn', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç',
        onclick: () => openTkgmParcel(place, parcel, status)
      }) : null,
      renderPhones(record),
      !record.hasDetail ? el('p', { class: 'small muted', text: 'Daha fazla bilgi için ilanı açıp sepete ekle.' }) : null
    ]
  });
}

/**
 * ============================================================================
 * BASKET
 * ============================================================================
 */
const openWorkspace = () => chrome.tabs.create({ url: 'dashboard.html' });
$('openWorkspaceBtn').addEventListener('click', openWorkspace);
$('openPanelBtn').addEventListener('click', () => {
  chrome.sidePanel.open({ windowId: app.tab.windowId });
  window.close();
});

const BASKET_SORTS = {
  newest: ['lastSeen', true],
  priceUp: ['price', false],
  priceDown: ['price', true],
  unitUp: ['unitPrice', false],
  date: ['date', true],
  title: ['title', false]
};

function basketMessage(text) {
  $('basketMessage').textContent = text;
}

function visibleBasket(records) {
  const { search, kind, sortBy, descending } = app.basketFilters;
  const matching = filterAndSortRecords(records, { search, sortBy, descending }, {});
  return kind ? matching.filter((record) => recordKind(record) === kind) : matching;
}

/** The whole basket, managed from here: find, select, compare, export, remove, clear */
async function renderBasket() {
  const { hiddenColumns = [], savedSearches = {} } = await chrome.storage.local.get(['hiddenColumns', 'savedSearches']);
  const records = Object.values(app.basket);
  const ids = new Set(records.map((record) => record.id));
  [...app.basketSelected].forEach((id) => {
    if (!ids.has(id)) app.basketSelected.delete(id);
  });
  const count = $('basketCount');
  count.hidden = records.length === 0;
  count.textContent = formatNumber(records.length);

  const scroll = $('basket-tab').scrollTop;
  const board = $('basketBoard');
  const context = await exportContext(app.features, app.ratesResult.rates);
  if (records.length === 0) {
    app.clearAsked = false;
    board.replaceChildren(...stateBlock('Sepet boş', 'Gezdiğin sayfaları Sayfa bölümünden ya da Araç ve Emlak kartlarından ekle.'), savedSearchesFold(savedSearches));
    return;
  }

  const withDetail = records.filter((record) => record.hasDetail).length;
  const summary = el('section', { class: 'card lead' }, [
    el('div', {}, [
      el('p', { class: 'lead-figure', text: `${formatNumber(records.length)} ilan` }),
      el('p', { class: 'lead-caption', text: `${formatNumber(withDetail)} ilanın tüm detayı var` })
    ]),
    el('button', {
      class: 'btn btn-primary btn-large', type: 'button', icon: 'download', text: 'Tüm sepeti CSV indir',
      onclick: () => {
        downloadCsv(recordsToRows(records, hiddenColumns, context), `sahibinden_sepet_${todayIso()}.csv`);
        basketMessage(`${records.length} ilan indirildi.`);
      }
    }),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn btn-grow', type: 'button', icon: 'open', text: 'Çalışma alanı', onclick: openWorkspace }),
      el('button', {
        class: 'btn', type: 'button', icon: 'braces', text: 'JSON',
        onclick: () => {
          downloadJson(records, `sahibinden_sepet_${todayIso()}.json`);
          basketMessage('JSON indirildi.');
        }
      })
    ])
  ]);

  const statsHolder = el('div');
  renderStats(statsHolder, records);
  const rowsHost = el('div', { class: 'row-list' });
  const selectHost = el('div');
  const moreHost = el('div', { style: 'margin-top: 8px' });
  const drawRows = () => {
    const shown = visibleBasket(records);
    rowsHost.replaceChildren(...shown.slice(0, app.basketShown).map((record) => basketCard(record, drawRows)));
    if (shown.length === 0) rowsHost.appendChild(el('p', { class: 'small muted', style: 'padding: 12px 0', text: 'Aramana uyan ilan yok.' }));
    moreHost.replaceChildren(...(shown.length > app.basketShown ? [el('button', {
      class: 'btn', type: 'button', text: `Daha fazla göster (${formatNumber(shown.length - app.basketShown)} ilan kaldı)`,
      onclick: () => {
        app.basketShown += 50;
        drawRows();
      }
    })] : []));
    selectHost.replaceChildren(selectBar(shown, records, hiddenColumns, context, drawRows));
  };
  drawRows();

  const search = el('input', { type: 'search', placeholder: 'Başlık, no, konum, özellik', 'aria-label': 'Sepette ara' });
  search.value = app.basketFilters.search;
  search.addEventListener('input', () => {
    app.basketFilters.search = search.value;
    app.basketShown = 50;
    drawRows();
  });
  const sort = el('select', { 'aria-label': 'Sırala' }, [
    ['newest', 'Son eklenen'], ['priceUp', 'Fiyat artan'], ['priceDown', 'Fiyat azalan'], ['unitUp', 'Fiyat/m² artan'], ['date', 'İlan tarihi'], ['title', 'Başlık']
  ].map(([value, text]) => el('option', { value, text })));
  sort.value = Object.keys(BASKET_SORTS).find((key) => BASKET_SORTS[key][0] === app.basketFilters.sortBy && BASKET_SORTS[key][1] === app.basketFilters.descending) || 'newest';
  sort.addEventListener('change', () => {
    [app.basketFilters.sortBy, app.basketFilters.descending] = BASKET_SORTS[sort.value];
    drawRows();
  });

  const kinds = [['', 'Tümü', records.length], ['vehicle', 'Araç'], ['emlak', 'Emlak'], ['other', 'Diğer']]
    .map(([id, label, total]) => [id, label, total === undefined ? records.filter((record) => recordKind(record) === id).length : total])
    .filter(([id, , total]) => id === '' || total > 0);
  if (!kinds.some(([id]) => id === app.basketFilters.kind)) app.basketFilters.kind = '';
  const kindChips = el('div', { class: 'chip-row', role: 'group', 'aria-label': 'İlan türü', style: 'margin-bottom: 8px' }, kinds.map(([id, label, total]) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(app.basketFilters.kind === id),
    onclick: () => {
      app.basketFilters.kind = id;
      app.basketShown = 50;
      renderBasket();
    }
  }, [el('span', { text: label }), el('span', { class: 'chip-count num', text: formatNumber(total) })])));

  const fold = (title, content) => {
    const details = el('details', { class: 'fold' }, [el('summary', { text: title }), content]);
    if (app.openFolds.has(title)) details.open = true;
    details.addEventListener('toggle', () => {
      if (details.open) app.openFolds.add(title);
      else app.openFolds.delete(title);
    });
    return el('section', { class: 'card', style: 'padding-top: 4px; padding-bottom: 4px' }, details);
  };

  board.replaceChildren(...[
    summary,
    statsHolder.childElementCount > 0 ? fold('Sepetin özeti', statsHolder) : null,
    el('section', { class: 'card' }, [
      el('div', { class: 'list-tools' }, [search, sort]),
      kindChips,
      selectHost,
      rowsHost,
      moreHost
    ]),
    fold('CSV sütunları', renderColumnPicker(records, context, hiddenColumns, app.features, '', () => {})),
    app.features.backup ? fold('Yedekle ve geri yükle', renderBackupBlock('', basketMessage)) : null,
    savedSearchesFold(savedSearches),
    clearBasketBlock(records)
  ].filter(Boolean));
  $('basket-tab').scrollTop = scroll;
}

function selectBar(shown, records, hiddenColumns, context, redraw) {
  const chosenShown = shown.filter((record) => app.basketSelected.has(record.id)).length;
  const box = el('input', { type: 'checkbox', id: 'basketSelectAll' });
  box.checked = shown.length > 0 && chosenShown === shown.length;
  box.indeterminate = chosenShown > 0 && chosenShown < shown.length;
  box.addEventListener('change', () => {
    shown.forEach((record) => {
      if (box.checked) app.basketSelected.add(record.id);
      else app.basketSelected.delete(record.id);
    });
    redraw();
  });
  const selected = records.filter((record) => app.basketSelected.has(record.id));
  const count = selected.length;
  return el('div', { class: 'select-bar' }, [
    el('label', { class: 'select-all' }, [box, el('span', { text: count > 0 ? `${formatNumber(count)} seçili` : `Tümünü seç (${formatNumber(shown.length)})` })]),
    count > 0 ? el('div', { class: 'btn-row' }, [
      el('button', {
        class: 'btn', type: 'button', icon: 'download', text: 'CSV',
        onclick: () => {
          downloadCsv(recordsToRows(selected, hiddenColumns, context), `sahibinden_secilen_${todayIso()}.csv`);
          basketMessage(`${count} ilan indirildi.`);
        }
      }),
      el('button', {
        class: 'btn', type: 'button', icon: 'compare', text: 'Karşılaştır', disabled: count < 2,
        title: count < 2 ? 'En az 2 ilan seç' : '',
        onclick: () => chrome.tabs.create({ url: `compare.html#${selected.map((record) => record.id).join(',')}` })
      }),
      el('button', {
        class: 'btn btn-danger', type: 'button', icon: 'trash', text: 'Sil',
        onclick: async () => {
          await chrome.runtime.sendMessage({ action: 'basket-remove', data: { ids: selected.map((record) => record.id) } });
          app.basketSelected.clear();
          basketMessage(`${count} ilan sepetten silindi.`);
        }
      })
    ]) : null
  ]);
}

function basketCard(record, redraw) {
  const fields = record.fields || {};
  const kind = recordKind(record);
  const isOpen = app.basketExpanded.has(record.id);
  const specs = kind === 'vehicle' ? vehicleSpecs(record) : kind === 'emlak' ? emlakSpecs(record) : [['Konum', recordPlace(record)], ['İlan Tarihi', record.dateRaw]].filter(([, value]) => value);
  const facts = kind === 'vehicle' ? vehicleFacts(record, Date.now()) : kind === 'emlak' ? emlakFacts(record, Date.now()) : [];
  const box = el('input', { type: 'checkbox', 'aria-label': `${record.title} seç` });
  box.checked = app.basketSelected.has(record.id);
  box.addEventListener('change', () => {
    if (box.checked) app.basketSelected.add(record.id);
    else app.basketSelected.delete(record.id);
    redraw();
  });
  const parcel = parcelFromFields(fields);
  const place = { il: fields['İl'], ilce: fields['İlçe'], mahalle: fields['Mahalle'] };
  const mileage = vehicleMileage(record, Date.now());
  const holder = el('div', { class: 'list-row' }, el('div', { class: 'card-row-main basket-card-main' }, [
    box,
    record.image ? el('img', { class: 'card-thumb', src: record.image, alt: '', loading: 'lazy' }) : el('div', { class: 'card-thumb' }),
    el('div', { style: 'min-width: 0' }, [
      el('a', { class: 'list-title', href: record.url, target: '_blank', rel: 'noopener', text: record.title, title: record.title }),
      el('div', { class: 'list-price', text: formatPrice(record.price) }),
      renderSpecs(specs),
      mileage ? el('div', { class: 'list-meta', style: 'margin-top: 4px', text: mileage.sentence }) : null,
      kind === 'vehicle' ? el('div', { style: 'margin-top: 4px' }, renderDamageChips(record)) : null
    ]),
    expandButton(isOpen, () => {
      if (isOpen) app.basketExpanded.delete(record.id);
      else app.basketExpanded.add(record.id);
      redraw();
    })
  ]));
  if (isOpen) {
    holder.appendChild(el('div', { class: 'list-row-detail' }, [
      renderPhotoBlock(record, basketMessage),
      factsCard('Kesin bilgiler', facts),
      kind === 'vehicle' ? renderVehicleReport(record, app.terms) : null,
      descriptionOrRead(record, basketMessage),
      app.features.tkgm && parcel && place.il && place.ilce && place.mahalle ? el('button', {
        class: 'btn', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç',
        onclick: () => openTkgmParcel(place, parcel, basketMessage)
      }) : null,
      renderPhones(record),
      app.features.notesTags ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Notların' }), renderNoteEditor(record.id)]) : null,
      kind === 'vehicle' ? renderTechnical(record, app.openFolds) : null,
      el('button', {
        class: 'btn btn-danger', type: 'button', icon: 'trash', text: 'Sepetten sil',
        onclick: () => chrome.runtime.sendMessage({ action: 'basket-remove', data: { ids: [record.id] } })
      })
    ].filter(Boolean)));
  }
  return holder;
}

function savedSearchesFold(savedSearches) {
  const entries = Object.entries(savedSearches);
  if (!app.features.snapshots || entries.length === 0) return el('div', { hidden: true });
  return el('section', { class: 'card' }, [
    el('h2', { class: 'card-title', text: 'Kayıtlı aramalar' }),
    el('div', {}, entries.map(([key, search]) => el('div', { class: 'series-row' }, [
      el('div', { style: 'min-width: 0' }, [
        el('a', { href: search.url, target: '_blank', rel: 'noopener', text: (search.category || []).join(' › ') || search.url }),
        el('div', { class: 'muted', text: `${Object.keys(search.listings).length} ilan${search.lastDiff ? `, ${search.lastDiff.added.length} yeni, ${search.lastDiff.priceChanged.length} fiyatı değişen` : ''}` })
      ]),
      el('button', {
        class: 'btn-link', type: 'button', text: 'Sil',
        onclick: async () => {
          const { savedSearches: latest = {} } = await chrome.storage.local.get('savedSearches');
          delete latest[key];
          await chrome.storage.local.set({ savedSearches: latest });
        }
      })
    ])))
  ]);
}

/** Asks here in the panel: a native dialog can close the small window and lose the answer */
function clearBasketBlock(records) {
  const block = el('section', { class: 'card' }, [
    el('button', {
      class: 'btn btn-danger', type: 'button', icon: 'trash', text: 'Sepeti temizle',
      onclick: () => {
        app.clearAsked = true;
        renderBasket();
      }
    })
  ]);
  if (app.clearAsked) {
    block.appendChild(el('div', { class: 'confirm-box' }, [
      el('div', { class: 'notice', icon: 'alert' }, el('span', { text: `Sepetteki ${formatNumber(records.length)} ilan bu tarayıcıdan silinir, geri alınamaz. Notların ve kayıtlı aramaların kalır.` })),
      el('div', { class: 'btn-row' }, [
        el('button', {
          class: 'btn btn-primary', type: 'button', text: 'Evet, sepeti temizle',
          onclick: async () => {
            app.clearAsked = false;
            app.basketSelected.clear();
            await chrome.runtime.sendMessage({ action: 'basket-clear' });
            basketMessage('Sepet temizlendi.');
          }
        }),
        el('button', {
          class: 'btn', type: 'button', text: 'Vazgeç',
          onclick: () => {
            app.clearAsked = false;
            renderBasket();
          }
        })
      ])
    ]));
  }
  return block;
}

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
