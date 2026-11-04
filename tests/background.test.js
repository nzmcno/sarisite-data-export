// Run with: node --test tests/
// Loads the real service worker against a fake browser to prove the safety rules hold.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadWorker(initial) {
  const local = { ...(initial && initial.local) };
  const session = { ...(initial && initial.session) };
  const log = { scripts: [], fetches: [], alarms: [], notifications: [], downloads: [] };
  const listeners = { message: null, tabUpdated: null };
  const area = (store) => ({
    get: async (keys) => {
      const result = {};
      [].concat(keys).forEach((key) => { if (store[key] !== undefined) result[key] = JSON.parse(JSON.stringify(store[key])); });
      return result;
    },
    set: async (values) => { Object.assign(store, JSON.parse(JSON.stringify(values))); }
  });
  const responses = { queue: [] };
  const chrome = {
    runtime: {
      onInstalled: { addListener: (fn) => { listeners.installed = fn; } },
      onStartup: { addListener() {} },
      onMessage: { addListener: (fn) => { listeners.message = fn; } }
    },
    storage: { local: area(local), session: area(session), onChanged: { addListener: (fn) => { listeners.storageChanged = fn; } } },
    action: { setPopup: async (options) => { log.popup = options.popup; } },
    tabs: {
      onUpdated: { addListener: (fn) => { listeners.tabUpdated = fn; } },
      query: async () => (initial && initial.openTabs) || []
    },
    downloads: { download: async (options) => { log.downloads.push(options); return 1; } },
    scripting: {
      executeScript: async (options) => {
        if (options.files) return [];
        log.scripts.push(options.args[0]);
        return [{ result: responses.queue.length ? responses.queue.shift() : { pageType: 'other' } }];
      }
    }
  };
  chrome.alarms = {
    onAlarm: { addListener() {} },
    create: (name) => log.alarms.push(`create:${name}`),
    clear: async (name) => log.alarms.push(`clear:${name}`)
  };
  chrome.sidePanel = {
    setOptions: async (options) => { log.sidePanel = options; },
    setPanelBehavior: async (options) => { log.panelOnClick = options.openPanelOnActionClick; }
  };
  const sandbox = {
    chrome,
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn) => setImmediate(fn),
    clearTimeout() {},
    AbortController,
    URL,
    fetch: async (url) => {
      log.fetches.push(url);
      const body = initial && initial.fetchBodies && initial.fetchBodies(url);
      if (!body) throw new Error('offline');
      return { ok: true, json: async () => body };
    },
    importScripts: (...files) => {
      files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox));
    }
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), sandbox);
  const send = (action, data) => new Promise((resolve) => {
    listeners.message({ action, data }, {}, (result) => resolve(JSON.parse(JSON.stringify(result))));
  });
  const settle = async () => {
    for (let index = 0; index < 400; index += 1) await new Promise((resolve) => setImmediate(resolve));
  };
  return { send, settle, log, local, session, listeners, responses, sandbox };
}

const listings = (count) => Array.from({ length: count }, (_, index) => ({ id: String(index + 1), url: `https://www.sahibinden.com/ilan/x-${index + 1}/detay` }));
const goodListing = (id) => ({
  status: 'ok',
  listing: {
    id, url: `https://www.sahibinden.com/ilan/x-${id}/detay`, title: 'T', price: { amount: 5, currency: 'TL', raw: '' }, dateRaw: '', dateIso: '',
    category: [], location: { raw: '', il: '', ilce: '', mahalle: '' }, attributes: {}, features: {}, damage: null, description: '', photos: [], lat: '', lon: '', hasVideo: false
  }
});
const session = (features) => ({ session: { sessionFeatures: features } });

test('with default settings no tool sends a request or reads a page', async () => {
  const worker = loadWorker();
  assert.strictEqual((await worker.send('rates-get', {})).status, 'off');
  for (const [action, data] of [
    ['enrich-start', { tabId: 1, listings: listings(3) }],
    ['paginate-start', { tabId: 1, page: { url: 'https://www.sahibinden.com/a', rows: [{}], total: 50 } }],
    ['history-start', { tabId: 1, ids: ['1'] }]
  ]) {
    const result = await worker.send(action, data);
    assert.strictEqual(result.status, 'error', action);
    assert.match(result.error, /kapalı/);
  }
  await worker.listeners.tabUpdated(1, { status: 'complete' }, { url: 'https://www.sahibinden.com/ilan/x-1/detay' });
  await worker.settle();
  assert.deepStrictEqual(worker.log.scripts, []);
  assert.deepStrictEqual(worker.log.fetches, []);
  assert.strictEqual(worker.local.basket, undefined);
});

