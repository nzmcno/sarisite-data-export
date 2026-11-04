// sidepanel.js - A live report of the open page, beside it. It reads the page and never changes it.

const panel = {
  run: 0,
  tabId: null,
  url: '',
  page: null,
  features: normalizeFeatures({}),
  basket: {},
  terms: [],
  ratesResult: null,
  search: '',
  sort: 'page',
  expanded: new Set(),
  openFolds: new Set()
};

const QUICK_FACTS = ['Yıl', 'KM', 'Yakıt / Motor Tipi', 'Vites', 'Motor Gücü', 'Renk', 'm² (Brüt)', 'm²', 'Oda Sayısı', 'Bina Yaşı', 'Bulunduğu Kat', 'İmar Durumu'];

function setMessage(text) {
  $('message').textContent = text;
}

/** Re-reads the page only when asked to. A basket or switch change redraws from what was read. */
async function refresh(readAgain) {
  const run = ++panel.run;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(['basket', 'vehicleTerms']);
  const features = await loadFeatures();
  if (run !== panel.run) return;
  panel.features = features;
  panel.basket = stored.basket || {};
  panel.terms = stored.vehicleTerms || [];

  const readable = tab && /^https?:\/\/([a-z0-9-]+\.)?sahibinden\.com\//i.test(tab.url || '') && tab.status === 'complete';
  if (!readable) {
    panel.tabId = null;
    panel.url = '';
    panel.page = null;
  } else if (readAgain || tab.id !== panel.tabId || tab.url !== panel.url || !panel.page) {
    let page = null;
    try {
      page = await runInTab(tab.id, 'extractPage');
    } catch (error) {
      page = { pageType: 'unreadable' };
    }
    if (run !== panel.run) return;
    if (tab.url !== panel.url) {
      panel.expanded.clear();
      panel.search = '';
      setMessage('');
    }
    panel.tabId = tab.id;
    panel.url = tab.url;
    panel.page = page;
  }

  panel.ratesResult = await loadRates(features, false).catch(() => null);
  if (run !== panel.run) return;
  draw();
}

function draw() {
  const count = Object.keys(panel.basket).length;
  const badge = $('basketCount');
  badge.hidden = count === 0;
  badge.textContent = `Sepet ${formatNumber(count)}`;

  const { page } = panel;
  const main = $('main');
  const scroll = main.scrollTop;
  const parts = !page ? emptyState('Bir sahibinden sayfası aç', 'Liste veya ilan sayfasına geçince rapor burada kendiliğinden belirir.')
    : page.pageType === 'detail' ? detailView(page)
      : page.pageType === 'list' && page.rows.length > 0 ? listView(page)
        : page.pageType === 'blocked' ? [el('div', { class: 'notice', icon: 'alert' }, el('span', { text: 'Site doğrulama sayfası gösteriyor. Eklenti bu sayfada çalışmaz. Doğrulamayı sen tamamla.' }))]
          : page.pageType === 'unreadable' ? emptyState('Bu sayfa okunamadı', 'Sayfayı yenileyip tekrar dene.')
            : emptyState('Burası liste veya ilan sayfası değil', 'Bir arama sonucu ya da ilan aç.');
  main.replaceChildren(...parts.filter(Boolean));
  main.scrollTop = scroll;
  drawActions(page);
}

function emptyState(title, text) {
  return [el('div', { class: 'state' }, [el('h2', { text: title }), el('p', { class: 'small muted', text })])];
}

function ratesBlock(price) {
  const holder = el('div');
  if (!price) return null;
  const { features } = panel;
  if (!features.liveRates && !features.manualRates) {
    holder.appendChild(el('button', {
      class: 'btn-link', type: 'button', text: 'Dolar, euro, sterlin ve gram altın olarak göster',
      onclick: () => setFeature(getFeature('liveRates'), true)
    }));
    return holder;
  }
  renderRatesStrip(holder, price, panel.ratesResult, async () => {
    panel.ratesResult = await loadRates(features, true).catch(() => panel.ratesResult);
    draw();
  });
  return holder;
}

/**
 * ============================================================================
 * LISTING PAGE
 * ============================================================================
 */
