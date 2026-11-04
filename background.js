// background.js - Service Worker for Sahibinden Extension
// Owns anything that must outlive the popup. Every optional branch checks its switch first.

importScripts('features.js', 'lib.js');

const IMAGE_DOWNLOAD_DELAY_MS = 700;

// Limits for every feature that sends the site extra requests. They share one daily budget and one
// cooldown. Fixed on purpose: this limits load and is not a disguise, so there are no random delays.
const REQUEST_DELAY_MS = 8000;
const MAX_LISTINGS_PER_RUN = 10;
const MAX_PAGES_PER_RUN = 5;
const MAX_REQUESTS_PER_DAY = 50;
const COOLDOWN_MS = 60 * 60 * 1000;
const SAVED_SEARCH_ALARM = 'saved-search-check';
const SAVED_SEARCH_PERIOD_MINUTES = 6 * 60;
const MAX_SEARCHES_PER_CHECK = 3;
const RATES_MAX_AGE_MS = 10 * 60 * 1000;
const RATES_TIMEOUT_MS = 8000;
const TKGM_API = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/idariYapi';
const TKGM_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const today = () => new Date().toISOString().slice(0, 10);
const isSahibindenUrl = (url) => /^https?:\/\/([a-z0-9-]+\.)?sahibinden\.com\//i.test(url || '');

/**
 * ============================================================================
 * EXTENSION INSTALLATION
 * ============================================================================
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Sahibinden İlan Veri İndirici extension installed successfully!');
  applyFeatureEffects();
});

/**
 * ============================================================================
 * MESSAGE HANDLER
 * ============================================================================
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    'download-images': handleImageDownload,
    'basket-add-page': handleBasketAddPage,
    'basket-remove': handleBasketRemove,
    'basket-clear': handleBasketClear,
    'basket-restore': handleBasketRestore,
    'rates-get': handleRatesGet,
    'tkgm-link': handleTkgmLink,
    'guarded-status': handleGuardedStatus,
    'guarded-stop': handleGuardedStop,
    'enrich-start': handleEnrichStart,
    'paginate-start': handlePaginateStart,
    'history-start': handleHistoryStart,
    'features-changed': handleFeaturesChanged
  };
  const handler = handlers[message.action];
  if (!handler) return false;
  handler(message.data || {})
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ status: 'error', error: error.message }));

  // Return true to indicate async response
  return true;
});

/**
 * ============================================================================
 * BASKET STORAGE
 * ============================================================================
 * All writes go through one queue so the popup and background runs can't overwrite each other
 */
let basketQueue = Promise.resolve();

function updateBasket(change) {
  const run = basketQueue.then(async () => {
    const { basket = {} } = await chrome.storage.local.get('basket');
    const result = change(basket);
    await chrome.storage.local.set({ basket });
    return result;
  });
  basketQueue = run.catch(() => {});
  return run;
}

async function handleBasketAddPage({ page }) {
  const counts = await updateBasket((basket) => mergePage(basket, page, new Date().toISOString()));
  return { status: 'success', counts };
}

async function handleBasketRemove({ ids }) {
  await updateBasket((basket) => {
    ids.forEach((id) => { delete basket[id]; });
  });
  return { status: 'success' };
}

async function handleBasketClear() {
  await updateBasket((basket) => {
    Object.keys(basket).forEach((id) => { delete basket[id]; });
  });
  return { status: 'success' };
}

/** Restore adds to what's there and only replaces a listing with the backup's copy of it */
async function handleBasketRestore({ data }) {
  const { features } = await chrome.storage.local.get('features');
  if (!normalizeFeatures(features).backup) return { status: 'error', error: 'Yedekleme kapalı.' };
  await updateBasket((basket) => { Object.assign(basket, data.basket); });
  const { annotations = {}, savedSearches = {} } = await chrome.storage.local.get(['annotations', 'savedSearches']);
  await chrome.storage.local.set({
    annotations: { ...annotations, ...data.annotations },
    savedSearches: { ...savedSearches, ...data.savedSearches },
    hiddenColumns: data.hiddenColumns,
    vehicleTerms: data.vehicleTerms
  });
  return { status: 'success' };
}

/**
 * ============================================================================
 * IMAGE DOWNLOADS
 * ============================================================================
 * One file at a time, so a big gallery doesn't turn into a burst of requests.
 * Runs here because the popup can close at any moment.
 */
let imageRunActive = false;

