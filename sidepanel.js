// sidepanel.js - Shows the open page's numbers beside it, without touching the page

let panelPage = null;
let panelRun = 0;

async function renderPanel() {
  const run = ++panelRun;
  const lead = $('lead');
  const features = await loadFeatures();
  if (run !== panelRun) return;
  $('stats').textContent = '';
  $('rates').textContent = '';
  lead.textContent = '';
  panelPage = null;
  $('addBtn').disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (run !== panelRun) return;
  if (!tab || !/^https?:\/\/([a-z0-9-]+\.)?sahibinden\.com\//i.test(tab.url || '') || tab.status !== 'complete') {
    lead.appendChild(el('p', { class: 'message', text: 'Bir sahibinden liste veya ilan sayfası aç.' }));
    return;
  }

  let price = null;
  try {
    const page = await runInTab(tab.id, 'extractPage');
    if (run !== panelRun) return;
    if (page.pageType === 'detail') {
      panelPage = page;
      price = page.listing.price;
      lead.append(
        el('h1', { text: page.listing.title }),
        el('p', { class: 'lead-figure', text: formatPrice(price) }),
        el('p', { class: 'small muted', text: page.listing.location.raw })
      );
    } else if (page.pageType === 'list' && page.rows.length > 0) {
      panelPage = page;
      const records = page.rows.map((row) => listRowToRecord(row, page));
      price = pageMedianPrice(records);
      lead.append(
        el('h1', { text: (page.category || []).slice(-2).join(' › ') || 'Arama sonuçları' }),
        price ? el('p', { class: 'lead-figure', text: formatPrice(price) }) : null,
        el('p', { class: 'small muted', text: `Medyan fiyat · bu sayfada ${page.rows.length} ilan` })
      );
      renderStats($('stats'), records);
    } else if (page.pageType === 'blocked') {
      lead.appendChild(el('div', { class: 'notice', icon: 'alert' }, el('span', { text: 'Site doğrulama sayfası gösteriyor.' })));
    } else {
      lead.appendChild(el('p', { class: 'message', text: 'Burası liste veya ilan sayfası değil.' }));
    }
  } catch (error) {
    if (run !== panelRun) return;
    lead.appendChild(el('p', { class: 'message', text: 'Bu sayfa okunamadı.' }));
    return;
  }

  $('addBtn').disabled = !panelPage;
  if (price) {
    const rates = await loadRates(features, false);
    if (run === panelRun) renderRatesStrip($('rates'), price, rates);
  }
}

$('addBtn').addEventListener('click', async () => {
  if (!panelPage) return;
  const result = await chrome.runtime.sendMessage({ action: 'basket-add-page', data: { page: panelPage } });
  $('message').textContent = result.status === 'success'
    ? `Sepet: ${result.counts.new} yeni, ${result.counts.updated} güncellendi, ${result.counts.priceChanged} fiyatı değişti.`
    : 'Sepete eklenemedi.';
});

hydrateBrand();
hydrateIcons();
chrome.tabs.onActivated.addListener(renderPanel);
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.active) renderPanel();
});
renderPanel();
onFeaturesChanged(renderPanel);