test('turning on a feature in storage as a string does not count', async () => {
  const worker = loadWorker({ local: { features: { liveRates: 'true' } } });
  assert.strictEqual((await worker.send('rates-get', {})).status, 'off');
  assert.deepStrictEqual(worker.log.fetches, []);
});

test('session-only tools ignore a value saved in permanent storage', async () => {
  const worker = loadWorker({ local: { features: { readWithoutOpening: true } } });
  assert.strictEqual((await worker.send('enrich-start', { tabId: 1, listings: listings(1) })).status, 'error');
  assert.deepStrictEqual(worker.log.scripts, []);
});

test('the reader caps a run and saves what it reads', async () => {
  const worker = loadWorker(session({ readWithoutOpening: true }));
  worker.responses.queue = Array.from({ length: 20 }, (_, index) => goodListing(String(index + 1)));
  assert.strictEqual((await worker.send('enrich-start', { tabId: 1, listings: listings(20) })).total, 10);
  await worker.settle();
  assert.strictEqual(worker.log.scripts.length, 10);
  assert.strictEqual(Object.keys(worker.local.basket).length, 10);
  assert.strictEqual(worker.local.guardedState.dayCount, 10);
});

for (const [name, failure] of [
  ['a verification page', { status: 'blocked' }],
  ['an HTTP error', { status: 'http', code: 403 }],
  ['an unexpected page', { status: 'unexpected' }]
]) {
  test(`${name} stops the run at once and starts the cooldown`, async () => {
    const worker = loadWorker(session({ readWithoutOpening: true }));
    worker.responses.queue = [goodListing('1'), failure, goodListing('3')];
    await worker.send('enrich-start', { tabId: 1, listings: listings(5) });
    await worker.settle();
    assert.strictEqual(worker.log.scripts.length, 2);
    assert.ok(worker.local.guardedState.cooldownUntil > Date.now());
    const retry = await worker.send('enrich-start', { tabId: 1, listings: listings(5) });
    assert.strictEqual(retry.status, 'error');
    assert.match(retry.error, /bekleme/i);
    await worker.settle();
    assert.strictEqual(worker.log.scripts.length, 2);
  });
}

test('the daily budget is shared and enforced', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const worker = loadWorker({
    ...session({ readWithoutOpening: true, autoPagination: true }),
    local: { guardedState: { day: today, dayCount: 49 } }
  });
  worker.responses.queue = [goodListing('1'), goodListing('2')];
  await worker.send('enrich-start', { tabId: 1, listings: listings(5) });
  await worker.settle();
  assert.strictEqual(worker.log.scripts.length, 1);
  const next = await worker.send('paginate-start', { tabId: 1, page: { url: 'https://www.sahibinden.com/a', rows: [{}], total: 50 } });
  assert.strictEqual(next.status, 'error');
  assert.match(next.error, /Günlük/);
});

test('browsing capture reads only pages of the switched-on kind and only on sahibinden', async () => {
  const worker = loadWorker({ local: { features: { autoSaveListings: true } } });
  worker.responses.queue = [
    { pageType: 'list', rows: [{ id: '9', title: 'x', price: {}, cells: [] }], url: 'u' },
    goodListing('7').listing && { pageType: 'detail', url: 'u', listing: goodListing('7').listing }
  ];
  await worker.listeners.tabUpdated(1, { status: 'complete' }, { url: 'https://example.com/' });
  await worker.settle();
  assert.strictEqual(worker.log.scripts.length, 0);
  await worker.listeners.tabUpdated(1, { status: 'complete' }, { url: 'https://www.sahibinden.com/otomobil' });
  await worker.listeners.tabUpdated(1, { status: 'complete' }, { url: 'https://www.sahibinden.com/ilan/x-7/detay' });
  await worker.settle();
  assert.deepStrictEqual(Object.keys(worker.local.basket), ['7']);
});

test('rates fall back to the cached value and say it is stale', async () => {
  const cached = { USD: 50, EUR: 56, GBP: 67, GRA: 6300, source: 'S', fetchedAt: Date.now() - 3600000 };
  const worker = loadWorker({ local: { features: { liveRates: true }, ratesCache: cached } });
  const result = await worker.send('rates-get', { force: true });
  assert.strictEqual(result.status, 'stale');
  assert.strictEqual(result.rates.USD, 50);
});

