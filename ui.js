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
  car: '<path d="M19 17h2a1 1 0 0 0 1-1v-3a2 2 0 0 0-1.6-2l-2.4-.5-2.2-3.5a2 2 0 0 0-1.7-1H9a2 2 0 0 0-1.7 1L5 10.5 3.3 11A2 2 0 0 0 2 13v3a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
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
  const parsed = parseDescription(record.description);
  add('Açıklamada tramer', typeof parsed.tramer === 'number' ? `${formatNumber(parsed.tramer)} TL` : parsed.tramer);
  add('Açıklamada cephe', parsed.facade);
  add('Açıklamada geçenler', parsed.keywords);
  add('Açıklamada ekstralar', parsed.extras);
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

/**
 * ============================================================================
 * VEHICLE REPORT
 * ============================================================================
 */
async function loadVehicleTerms() {
  const { vehicleTerms = [] } = await chrome.storage.local.get('vehicleTerms');
  return vehicleTerms;
}

/** Top view with the front at the top. Each part carries a letter, so state never rests on color alone. */
const CAR_DIAGRAM_PARTS = [
  ['front-bumper', 44, 4, 112, 22],
  ['front-hood', 54, 30, 92, 62],
  ['front-left-mudguard', 20, 30, 30, 62],
  ['front-right-mudguard', 150, 30, 30, 62],
  ['front-left-door', 20, 96, 30, 62],
  ['front-right-door', 150, 96, 30, 62],
  ['roof', 54, 118, 92, 72],
  ['rear-left-door', 20, 162, 30, 62],
  ['rear-right-door', 150, 162, 30, 62],
  ['rear-left-mudguard', 20, 228, 30, 62],
  ['rear-right-mudguard', 150, 228, 30, 62],
  ['rear-hood', 54, 228, 92, 62],
  ['rear-bumper', 44, 294, 112, 22]
];

function renderDamageDiagram(damage) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 200 320');
  svg.setAttribute('class', 'car-diagram');
  svg.setAttribute('role', 'img');
  const counts = damageCounts(damage);
  svg.setAttribute('aria-label', `Araç şeması: ${counts.changed} değişen, ${counts.painted} boyalı, ${counts.localPainted} lokal boyalı parça`);
  const stateOf = (part) => {
    if (damage.changed.includes(part)) return ['changed', 'D'];
    if (damage.painted.includes(part)) return ['painted', 'B'];
    if (damage.localPainted.includes(part)) return ['local', 'L'];
    return ['original', ''];
  };
  CAR_DIAGRAM_PARTS.forEach(([part, x, y, width, height]) => {
    const [state, letter] = stateOf(part);
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', `car-part car-part-${state}`);
    const title = document.createElementNS(ns, 'title');
    title.textContent = CAR_PART_LABELS[part];
    const rect = document.createElementNS(ns, 'rect');
    Object.entries({ x, y, width, height, rx: 6 }).forEach(([key, value]) => rect.setAttribute(key, value));
    group.append(title, rect);
    if (letter) {
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', x + width / 2);
      text.setAttribute('y', y + height / 2 + 5);
      text.setAttribute('text-anchor', 'middle');
      text.textContent = letter;
      group.appendChild(text);
    }
    svg.appendChild(group);
  });
  return svg;
}

function renderDamageSummary(damage) {
  const counts = damageCounts(damage);
  const row = (letter, state, label, parts) => el('div', { class: 'damage-row' }, [
    el('span', { class: `damage-key damage-key-${state}`, text: letter }),
    el('div', {}, [
      el('span', { class: 'damage-label', text: `${parts.length} ${label}` }),
      parts.length > 0 ? el('span', { class: 'small muted damage-parts', text: partLabels(parts) }) : null
    ])
  ]);
  const holder = el('div', { class: 'damage-summary' }, [
    row('D', 'changed', 'değişen', damage.changed),
    row('B', 'painted', 'boyalı', damage.painted),
    row('L', 'local', 'lokal boyalı', damage.localPainted),
    el('div', { class: 'damage-row' }, [
      el('span', { class: 'damage-key damage-key-original' }),
      el('span', { class: 'damage-label', text: `${counts.original} orijinal` })
    ])
  ]);
  (damage.notes || []).forEach((note) => holder.appendChild(el('p', { class: 'small muted', text: note })));
  return holder;
}