function detailView(page) {
  const { listing } = page;
  const record = detailToRecord(listing);
  const saved = panel.basket[record.id];
  const history = saved ? saved.priceHistory || [] : [];
  const last = history[history.length - 1];
  const others = Object.values(panel.basket);
  const facts = QUICK_FACTS.filter((name) => record.fields[name]).slice(0, 6);

  const hero = el('section', { class: 'card' }, [
    el('p', { class: 'crumb', text: (listing.category || []).join(' › ') }),
    el('h2', { class: 'hero-title', text: listing.title }),
    el('p', { class: 'hero-figure', text: formatPrice(listing.price) }),
    el('p', { class: 'hero-note', text: listing.location.raw }),
    last ? el('p', { class: 'hero-note', text: `Önceki fiyat ${formatNumber(last.amount)} ${last.currency}` }) : null,
    facts.length > 0 ? el('div', { class: 'chips' }, facts.map((name) => el('span', {
      class: 'pill pill-neutral num',
      text: name === 'KM' ? `${formatNumber(toNumber(record.fields.KM))} km` : name === 'Yıl' ? record.fields[name] : `${name.replace(/ \/.*$/, '')}: ${record.fields[name]}`
    }))) : null,
    saved ? el('div', { class: 'hero-tags' }, el('span', { class: 'pill pill-accent', text: 'Sepette' })) : null
  ]);

  const comparison = isVehicle(record) ? vehicleComparison(record, others) : null;
  const insights = listingInsights(record, panel.features, { ...basketContext(others, Date.now()), now: Date.now() });
  const parcel = parcelFromFields(record.fields);
  const links = el('div', { class: 'link-row' }, [
    panel.features.tkgm && parcel ? el('button', {
      class: 'btn-link', type: 'button', icon: 'map', text: 'Parseli TKGM’de aç',
      onclick: () => openTkgmParcel(listing.location, parcel, setMessage)
    }) : null,
    isVehicle(record) && listing.id ? el('a', {
      href: `https://x.com/search?q=${encodeURIComponent(`#${listing.id}`)}`, target: '_blank', rel: 'noopener', text: 'X’te bu ilanı ara'
    }) : null
  ]);

  return [
    hero,
    ratesBlock(listing.price),
    comparison ? renderPeerComparison(comparison) : null,
    renderVehicleReport(record, panel.terms),
    renderPhones(record),
    insights.length > 0 ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Bu ilan hakkında' }), renderFacts(insights)]) : null,
    panel.features.notesTags ? el('section', { class: 'card' }, [el('h2', { class: 'card-title', text: 'Notların' }), renderNoteEditor(record.id)]) : null,
    renderTechnical(record, panel.openFolds),
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
  if (panel.openFolds.has('description')) fold.open = true;
  fold.addEventListener('toggle', () => {
    if (fold.open) panel.openFolds.add('description');
    else panel.openFolds.delete('description');
  });
  return el('section', { class: 'card', style: 'padding-top: 4px; padding-bottom: 4px' }, fold);
}

/**
 * ============================================================================
 * RESULTS PAGE
 * ============================================================================
 */
function listRows(page, records) {
  const needle = panel.search.trim().toLocaleLowerCase('tr');
  const pairs = page.rows.map((row, index) => ({ row, record: records[index], index }));
  const matching = needle
    ? pairs.filter(({ record }) => `${record.title} ${record.id} ${record.location}`.toLocaleLowerCase('tr').includes(needle))
    : pairs;
  const price = ({ record }) => (record.price && record.price.amount) || Infinity;
  const km = ({ record }) => toNumber((record.fields || {}).KM) ?? Infinity;
  const sorters = {
    priceUp: (a, b) => price(a) - price(b),
    priceDown: (a, b) => (price(b) === Infinity ? -1 : price(a) === Infinity ? 1 : price(b) - price(a)),
    km: (a, b) => km(a) - km(b)
  };
  return panel.sort === 'page' ? matching : [...matching].sort(sorters[panel.sort]);
}

function listView(page) {
  const records = page.rows.map((row) => listRowToRecord(row, page));
  const medianPrice = pageMedianPrice(records);
  const hero = el('section', { class: 'card' }, [
    el('p', { class: 'crumb', text: (page.category || []).join(' › ') || 'Arama sonuçları' }),
    medianPrice ? el('p', { class: 'hero-figure', text: formatPrice(medianPrice) }) : null,
    el('p', { class: 'hero-note', text: `${medianPrice ? 'Medyan fiyat · ' : ''}Bu sayfada ${page.rows.length} ilan${page.total ? `, aramada ${formatNumber(page.total)}` : ''}` })
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
  search.value = panel.search;
  search.addEventListener('input', () => {
    panel.search = search.value;
    drawRows();
  });
  const sort = el('select', { 'aria-label': 'Sırala' }, [
    ['page', 'Sayfa sırası'], ['priceUp', 'Fiyat artan'], ['priceDown', 'Fiyat azalan'], ['km', 'KM artan']
  ].map(([value, text]) => el('option', { value, text })));
  sort.value = panel.sort;
  sort.addEventListener('change', () => {
    panel.sort = sort.value;
    drawRows();
  });
  drawRows();

  return [
    hero,
    ratesBlock(medianPrice),
    statsCard,
    el('section', { class: 'card' }, [
      el('div', { class: 'list-tools' }, [search, sort]),
      rowsHost
    ])
  ];
}

function listRow(page, row, record, medianPrice) {
  const saved = panel.basket[record.id];
  const isOpen = panel.expanded.has(record.id);
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
    el('button', {
      class: 'expand', type: 'button', icon: 'chevron', 'aria-label': 'Ayrıntıyı aç veya kapat', 'aria-expanded': String(isOpen),
      onclick: () => {
        if (isOpen) panel.expanded.delete(record.id);
        else panel.expanded.add(record.id);
        draw();
      }
    })
  ]));
  if (isOpen) holder.appendChild(listRowDetail(page, row, record));
  return holder;
}