async function handleImageDownload({ images, folder }) {
  if (!images || images.length === 0) {
    return { status: 'error', error: 'No images to download' };
  }
  if (imageRunActive) {
    return { status: 'error', error: 'busy' };
  }
  imageRunActive = true;
  runImageDownloads(images, folder).finally(() => { imageRunActive = false; });
  return { status: 'started', totalImages: images.length };
}

async function runImageDownloads(images, folder) {
  let successCount = 0;
  let errorCount = 0;
  const total = images.length;
  const stamp = Math.floor(Date.now() / 1000);

  for (let index = 0; index < total; index += 1) {
    const image = images[index];
    const extension = image.type && image.type !== 'unknown' ? image.type : 'jpg';
    const name = image.filename ? safeFilePart(image.filename) : `${stamp}_${index}`;
    try {
      await chrome.downloads.download({
        url: image.url,
        filename: `${safeFilePart(folder)}/${name}.${extension}`,
        conflictAction: 'uniquify',
        saveAs: false
      });
      successCount += 1;
    } catch (error) {
      errorCount += 1;
      console.error('Download failed:', error);
    }
    await chrome.storage.local.set({ imageProgress: { done: index + 1, total, successCount, errorCount } });
    if (index + 1 < total) await wait(IMAGE_DOWNLOAD_DELAY_MS);
  }
}

/**
 * ============================================================================
 * LIVE EXCHANGE RATES
 * ============================================================================
 * These requests go to the rate services only and carry no listing or browsing data.
 */
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RATES_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveRates() {
  try {
    const rates = parseTruncgilRates(await fetchJson('https://finans.truncgil.com/v4/today.json'));
    if (rates) return rates;
  } catch (error) {
    console.warn('Primary rate source failed:', error.message);
  }
  const [currencies, gold] = await Promise.all([
    fetchJson('https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR,GBP'),
    fetchJson('https://api.gold-api.com/price/XAU')
  ]);
  return parseFallbackRates(currencies, gold);
}

async function handleRatesGet({ force }) {
  const features = await loadFeatures();
  if (!features.liveRates) return { status: 'off' };
  const { ratesCache } = await chrome.storage.local.get('ratesCache');
  const age = ratesCache ? Date.now() - ratesCache.fetchedAt : Infinity;
  if (!force && age < RATES_MAX_AGE_MS) return { status: 'success', rates: ratesCache };
  try {
    const rates = await fetchLiveRates();
    if (!rates) throw new Error('Kur verisi okunamadı');
    const fresh = { ...rates, fetchedAt: Date.now() };
    await chrome.storage.local.set({ ratesCache: fresh });
    return { status: 'success', rates: fresh };
  } catch (error) {
    // An old rate is still useful as long as the screen says how old it is
    return ratesCache
      ? { status: 'stale', rates: ratesCache, error: error.message }
      : { status: 'error', error: error.message };
  }
}

/**
 * ============================================================================
 * TKGM PARCEL LINK
 * ============================================================================
 * Only place names go to TKGM, to find the neighbourhood code. The lists rarely change, so they are kept.
 */
async function tkgmList(path) {
  const { tkgmCache = {} } = await chrome.storage.local.get('tkgmCache');
  const cached = tkgmCache[path];
  if (cached && Date.now() - cached.at < TKGM_CACHE_MS) return cached.items;
  const items = parseAdminList(await fetchJson(`${TKGM_API}/${path}`));
  tkgmCache[path] = { at: Date.now(), items };
  await chrome.storage.local.set({ tkgmCache });
  return items;
}

async function handleTkgmLink({ il, ilce, mahalle, ada, parsel }) {
  const features = await loadFeatures();
  if (!features.tkgm) return { status: 'error', error: 'TKGM kısayolu kapalı.' };
  const cityId = findAdminId(await tkgmList('ilListe'), il);
  if (!cityId) return { status: 'not-found', error: `TKGM'de "${il}" ili bulunamadı.` };
  const districtId = findAdminId(await tkgmList(`ilceListe/${cityId}`), ilce);
  if (!districtId) return { status: 'not-found', error: `TKGM'de "${ilce}" ilçesi bulunamadı.` };
  const neighbourhoodId = findAdminId(await tkgmList(`mahalleListe/${districtId}`), mahalle);
  if (!neighbourhoodId) return { status: 'not-found', error: `TKGM'de "${mahalle}" mahallesi bulunamadı.` };
  return { status: 'success', url: tkgmParcelUrl(neighbourhoodId, ada, parsel, Date.now()) };
}