function renderSignals(signals) {
  const list = el('div', { class: 'signals' });
  signals.forEach((signal) => {
    const quotes = signal.snippets.map(({ before, match, after }) => el('p', { class: 'signal-quote' }, [
      before ? `${before} ` : null,
      el('mark', { text: match }),
      after ? ` ${after}` : null
    ]));
    list.appendChild(el('div', { class: 'signal' }, [
      el('span', { class: 'signal-label', text: signal.label }),
      ...quotes
    ]));
  });
  return list;
}

/** Null for anything that is not a vehicle. Reads only what the record already holds. */
function renderVehicleReport(record, terms) {
  if (!isVehicle(record)) return null;
  const fields = record.fields || {};
  const signals = vehicleSignals(record.description, terms);
  const heavy = fields['Ağır Hasar Kayıtlı'];
  if (!record.damage && signals.length === 0 && !heavy) return null;
  const card = el('section', { class: 'card vehicle-report' }, el('div', { class: 'vehicle-head' }, [
    el('h2', { text: 'Araç raporu' }),
    heavy ? el('span', {
      class: `pill ${/^hay[ıi]r$/i.test(heavy) ? 'pill-low' : 'pill-high'}`,
      text: `Ağır hasar kayıtlı: ${heavy}`
    }) : null
  ]));
  if (record.damage) {
    card.appendChild(el('div', { class: 'vehicle-damage' }, [renderDamageDiagram(record.damage), renderDamageSummary(record.damage)]));
  }
  if (signals.length > 0) {
    card.append(el('h3', { class: 'vehicle-subhead', text: 'Satıcının açıklamasında' }), renderSignals(signals));
  }
  return card;
}

function comparisonText(comparison) {
  const describe = (diff, higher, lower) => {
    if (diff === null) return null;
    if (diff === 0) return 'medyanla aynı';
    return `%${Math.abs(diff)} ${diff > 0 ? higher : lower}`;
  };
  return {
    scope: `Sepetteki ${comparison.count} ${comparison.key} ilanına göre${comparison.closeYears ? ' (±2 model yılı)' : ''}`,
    price: describe(comparison.priceDiff, 'pahalı', 'ucuz'),
    km: describe(comparison.kmDiff, 'fazla', 'az')
  };
}

function renderPeerComparison(comparison) {
  const text = comparisonText(comparison);
  const stat = (label, value, base) => el('div', { class: 'peer-stat' }, [
    el('span', { class: 'small muted', text: label }),
    el('span', { class: 'peer-value', text: value }),
    el('span', { class: 'small muted', text: base })
  ]);
  return el('section', { class: 'card' }, [
    el('h2', { class: 'card-title', text: text.scope }),
    el('div', { class: 'peer-stats' }, [
      text.price ? stat('Fiyat', text.price, `Medyan ${formatNumber(comparison.medianPrice)} ${comparison.currency}`) : null,
      text.km ? stat('KM', text.km, `Medyan ${formatNumber(comparison.medianKm)} km`) : null
    ])
  ]);
}

/** Model-wide specs in collapsible groups. openSet remembers which ones stay open across redraws. */
function renderTechnical(record, openSet) {
  const technical = record.technical;
  if (!technical) return null;
  const group = (title, content) => {
    const details = el('details', { class: 'fold' }, [el('summary', { text: title }), content]);
    if (openSet && openSet.has(title)) details.open = true;
    details.addEventListener('toggle', () => {
      if (!openSet) return;
      if (details.open) openSet.add(title);
      else openSet.delete(title);
    });
    return details;
  };
  const card = el('section', { class: 'card' }, [
    el('h2', { text: 'Teknik özellikler' }),
    el('p', { class: 'small muted', text: 'Modelin genel verileridir, bu araca özel olmayabilir.' })
  ]);
  Object.entries(technical.sections || {}).forEach(([title, rows]) => {
    card.appendChild(group(title, renderFacts(Object.entries(rows))));
  });
  const equipment = Object.entries(technical.equipment || {});
  if (equipment.length > 0) {
    card.appendChild(group('Model donanımı', el('div', { class: 'equipment' }, equipment.map(([category, items]) => el('div', {}, [
      el('p', { class: 'equipment-category', text: category }),
      el('p', { class: 'small muted', text: items.join(', ') })
    ])))));
  }
  return card;
}

/** D, B and L counts for one listing, used wherever vehicles are listed */
function renderDamageChips(record) {
  const counts = damageCounts(record.damage);
  if (!counts) return el('span', { class: 'small muted', text: record.hasDetail ? 'Hasar bilgisi yok' : 'İlan açılmadı' });
  if (counts.changed + counts.painted + counts.localPainted === 0) return el('span', { class: 'pill pill-low', text: 'Hasarsız' });
  const chip = (state, count, letter) => (count ? el('span', { class: `damage-chip damage-key-${state}`, text: `${count} ${letter}` }) : null);
  return el('span', { class: 'damage-chips' }, [
    chip('changed', counts.changed, 'D'),
    chip('painted', counts.painted, 'B'),
    chip('local', counts.localPainted, 'L')
  ]);
}

