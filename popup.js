// popup.js - Sahibinden CSV Exporter popup
// The page is only read (see extractor.js). Files are built here, so nothing is added to the page.

let currentTab = null;
let currentPage = null;
let features = normalizeFeatures({});
let ratesResult = { status: 'off', rates: null };

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function readPage() {
  currentTab = await getActiveTab();
  currentPage = await runInTab(currentTab.id, 'extractPage');
  return currentPage;
}

function pageProblem(page) {
  if (page.pageType === 'blocked') return 'Site doğrulama sayfası gösteriyor. Eklenti bu sayfada çalışmaz. Doğrulamayı sen tamamla, sonra tekrar aç.';
  if (page.pageType === 'other') return 'Burası liste veya ilan sayfası değil. Bir sahibinden arama sonucu ya da ilan aç.';
  if (page.pageType === 'list' && page.rows.length === 0) {
    return 'Tablo var ama ilan satırı yok. Sonuç boş olabilir ya da sitenin yapısı değişmiş olabilir.';
  }
  return '';
}

const pageRecords = (page) => page.rows.map((row) => listRowToRecord(row, page));

/**
 * ============================================================================
 * TAB NAVIGATION AND PAGE STATE
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', async () => {
  hydrateBrand();
  hydrateIcons();
  renderThemePicker($('themePicker'));
  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach((other) => {
        other.classList.toggle('active', other === button);
        other.setAttribute('aria-selected', String(other === button));
      });
      document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
      $(`${button.getAttribute('data-tab')}-tab`).classList.add('active');
    });
  });
  features = await loadFeatures();
  renderFeatureList();
  await refreshPageState();
  renderBasket();
  refreshGuarded();
  refreshRates(false);
  onFeaturesChanged(applyFeatureChange);
});

/** A switch changed here or in the workspace: redraw everything it affects right away */
async function applyFeatureChange() {
  const before = features;
  features = await loadFeatures();
  renderFeatureList();
  await refreshPageState();
  refreshRates(features.liveRates && !before.liveRates);
  refreshGuarded();
}

let pageRefreshRun = 0;

async function refreshPageState() {
  const run = ++pageRefreshRun;
  const lead = $('pageLead');
  const disable = (disabled) => {
    ['downloadCsvBtn', 'downloadJsonBtn', 'addPageBtn'].forEach((id) => { $(id).disabled = disabled; });
  };
  const clear = () => {
    lead.textContent = '';
    $('pageStats').hidden = true;
    $('pageInsights').hidden = true;
  };
  try {
    const page = await readPage();
    if (run !== pageRefreshRun) return;
    clear();
    const problem = pageProblem(page);
    disable(!!problem);
    if (problem) {
      lead.appendChild(el('div', { class: 'notice', icon: 'alert' }, el('span', { text: problem })));
    } else if (page.pageType === 'detail') {
      const { listing } = page;
      lead.append(
        el('p', { class: 'lead-title', text: listing.title }),
        el('p', { class: 'lead-figure', text: formatPrice(listing.price) }),
        el('p', { class: 'lead-caption', text: `${listing.location.raw} · ${Object.keys(listing.attributes).length} bilgi, ${listing.photos.length} fotoğraf` })
      );
      renderPageInsights(listing);
    } else {
      const records = pageRecords(page);
      const medianPrice = pageMedianPrice(records);
      const scope = page.total ? `Bu sayfada ${page.rows.length} ilan, aramada ${formatNumber(page.total)}` : `Bu sayfada ${page.rows.length} ilan`;
      lead.append(
        el('p', { class: 'lead-title', text: (page.category || []).slice(-3).join(' › ') || 'Arama sonuçları' }),
        medianPrice ? el('p', { class: 'lead-figure', text: formatPrice(medianPrice) }) : null,
        el('p', { class: 'lead-caption', text: medianPrice ? `Medyan fiyat · ${scope}` : scope })
      );
      renderStats($('pageStats'), records);
      $('pageStats').hidden = $('pageStats').childElementCount === 0;
    }
    renderPageTools(page, problem);
  } catch (error) {
    if (run !== pageRefreshRun) return;
    clear();
    disable(true);
    lead.appendChild(el('div', { class: 'notice', icon: 'alert' }, el('span', { text: 'Bu sayfa okunamadı. Sayfayı yenileyip tekrar dene.' })));
    renderPageTools({ pageType: 'other' }, 'unreadable');
  }
}

function renderPageInsights(listing) {
  const holder = $('pageInsights');
  holder.textContent = '';
  const facts = listingInsights(detailToRecord(listing), features, { now: Date.now() });
  holder.hidden = facts.length === 0;
  if (facts.length > 0) holder.append(el('h2', { class: 'card-title', text: 'Bu ilan hakkında' }), renderFacts(facts));
}