/**
 * ============================================================================
 * EXTRA-REQUEST TOOLS (HIGH RISK, OFF BY DEFAULT)
 * ============================================================================
 * Started only by the user or by their saved-search alarm. The first sign of trouble stops the run
 * and starts a cooldown. Nothing here retries, solves a challenge or hides itself.
 */
let guardedRun = null;

async function setGuardedState(patch) {
  const { guardedState = {} } = await chrome.storage.local.get('guardedState');
  await chrome.storage.local.set({ guardedState: { ...guardedState, ...patch } });
}

async function handleGuardedStatus() {
  const { guardedState = {} } = await chrome.storage.local.get('guardedState');
  return {
    running: !!guardedRun,
    label: guardedRun ? guardedRun.label : guardedState.label || '',
    usedToday: guardedState.day === today() ? guardedState.dayCount || 0 : 0,
    maxPerDay: MAX_REQUESTS_PER_DAY,
    maxListingsPerRun: MAX_LISTINGS_PER_RUN,
    maxPagesPerRun: MAX_PAGES_PER_RUN,
    delaySeconds: REQUEST_DELAY_MS / 1000,
    cooldownUntil: guardedState.cooldownUntil || 0,
    lastMessage: guardedState.lastMessage || '',
    done: guardedRun ? guardedRun.done : guardedState.done || 0,
    total: guardedRun ? guardedRun.total : guardedState.total || 0
  };
}

async function handleGuardedStop() {
  if (guardedRun) guardedRun.stop = true;
  return { status: 'success' };
}

/** Why a request can't go out right now, or an empty string when it can */
async function guardedBlockReason() {
  if (guardedRun) return 'Başka bir işlem çalışıyor.';
  const status = await handleGuardedStatus();
  if (status.cooldownUntil > Date.now()) return 'Site uyarı verdiği için bekleme süresi dolmadı.';
  if (status.usedToday >= MAX_REQUESTS_PER_DAY) return 'Günlük sınıra ulaşıldı.';
  return '';
}

function describeFailure(result) {
  if (result && result.status === 'blocked') return 'Site doğrulama sayfası gösterdi.';
  if (result && result.status === 'http') return `Site ${result.code} hatası döndürdü.`;
  return 'Beklenmeyen bir yanıt geldi.';
}

/** Runs one request per item, spaced out, and stops for good on the first failure */
async function runGuarded(label, items, work) {
  const status = await handleGuardedStatus();
  const queue = items.slice(0, Math.max(0, MAX_REQUESTS_PER_DAY - status.usedToday));
  let dayCount = status.usedToday;
  guardedRun = { label, stop: false, done: 0, total: queue.length };
  await setGuardedState({ label, done: 0, total: queue.length, lastMessage: '' });

  const finish = async (lastMessage, cooldown) => {
    await setGuardedState({
      lastMessage,
      done: guardedRun.done,
      cooldownUntil: cooldown ? Date.now() + COOLDOWN_MS : 0
    });
    guardedRun = null;
  };

  for (let index = 0; index < queue.length; index += 1) {
    if (guardedRun.stop) {
      await finish(`Durduruldu: ${guardedRun.done}/${queue.length} tamamlandı.`, false);
      return;
    }
    dayCount += 1;
    await setGuardedState({ day: today(), dayCount });
    let result;
    try {
      result = await work(queue[index]);
    } catch (error) {
      await finish('Sekmeye ulaşılamadı, durduruldu.', false);
      return;
    }
    if (!result || result.status !== 'ok') {
      await finish(`${describeFailure(result)} Durduruldu, 1 saat beklenecek. Hesabını siteden kontrol et.`, true);
      return;
    }
    guardedRun.done += 1;
    await setGuardedState({ done: guardedRun.done });
    if (index + 1 < queue.length) await wait(REQUEST_DELAY_MS);
  }
  await finish(`Tamamlandı: ${guardedRun.done}/${queue.length}.`, false);
}

async function startGuarded(featureId, label, items, work) {
  const features = await loadFeatures();
  if (!features[featureId]) return { status: 'error', error: 'Bu özellik kapalı.' };
  const reason = await guardedBlockReason();
  if (reason) return { status: 'error', error: reason };
  if (items.length === 0) return { status: 'error', error: 'Okunacak bir şey yok.' };
  runGuarded(label, items, work);
  return { status: 'started', total: items.length };
}

function handleEnrichStart({ tabId, listings }) {
  return startGuarded('readWithoutOpening', 'İlanı açmadan oku', listings.slice(0, MAX_LISTINGS_PER_RUN), async (listing) => {
    const result = await runInTab(tabId, 'fetchListingInPage', [listing.url]);
    if (result && result.status === 'ok') {
      await updateBasket((basket) => mergeRecord(basket, detailToRecord(result.listing), new Date().toISOString()));
    }
    return result;
  });
}