function peerDiffText(comparison) {
  if (!comparison || comparison.priceDiff === null) return '';
  const { priceDiff } = comparison;
  return `${priceDiff > 0 ? '+' : priceDiff < 0 ? '-' : ''}%${Math.abs(priceDiff)}`;
}

/** Series, damage and sort pickers. They change the filters object they are given. */
function renderVehicleFilters(records, filters, onChange) {
  const names = [...new Set(records.filter(isVehicle).map(vehicleSeriesName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const pick = (label, key, options, parse) => {
    const select = el('select', { 'aria-label': label }, options.map(([value, text]) => el('option', { value, text })));
    select.value = String(filters[key]);
    select.addEventListener('change', () => {
      filters[key] = parse ? parse(select.value) : select.value;
      onChange();
    });
    return select;
  };
  return el('div', { class: 'filters' }, [
    pick('Seri', 'series', [['', 'Tüm seriler'], ...names.map((name) => [name, name])]),
    pick('Hasar', 'damage', [['', 'Tüm hasarlar'], ['noChanged', 'Değişensiz'], ['clean', 'Boyasız, değişensiz']]),
    pick('Sırala', 'sortBy', [['page', 'Liste sırası'], ['peer', 'Seriye göre fiyat'], ['price', 'Fiyat'], ['km', 'KM'], ['year', 'Yıl'], ['damage', 'Hasar']]),
    pick('Yön', 'descending', [['false', 'Artan'], ['true', 'Azalan']], (value) => value === 'true')
  ]);
}

/** Search words are saved to storage, and every open page redraws from that change */
function renderTermsEditor(terms, className) {
  const save = (next) => chrome.storage.local.set({ vehicleTerms: next });
  const chips = el('div', { class: 'term-chips' }, terms.map((term) => el('span', { class: 'pill pill-neutral' }, [
    el('span', { text: term }),
    el('button', {
      class: 'btn-link', type: 'button', text: '×', 'aria-label': `${term} kaldır`, style: 'margin-left: 6px; text-decoration: none',
      onclick: () => save(terms.filter((item) => item !== term))
    })
  ])));
  const input = el('input', { type: 'text', placeholder: 'Örn. partikül, LPG', 'aria-label': 'Aranacak kelime' });
  const add = () => {
    const term = input.value.trim();
    if (term && !terms.includes(term)) save([...terms, term]);
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') add();
  });
  return el('section', { class: className }, [
    el('h2', { text: 'Açıklamada aranacak kelimeler' }),
    el('p', { class: 'small muted', text: 'Eklediğin her kelime Araç raporunda görünür, CSV’de ayrı sütun olur.' }),
    el('div', { class: 'terms-row' }, [input, el('button', { class: 'btn', type: 'button', icon: 'plus', text: 'Ekle', onclick: add })]),
    chips
  ]);
}

/** Label and value pairs in a compact grid. A missing value shows as a dash. */
function renderSpecs(specs) {
  const grid = el('dl', { class: 'spec-grid' });
  specs.forEach(([label, value]) => {
    grid.append(el('dt', { text: label }), el('dd', { class: 'num', text: value === undefined || value === null || value === '' ? '-' : String(value) }));
  });
  return grid;
}

/** One photo of the listing, shown large, with its link and a download. Nothing here touches the page. */
function renderPhotoBlock(record, onStatus) {
  const smaller = record.image;
  let url = recordPhoto(record);
  if (!url) return null;
  const img = el('img', { class: 'photo-large', src: url, alt: '' });
  const open = el('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', icon: 'open', text: 'Aç' });
  // Showcase thumbnails have no large copy, so the block falls back to the one the page showed
  img.addEventListener('error', () => {
    if (!smaller || url === smaller) {
      img.hidden = true;
      return;
    }
    url = smaller;
    img.src = url;
    open.href = url;
  });
  return el('div', { class: 'photo-block' }, [
    img,
    el('div', { class: 'btn-row' }, [
      el('button', {
        class: 'btn', type: 'button', icon: 'download', text: 'İndir',
        onclick: async () => {
          const type = (url.match(/\.(jpe?g|png|webp)(?:$|\?)/i) || [null, 'jpg'])[1].toLowerCase();
          const result = await chrome.runtime.sendMessage({
            action: 'download-images',
            data: { images: [{ url, filename: `ilan_${record.id}`, type }], folder: 'sahibinden_fotograflar' }
          });
          onStatus(result.status === 'started' ? 'Fotoğraf indiriliyor.' : 'Önceki indirme hâlâ sürüyor.');
        }
      }),
      el('button', {
        class: 'btn', type: 'button', icon: 'link', text: 'Linki kopyala',
        onclick: async () => {
          await navigator.clipboard.writeText(url);
          onStatus('Fotoğraf linki kopyalandı.');
        }
      }),
      open
    ])
  ]);
}

/** Kind filter for real estate, with how many listings each kind has */
function renderEmlakChips(records, selected, onPick) {
  const counts = emlakCounts(records);
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const chip = (id, label, count) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(selected === id),
    onclick: () => onPick(id)
  }, [el('span', { text: label }), el('span', { class: 'chip-count num', text: formatNumber(count) })]);
  return el('div', { class: 'chip-row', role: 'group', 'aria-label': 'Emlak türü' }, [
    chip('', 'Tümü', total),
    ...counts.map((item) => chip(item.id, item.label, item.count))
  ]);
}