function listRowDetail(page, row, record) {
  const saved = panel.basket[record.id];
  const parts = [];
  if (saved && saved.hasDetail) {
    parts.push(renderVehicleReport(saved, panel.terms), renderPhones(saved));
    const comparison = isVehicle(saved) ? vehicleComparison(saved, Object.values(panel.basket)) : null;
    if (comparison) parts.push(renderPeerComparison(comparison));
  } else if (panel.features.readWithoutOpening) {
    parts.push(el('button', {
      class: 'btn', type: 'button', icon: 'search', text: 'Açmadan oku (yüksek risk)',
      title: 'Siteye 1 istek gönderir ve günlük sınıra sayılır',
      onclick: async (event) => {
        event.currentTarget.disabled = true;
        setMessage('İlan okunuyor...');
        const result = await chrome.runtime.sendMessage({ action: 'enrich-start', data: { tabId: panel.tabId, listings: [{ id: record.id, url: record.url }] } });
        setMessage(result.status === 'error' ? result.error : 'İstek gönderildi. Sonuç gelince burada görünür.');
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

/**
 * ============================================================================
 * ACTIONS
 * ============================================================================
 */
function drawActions(page) {
  const bar = $('actions');
  const usable = page && ((page.pageType === 'detail') || (page.pageType === 'list' && page.rows.length > 0));
  bar.hidden = !usable;
  if (!usable) {
    bar.textContent = '';
    return;
  }
  const label = page.pageType === 'detail' ? 'Sepete ekle' : `${page.rows.length} ilanı sepete ekle`;
  bar.replaceChildren(
    el('button', {
      class: 'btn btn-primary', type: 'button', icon: 'plus', text: label,
      onclick: async () => {
        const result = await chrome.runtime.sendMessage({ action: 'basket-add-page', data: { page } });
        setMessage(result.status === 'success'
          ? `Sepet: ${result.counts.new} yeni, ${result.counts.updated} güncellendi, ${result.counts.priceChanged} fiyatı değişti.`
          : 'Sepete eklenemedi.');
      }
    }),
    el('button', {
      class: 'btn', type: 'button', icon: 'download', text: 'CSV',
      onclick: async () => {
        const context = await exportContext(panel.features, panel.ratesResult && panel.ratesResult.rates);
        const rows = page.pageType === 'detail'
          ? recordsToRows([detailToRecord(page.listing)], [], context)
          : listPageToRows(page, context);
        const name = page.pageType === 'detail' ? `sahibinden_ilan_${page.listing.id}` : `sahibinden_liste_${todayIso()}`;
        downloadCsv(rows, `${name}.csv`);
      }
    })
  );
}

hydrateBrand();
hydrateIcons();
$('workspaceBtn').addEventListener('click', () => chrome.tabs.create({ url: 'dashboard.html' }));
chrome.tabs.onActivated.addListener(() => refresh(true));
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.active) refresh(true);
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.basket || changes.vehicleTerms || changes.manualRates) refresh(false);
});
onFeaturesChanged(() => refresh(false));
refresh(true);