function handlePaginateStart({ tabId, page }) {
  return startGuarded('autoPagination', 'Sonraki sayfaları oku', nextPageUrls(page, MAX_PAGES_PER_RUN), async (url) => {
    const result = await runInTab(tabId, 'fetchListPageInPage', [url]);
    if (result && result.status === 'ok') {
      await updateBasket((basket) => mergePage(basket, result.page, new Date().toISOString()));
    }
    return result;
  });
}

function handleHistoryStart({ tabId, ids }) {
  return startGuarded('bulkPriceHistory', 'Toplu fiyat geçmişi', ids.slice(0, MAX_LISTINGS_PER_RUN), async (id) => {
    const result = await runInTab(tabId, 'fetchPriceHistoryInPage', [id]);
    if (result && result.status === 'ok') {
      await updateBasket((basket) => {
        if (basket[id]) basket[id].remoteHistory = result.history;
      });
    }
    return result;
  });
}

/**
 * ============================================================================
 * SAVED SEARCH CHECK (HIGH RISK, OFF BY DEFAULT)
 * ============================================================================
 * Only reads through a sahibinden tab you already have open. With no such tab it does nothing.
 */
async function runSavedSearchCheck() {
  const features = await loadFeatures();
  if (!features.savedSearchCheck || !features.snapshots) return;
  if (await guardedBlockReason()) return;

  const tabs = await chrome.tabs.query({ url: '*://*.sahibinden.com/*' });
  const tab = tabs.find((candidate) => candidate.status === 'complete');
  if (!tab) return;

  const { savedSearches = {} } = await chrome.storage.local.get('savedSearches');
  const keys = Object.keys(savedSearches)
    .sort((a, b) => (savedSearches[a].savedAt || '').localeCompare(savedSearches[b].savedAt || ''))
    .slice(0, MAX_SEARCHES_PER_CHECK);
  if (keys.length === 0) return;

  let newCount = 0;
  let cheaperCount = 0;
  await runGuarded('Kayıtlı arama kontrolü', keys, async (key) => {
    const result = await runInTab(tab.id, 'fetchListPageInPage', [savedSearches[key].url]);
    if (result && result.status === 'ok') {
      const current = snapshotFromPage(result.page, new Date().toISOString());
      const diff = diffSnapshots(savedSearches[key], current);
      newCount += diff.added.length;
      cheaperCount += diff.priceChanged.filter((item) => item.amount < item.previousAmount).length;
      const { savedSearches: latest = {} } = await chrome.storage.local.get('savedSearches');
      latest[key] = { ...current, lastDiff: diff };
      await chrome.storage.local.set({ savedSearches: latest });
    }
    return result;
  });

  if (newCount > 0 || cheaperCount > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Kayıtlı aramalarında değişiklik var',
      message: `${newCount} yeni ilan, ${cheaperCount} fiyat düşüşü`
    });
  }
}

/**
 * ============================================================================
 * FEATURE SWITCH EFFECTS
 * ============================================================================
 */
async function handleFeaturesChanged() {
  await applyFeatureEffects();
  return { status: 'success' };
}

async function applyFeatureEffects() {
  const features = await loadFeatures();
  if (features.savedSearchCheck) {
    chrome.alarms.create(SAVED_SEARCH_ALARM, { periodInMinutes: SAVED_SEARCH_PERIOD_MINUTES });
  } else {
    await chrome.alarms.clear(SAVED_SEARCH_ALARM);
  }
  await chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: features.sidePanel });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SAVED_SEARCH_ALARM) runSavedSearchCheck();
});

/**
 * ============================================================================
 * SAVE WHAT I BROWSE (MEDIUM RISK, OFF BY DEFAULT)
 * ============================================================================
 * Reads only pages you opened yourself and sends no extra requests
 */
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== 'complete' || !isSahibindenUrl(tab.url)) return;
  const features = await loadFeatures();
  if (!features.autoSaveListings && !features.autoAddPages) return;
  try {
    const page = await runInTab(tabId, 'extractPage');
    const wanted = (page.pageType === 'detail' && features.autoSaveListings)
      || (page.pageType === 'list' && page.rows.length > 0 && features.autoAddPages);
    if (wanted) await handleBasketAddPage({ page });
  } catch (error) {
    console.warn('Could not read the page:', error.message);
  }
});
