// compare.js - Side-by-side view of basket listings, built only from locally saved data

const SKIPPED_COLUMNS = ['Resim', 'Fotoğraflar', 'Açıklama', 'İlk Görülme', 'Son Görülme', 'İlan Linki'];

async function renderComparison() {
  const ids = decodeURIComponent(location.hash.slice(1)).split(',');
  const { basket = {}, annotations = {}, scoreWeights } = await chrome.storage.local.get(['basket', 'annotations', 'scoreWeights']);
  const features = await loadFeatures();
  const records = ids.map((id) => basket[id]).filter(Boolean);
  const { rates } = await loadRates(features, false).catch(() => ({ rates: null }));
  const onlyDifferences = $('onlyDifferences').checked;
  const table = $('compareTable');
  table.textContent = '';
  if (records.length === 0) {
    table.insertRow().insertCell().textContent = 'Karşılaştırılacak ilan yok. Çalışma alanındaki Sepet bölümünden en az 2 ilan seç.';
    return;
  }

  const photoRow = table.insertRow();
  photoRow.insertCell().textContent = 'Fotoğraf';
  records.forEach((record) => {
    const cell = photoRow.insertCell();
    if (record.image) cell.appendChild(el('img', { class: 'photo', src: record.image, alt: '' }));
  });

  basketColumns(records, { features, rates, annotations, scoreWeights, now: Date.now() })
    .filter((column) => !SKIPPED_COLUMNS.includes(column.name))
    .forEach((column) => {
      const values = records.map((record) => {
        const value = column.read(record);
        return value === undefined || value === null ? '' : String(value);
      });
      const different = new Set(values).size > 1;
      if (onlyDifferences && !different) return;
      const row = table.insertRow();
      if (different) row.className = 'different';
      row.insertCell().textContent = column.name;
      values.forEach((value) => { row.insertCell().textContent = value || '-'; });
    });

  const linkRow = table.insertRow();
  linkRow.insertCell().textContent = 'İlan linki';
  records.forEach((record) => {
    linkRow.insertCell().appendChild(el('a', { href: record.url, target: '_blank', rel: 'noopener', text: 'Aç' }));
  });
}

hydrateBrand();
hydrateIcons();
$('onlyDifferences').addEventListener('change', renderComparison);
renderComparison();
onFeaturesChanged(renderComparison);