test('rate requests never reach the listing site', async () => {
  const worker = loadWorker({ local: { features: { liveRates: true } } });
  await worker.send('rates-get', { force: true });
  assert.ok(worker.log.fetches.length > 0);
  worker.log.fetches.forEach((url) => assert.ok(!url.includes('sahibinden'), url));
});

test('the saved search alarm is created only when its switch is on', async () => {
  const off = loadWorker();
  await off.send('features-changed', {});
  assert.deepStrictEqual(off.log.alarms, ['clear:saved-search-check']);
  const on = loadWorker({ local: { features: { savedSearchCheck: true } } });
  await on.send('features-changed', {});
  assert.deepStrictEqual(on.log.alarms, ['create:saved-search-check']);
});

test('the icon opens the side panel until the small window is chosen', async () => {
  const panel = loadWorker();
  panel.listeners.installed();
  await panel.settle();
  assert.strictEqual(panel.log.popup, '');
  assert.strictEqual(panel.log.panelOnClick, true);
  assert.strictEqual(panel.log.sidePanel.path, 'popup.html');
  assert.strictEqual(panel.log.sidePanel.enabled, true);
  const small = loadWorker({ local: { actionSurface: 'popup' } });
  small.listeners.installed();
  await small.settle();
  assert.strictEqual(small.log.popup, 'popup.html');
  assert.strictEqual(small.log.panelOnClick, false);
});

test('images download one at a time', async () => {
  const worker = loadWorker();
  const images = [1, 2, 3].map((index) => ({ url: `https://i/${index}.jpg`, filename: `a_${index}`, type: 'jpg' }));
  assert.strictEqual((await worker.send('download-images', { images, folder: 'sahibinden_1' })).status, 'started');
  await worker.settle();
  assert.deepStrictEqual(worker.log.downloads.map((item) => item.filename), ['sahibinden_1/a_1.jpg', 'sahibinden_1/a_2.jpg', 'sahibinden_1/a_3.jpg']);
});

test('a backup can only be restored with its switch on', async () => {
  const data = { basket: { 1: { id: '1', title: 'A' } }, annotations: {}, savedSearches: {}, hiddenColumns: [] };
  const off = loadWorker();
  assert.strictEqual((await off.send('basket-restore', { data })).status, 'error');
  assert.strictEqual(off.local.basket, undefined);
  const on = loadWorker({ local: { features: { backup: true } } });
  assert.strictEqual((await on.send('basket-restore', { data })).status, 'success');
  assert.strictEqual(on.local.basket['1'].title, 'A');
});

const tkgmBodies = (url) => {
  const list = (items) => ({ features: items.map(([id, text]) => ({ properties: { id, text } })) });
  if (url.endsWith('/ilListe')) return list([[23, 'Adana'], [63, 'Kocaeli']]);
  if (url.endsWith('/ilceListe/63')) return list([[624, 'Gebze']]);
  if (url.endsWith('/mahalleListe/624')) return list([[144617, 'Denizli']]);
  return null;
};
const parcel = { il: 'Kocaeli', ilce: 'Gebze', mahalle: 'Denizli Mh.', ada: '235', parsel: '3' };

test('TKGM link stays off until its switch is on', async () => {
  const worker = loadWorker({ fetchBodies: tkgmBodies });
  assert.strictEqual((await worker.send('tkgm-link', parcel)).status, 'error');
  assert.deepStrictEqual(worker.log.fetches, []);
});

test('TKGM link opens the parcel and reuses the saved lists', async () => {
  const worker = loadWorker({ fetchBodies: tkgmBodies, local: { features: { tkgm: true } } });
  const result = await worker.send('tkgm-link', parcel);
  assert.strictEqual(result.status, 'success');
  assert.match(result.url, /^https:\/\/parselsorgu\.tkgm\.gov\.tr\/#ara\/idari\/144617\/235\/3\/\d+$/);
  assert.strictEqual(worker.log.fetches.length, 3);
  await worker.send('tkgm-link', parcel);
  assert.strictEqual(worker.log.fetches.length, 3);
  worker.log.fetches.forEach((url) => assert.ok(url.includes('tkgm.gov.tr')));
});

test('TKGM link says which name it could not find', async () => {
  const worker = loadWorker({ fetchBodies: tkgmBodies, local: { features: { tkgm: true } } });
  const result = await worker.send('tkgm-link', { ...parcel, mahalle: 'Yok Mah.' });
  assert.strictEqual(result.status, 'not-found');
  assert.match(result.error, /Yok Mah/);
});