function renderPageTools(page, problem) {
  const tools = $('pageTools');
  tools.textContent = '';
  if (features.sidePanel) {
    tools.appendChild(el('button', {
      class: 'btn', type: 'button', icon: 'panel', text: 'Yan panel',
      onclick: () => {
        chrome.sidePanel.open({ windowId: currentTab.windowId });
        window.close();
      }
    }));
  }
  if (problem) return;
  if (features.snapshots && page.pageType === 'list') {
    tools.appendChild(el('button', { class: 'btn', type: 'button', icon: 'bookmark', text: 'Aramayı kaydet', onclick: saveSearch }));
  }
  if (features.tkgm && page.pageType === 'detail') {
    const { attributes, location: place } = page.listing;
    const parcel = parcelFromFields(attributes);
    tools.appendChild(el('button', {
      class: 'btn', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç', disabled: !parcel,
      title: parcel ? `Ada ${parcel.ada}, Parsel ${parcel.parsel}` : 'Bu ilanda ada ve parsel bilgisi yok',
      onclick: () => openTkgmParcel(place, parcel, (text) => { $('pageMessage').textContent = text; })
    }));
  }
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
    $('pageMessage').textContent = diff
      ? `Son kayda göre ${diff.added.length} yeni, ${diff.missing.length} görünmeyen, ${diff.priceChanged.length} fiyatı değişen ilan.`
      : 'Arama kaydedildi. Bir sonraki kayıtta farkları gösterir.';
  } catch (error) {
    $('pageMessage').textContent = 'Arama kaydedilemedi.';
  }
}

/**
 * ============================================================================
 * LIVE RATES
 * ============================================================================
 * The rate services are contacted only while the switch is on
 */
async function refreshRates(force) {
  const enable = $('enableRatesBtn');
  enable.hidden = features.liveRates || features.manualRates || !currentPage || !!pageProblem(currentPage);
  try {
    ratesResult = await loadRates(features, force);
  } catch (error) {
    ratesResult = { status: 'error', rates: null };
  }
  const price = !currentPage || pageProblem(currentPage)
    ? null
    : currentPage.pageType === 'detail'
      ? currentPage.listing.price
      : pageMedianPrice(pageRecords(currentPage));
  const strip = $('pageRates');
  if (price && ratesResult.status !== 'off') renderRatesStrip(strip, price, ratesResult, () => refreshRates(true));
  else strip.textContent = '';
}

$('enableRatesBtn').addEventListener('click', () => setFeature(getFeature('liveRates'), true));

/**
 * ============================================================================
 * CURRENT PAGE EXPORT
 * ============================================================================
 */
async function withFreshPage(action) {
  const message = $('pageMessage');
  try {
    const page = await readPage();
    const problem = pageProblem(page);
    if (problem) {
      message.textContent = problem;
      return;
    }
    await action(page);
  } catch (error) {
    console.error('Error reading page:', error);
    message.textContent = 'Veri okunamadı. Sayfayı yenileyip tekrar dene.';
  }
}

$('downloadCsvBtn').addEventListener('click', () => withFreshPage(async (page) => {
  const context = await exportContext(features, ratesResult.rates);
  const rows = page.pageType === 'list'
    ? listPageToRows(page, context)
    : recordsToRows([{ ...detailToRecord(page.listing), priceHistory: [] }], [], context);
  downloadCsv(rows, exportFileName(page, 'csv', todayIso()));
  $('pageMessage').textContent = page.pageType === 'list' ? `${page.rows.length} ilan indirildi.` : 'İlan indirildi.';
}));

$('downloadJsonBtn').addEventListener('click', () => withFreshPage(async (page) => {
  downloadJson(page, exportFileName(page, 'json', todayIso()));
  $('pageMessage').textContent = 'JSON indirildi.';
}));

$('addPageBtn').addEventListener('click', () => withFreshPage(async (page) => {
  const result = await chrome.runtime.sendMessage({ action: 'basket-add-page', data: { page } });
  if (result.status !== 'success') {
    $('pageMessage').textContent = 'Sepete eklenemedi.';
    return;
  }
  const { counts } = result;
  $('pageMessage').textContent = `Sepet: ${counts.new} yeni, ${counts.updated} güncellendi, ${counts.priceChanged} fiyatı değişti.`;
  renderBasket();
}));

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
  const context = await exportContext(features, ratesResult.rates);
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
    $('emptyState').textContent = 'Bu sayfa taranamadı. Sayfayı yenileyip tekrar dene.';
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

chrome.storage.onChanged.addListener((changes) => {
  if (changes.imageProgress) {
    const { done, total, errorCount } = changes.imageProgress.newValue;
    const errors = errorCount > 0 ? `, ${errorCount} hata` : '';
    $('imageStats').textContent = done === total
      ? `İndirme bitti: ${total - errorCount}/${total}${errors}`
      : `İndiriliyor: ${done}/${total}${errors}. Pencereyi kapatsan da devam eder.`;
  }
  if (changes.basket) renderBasket();
  if (changes.guardedState) refreshGuarded();
});

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
    const tabId = currentTab.id;
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
  const enabled = GUARDED_TOOLS.filter((tool) => features[tool.feature]);
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
  renderFeatureSettings($('featureList'), features, (text) => { $('settingsMessage').textContent = text; });
  const onCount = FEATURES.filter((feature) => features[feature.id]).length;
  const badge = $('featureCount');
  badge.hidden = onCount === 0;
  badge.textContent = String(onCount);
}

$('allOffBtn').addEventListener('click', async () => {
  await resetAllFeatures();
  await chrome.runtime.sendMessage({ action: 'features-changed' });
  $('settingsMessage').textContent = 'Tüm özellikler kapatıldı.';
});