function renderEmlakSort(filters, onChange) {
  const select = el('select', { 'aria-label': 'Sırala' }, [
    ['page', 'Liste sırası'], ['priceUp', 'Fiyat artan'], ['priceDown', 'Fiyat azalan'], ['unitUp', 'Fiyat/m² artan'], ['dateDown', 'En yeni']
  ].map(([value, text]) => el('option', { value, text })));
  const choices = { page: ['page', false], priceUp: ['price', false], priceDown: ['price', true], unitUp: ['unit', false], dateDown: ['date', true] };
  select.value = Object.keys(choices).find((key) => choices[key][0] === filters.sortBy && choices[key][1] === filters.descending) || 'page';
  select.addEventListener('change', () => {
    [filters.sortBy, filters.descending] = choices[select.value];
    onChange();
  });
  return select;
}

/** Numbers the seller wrote in the description. The site's protected phone field is not read. */
function renderPhones(record) {
  const phones = extractPhones(record.description);
  if (phones.length === 0) return null;
  return el('section', { class: 'card' }, [
    el('h2', { class: 'card-title', text: 'Açıklamadaki telefon' }),
    el('div', { class: 'btn-row' }, phones.map((phone) => el('a', {
      class: 'btn num', href: `tel:${phone.replace(/\s/g, '')}`, icon: 'phone', text: phone
    })))
  ]);
}

function renderNoteEditor(id, onSaved) {
  const holder = el('div', { class: 'detail-fields' });
  chrome.storage.local.get('annotations').then(({ annotations = {} }) => {
    const note = annotations[id] || {};
    const save = async (patch) => {
      const { annotations: latest = {} } = await chrome.storage.local.get('annotations');
      latest[id] = { ...(latest[id] || {}), ...patch };
      await chrome.storage.local.set({ annotations: latest });
      if (onSaved) onSaved(latest);
    };
    const rating = el('select', {}, [
      el('option', { value: '', text: 'Puan yok' }),
      ...[1, 2, 3, 4, 5].map((value) => el('option', { value: String(value), text: `${value} puan` }))
    ]);
    rating.value = note.rating ? String(note.rating) : '';
    rating.addEventListener('change', () => save({ rating: rating.value === '' ? null : Number(rating.value) }));
    const tags = el('input', { type: 'text', placeholder: 'Örn. görülecek, pazarlık' });
    tags.value = (note.tags || []).join(', ');
    tags.addEventListener('change', () => save({ tags: tags.value.split(',').map((tag) => tag.trim()).filter(Boolean) }));
    const text = el('input', { type: 'text', placeholder: 'Bu ilan için notun' });
    text.value = note.note || '';
    text.addEventListener('change', () => save({ note: text.value }));
    holder.append(
      el('label', { class: 'field' }, [el('span', { text: 'Puanım' }), rating]),
      el('label', { class: 'field' }, [el('span', { text: 'Etiketler, virgülle' }), tags]),
      el('label', { class: 'field' }, [el('span', { text: 'Notum' }), text])
    );
  });
  return holder;
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
  const { annotations = {}, scoreWeights, vehicleTerms = [] } = await chrome.storage.local.get(['annotations', 'scoreWeights', 'vehicleTerms']);
  return {
    features,
    rates,
    annotations,
    scoreWeights,
    vehicleTerms,
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
