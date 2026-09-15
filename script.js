/* ============================================================
   StockFlow — Inventory Management
   Client-side app. Data persists in localStorage.
   ============================================================ */

const STORAGE_KEY = 'stockflow_items_v1';

/* ---------------- State ---------------- */
let items = [];          // array of product objects
let filters = { search: '', category: '', stock: '', sort: 'name-asc' };
let editingId = null;

/* ---------------- Helpers ---------------- */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const uid = () => 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const money = (n) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (n) => (Number(n) || 0).toLocaleString('en-US');

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&' + 'amp;';
      case '<': return '&' + 'lt;';
      case '>': return '&' + 'gt;';
      case '"': return '&' + 'quot;';
      case "'": return '&' + '#39;';
      default: return c;
    }
  });
}

function initials(name) {
  return String(name || '?')
    .trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0] ? w[0].toUpperCase() : '').join('') || '?';
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function stockStatus(item) {
  const q = Number(item.qty) || 0;
  const r = Number(item.reorder) || 0;
  if (q <= 0) return 'out';
  if (r > 0 && q <= r) return 'low';
  return 'in';
}

/* ---------------- Persistence ---------------- */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) items = [];
  } catch { items = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ---------------- Toast ---------------- */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  $('#toastWrap').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(40px)';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/* ---------------- Navigation ---------------- */
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  upload: 'Upload Inventory',
  alerts: 'Low Stock Alerts'
};

function switchView(view) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  const target = $('#view-' + view);
  if (target) target.classList.add('active');

  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  $('#pageTitle').textContent = VIEW_TITLES[view] || 'Dashboard';

  // close mobile sidebar
  $('#sidebar').classList.remove('open');

  if (view === 'dashboard') renderDashboard();
  if (view === 'inventory') renderTable();
  if (view === 'alerts') renderAlertsView();
}

/* ---------------- Derived data ---------------- */
function getCategories() {
  const set = new Set();
  items.forEach((i) => { if (i.category) set.add(i.category); });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function lowStockItems() {
  return items
    .filter((i) => stockStatus(i) !== 'in')
    .sort((a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0));
}

/* ---------------- Filtering / sorting ---------------- */
function visibleItems() {
  const q = filters.search.trim().toLowerCase();
  let list = items.filter((i) => {
    if (filters.category && i.category !== filters.category) return false;
    if (filters.stock && stockStatus(i) !== filters.stock) return false;
    if (q) {
      const hay = [i.name, i.sku, i.category, i.supplier].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const [key, dir] = filters.sort.split('-');
  const mul = dir === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    let av, bv;
    switch (key) {
      case 'name': av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); break;
      case 'sku': av = (a.sku || '').toLowerCase(); bv = (b.sku || '').toLowerCase(); break;
      case 'category': av = (a.category || '').toLowerCase(); bv = (b.category || '').toLowerCase(); break;
      case 'qty': av = Number(a.qty) || 0; bv = Number(b.qty) || 0; break;
      case 'reorder': av = Number(a.reorder) || 0; bv = Number(b.reorder) || 0; break;
      case 'price': av = Number(a.price) || 0; bv = Number(b.price) || 0; break;
      case 'value': av = (Number(a.qty) || 0) * (Number(a.price) || 0); bv = (Number(b.qty) || 0) * (Number(b.price) || 0); break;
      case 'updated': av = a.updatedAt || 0; bv = b.updatedAt || 0; break;
      default: av = 0; bv = 0;
    }
    if (av < bv) return -1 * mul;
    if (av > bv) return 1 * mul;
    return 0;
  });
  return list;
}

/* ---------------- Render: Dashboard ---------------- */
function renderDashboard() {
  const totalProducts = items.length;
  const totalUnits = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalValue = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const low = lowStockItems();

  $('#statTotalProducts').textContent = num(totalProducts);
  $('#statTotalUnits').textContent = num(totalUnits);
  $('#statTotalValue').textContent = money(totalValue);
  $('#statLowStock').textContent = num(low.length);

  renderCategoryChart();
  renderDashboardAlerts(low);
  renderRecent();
  updateAlertBadge(low.length);
}

function renderCategoryChart() {
  const el = $('#categoryChart');
  const map = {};
  items.forEach((i) => {
    const c = i.category || 'Uncategorized';
    map[c] = (map[c] || 0) + (Number(i.qty) || 0);
  });
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    el.innerHTML = '<div class="empty-hint">No data yet. Add or upload products to see the breakdown.</div>';
    return;
  }
  const max = Math.max(...rows.map((r) => r[1])) || 1;
  el.innerHTML = rows.map(([cat, qty]) => `
    <div class="chart-row">
      <div class="chart-cat" title="${escapeHtml(cat)}">${escapeHtml(cat)}</div>
      <div class="chart-track"><div class="chart-fill" style="width:${Math.max(4, (qty / max) * 100)}%"></div></div>
      <div class="chart-val">${num(qty)}</div>
    </div>
  `).join('');
}

function alertRow(item) {
  const st = stockStatus(item);
  return `
    <div class="alert-item">
      <span class="alert-dot ${st}"></span>
      <div class="alert-info">
        <div class="alert-name">${escapeHtml(item.name)}</div>
        <div class="alert-meta">${escapeHtml(item.category || 'Uncategorized')}${item.sku ? ' · ' + escapeHtml(item.sku) : ''} · reorder at ${num(item.reorder)}</div>
      </div>
      <div class="alert-qty ${st === 'out' ? 'out' : ''}">${st === 'out' ? 'Out' : num(item.qty) + ' left'}</div>
    </div>`;
}

function renderDashboardAlerts(low) {
  const el = $('#dashboardAlerts');
  if (!low.length) { el.innerHTML = '<div class="empty-hint">No low stock items. </div>'; return; }
  el.innerHTML = low.slice(0, 6).map(alertRow).join('');
}

function renderAlertsView() {
  const low = lowStockItems();
  const el = $('#alertsFull');
  if (!low.length) { el.innerHTML = '<div class="empty-hint">No low stock items. 🎉</div>'; return; }
  el.innerHTML = low.map(alertRow).join('');
  updateAlertBadge(low.length);
}

function renderRecent() {
  const el = $('#recentList');
  const recent = [...items]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5);
  if (!recent.length) { el.innerHTML = '<div class="empty-hint">Nothing here yet.</div>'; return; }
  el.innerHTML = recent.map((i) => `
    <div class="recent-item">
      <div class="recent-avatar">${escapeHtml(initials(i.name))}</div>
      <div class="recent-info">
        <div class="recent-name">${escapeHtml(i.name)}</div>
        <div class="recent-meta">${num(i.qty)} units · ${money((Number(i.qty) || 0) * (Number(i.price) || 0))}</div>
      </div>
      <div class="recent-time">${timeAgo(i.updatedAt)}</div>
    </div>
  `).join('');
}

function updateAlertBadge(count) {
  const badge = $('#navAlertCount');
  badge.textContent = count;
  badge.dataset.empty = count === 0 ? 'true' : 'false';
}

/* ---------------- Render: Inventory table ---------------- */
function renderTable() {
  const list = visibleItems();
  const tbody = $('#inventoryBody');
  const empty = $('#inventoryEmpty');

  $('#resultCount').textContent = list.length + (list.length === 1 ? ' item' : ' items');

  if (!items.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    $('#inventoryTable').style.display = 'none';
    return;
  }
  empty.classList.add('hidden');
  $('#inventoryTable').style.display = '';

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#667085;padding:40px">No products match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((i) => {
    const st = stockStatus(i);
    const val = (Number(i.qty) || 0) * (Number(i.price) || 0);
    const badge = st === 'in'
      ? '<span class="badge in">● In Stock</span>'
      : st === 'low'
        ? '<span class="badge low">● Low</span>'
        : '<span class="badge out">● Out</span>';
    return `
      <tr>
        <td>
          <div class="cell-product">
            <div class="cell-avatar">${escapeHtml(initials(i.name))}</div>
            <div>
              <div class="cell-name">${escapeHtml(i.name)}</div>
              ${i.supplier ? `<div class="cell-sku">${escapeHtml(i.supplier)}</div>` : ''}
            </div>
          </div>
        </td>
        <td><span class="mono">${escapeHtml(i.sku || '—')}</span></td>
        <td><span class="badge cat">${escapeHtml(i.category || 'Uncategorized')}</span></td>
        <td class="num">
          <div class="qty-step">
            <button class="qty-btn" data-dec="${i.id}" title="Decrease">−</button>
            <span style="min-width:26px;text-align:center">${num(i.qty)}</span>
            <button class="qty-btn" data-inc="${i.id}" title="Increase">＋</button>
          </div>
        </td>
        <td class="num">${num(i.reorder)}</td>
        <td class="num">${money(i.price)}</td>
        <td class="num"><strong>${money(val)}</strong></td>
        <td class="num">${badge}</td>
        <td class="num">
          <div class="row-actions">
            <button class="icon-btn" data-edit="${i.id}" title="Edit">✏️</button>
            <button class="icon-btn del" data-del="${i.id}" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ---------------- CRUD ---------------- */
function openModal(id = null) {
  editingId = id;
  const categories = getCategories();
  $('#categoryOptions').innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');

  if (id) {
    const i = items.find((x) => x.id === id);
    if (!i) return;
    $('#modalTitle').textContent = 'Edit Product';
    $('#modalSave').textContent = 'Save Changes';
    $('#fName').value = i.name || '';
    $('#fSku').value = i.sku || '';
    $('#fCategory').value = i.category || '';
    $('#fQty').value = Number(i.qty) || 0;
    $('#fPrice').value = Number(i.price) || 0;
    $('#fReorder').value = Number(i.reorder) || 0;
    $('#fSupplier').value = i.supplier || '';
  } else {
    $('#modalTitle').textContent = 'Add Product';
    $('#modalSave').textContent = 'Add Product';
    $('#itemForm').reset();
    $('#fQty').value = 0;
    $('#fPrice').value = 0;
    $('#fReorder').value = 0;
  }
  $('#itemModal').classList.remove('hidden');
  setTimeout(() => $('#fName').focus(), 50);
}

function closeModal() {
  $('#itemModal').classList.add('hidden');
  editingId = null;
}

function submitForm(e) {
  e.preventDefault();
  const name = $('#fName').value.trim();
  if (!name) { toast('Product name is required', 'error'); return; }

  const data = {
    name,
    sku: $('#fSku').value.trim(),
    category: $('#fCategory').value.trim(),
    qty: Math.max(0, parseInt($('#fQty').value, 10) || 0),
    price: Math.max(0, parseFloat($('#fPrice').value) || 0),
    reorder: Math.max(0, parseInt($('#fReorder').value, 10) || 0),
    supplier: $('#fSupplier').value.trim(),
    updatedAt: Date.now()
  };

  if (editingId) {
    const idx = items.findIndex((x) => x.id === editingId);
    if (idx > -1) items[idx] = { ...items[idx], ...data };
    toast('Product updated', 'success');
  } else {
    items.push({ id: uid(), createdAt: Date.now(), ...data });
    toast('Product added', 'success');
  }
  save();
  closeModal();
  refreshAll();
}

function deleteItem(id) {
  const i = items.find((x) => x.id === id);
  if (!i) return;
  if (!confirm(`Delete "${i.name}"? This cannot be undone.`)) return;
  items = items.filter((x) => x.id !== id);
  save();
  toast('Product deleted');
  refreshAll();
}

function adjustQty(id, delta) {
  const i = items.find((x) => x.id === id);
  if (!i) return;
  i.qty = Math.max(0, (Number(i.qty) || 0) + delta);
  i.updatedAt = Date.now();
  save();
  refreshAll();
}

/* ---------------- CSV ---------------- */
function parseCSV(text) {
  // Simple robust CSV parser (handles quotes, commas, newlines, CRLF)
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function normalizeHeader(h) {
  return String(h).trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const HEADER_MAP = {
  name: 'name', product: 'name', productname: 'name', item: 'name', itemname: 'name', title: 'name',
  sku: 'sku', code: 'sku', productcode: 'sku', itemcode: 'sku', barcode: 'sku',
  category: 'category', cat: 'category', type: 'category', group: 'category',
  quantity: 'qty', qty: 'qty', stock: 'qty', stockqty: 'qty', onhand: 'qty', count: 'qty',
  price: 'price', unitprice: 'price', cost: 'price', saleprice: 'price',
  reorder: 'reorder', reorderlevel: 'reorder', reorderpoint: 'reorder', minstock: 'reorder', min: 'reorder',
  supplier: 'supplier', vendor: 'supplier', brand: 'supplier'
};

function importCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) {
    showImportSummary('CSV appears to be empty or missing rows.', true);
    return;
  }
  const headers = rows[0].map(normalizeHeader);
  const idx = {};
  headers.forEach((h, i) => {
    const mapped = HEADER_MAP[h];
    if (mapped && idx[mapped] === undefined) idx[mapped] = i;
  });

  if (idx.name === undefined) {
    showImportSummary('Could not find a "name" column. Please check your CSV header row.', true);
    return;
  }

  let added = 0, updated = 0, skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const name = String(cells[idx.name] ?? '').trim();
    if (!name) { skipped++; continue; }

    const get = (k) => (idx[k] !== undefined ? String(cells[idx[k]] ?? '').trim() : '');
    const toInt = (v) => { const n = parseInt(String(v).replace(/[^0-9.-]/g, ''), 10); return isNaN(n) ? 0 : Math.max(0, n); };
    const toFloat = (v) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : Math.max(0, n); };

    const sku = get('sku');
    const record = {
      name,
      sku,
      category: get('category'),
      qty: toInt(get('qty')),
      price: toFloat(get('price')),
      reorder: toInt(get('reorder')),
      supplier: get('supplier'),
      updatedAt: Date.now()
    };

    // match by SKU if present, else by name
    let existing = null;
    if (sku) existing = items.find((x) => x.sku && x.sku.toLowerCase() === sku.toLowerCase());
    if (!existing) existing = items.find((x) => x.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      Object.assign(existing, record);
      updated++;
    } else {
      items.push({ id: uid(), createdAt: Date.now(), ...record });
      added++;
    }
  }

  save();
  refreshAll();
  showImportSummary(
    `<strong>Import complete.</strong> Added <strong>${added}</strong>, updated <strong>${updated}</strong>${skipped ? `, skipped <strong>${skipped}</strong>` : ''}.`,
    false
  );
  toast(`Imported ${added + updated} product(s)`, 'success');
}

function showImportSummary(html, isError) {
  const el = $('#importSummary');
  el.className = 'import-summary' + (isError ? ' error' : '');
  el.innerHTML = html;
  el.classList.remove('hidden');
}

function exportCSV() {
  if (!items.length) { toast('Nothing to export', 'error'); return; }
  const header = ['name', 'sku', 'category', 'quantity', 'price', 'reorder', 'supplier'];
  const lines = [header.join(',')];
  items.forEach((i) => {
    const row = [
      i.name, i.sku || '', i.category || '', Number(i.qty) || 0,
      Number(i.price) || 0, Number(i.reorder) || 0, i.supplier || ''
    ].map((v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    });
    lines.push(row.join(','));
  });
  download('inventory-export-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\n'));
  toast('Exported CSV', 'success');
}

function downloadTemplate() {
  const csv = 'name,sku,category,quantity,price,reorder,supplier\n' +
    'Wireless Mouse,WM-001,Electronics,42,19.99,10,Acme Supplies\n' +
    'A4 Notebook,NB-014,Stationery,150,2.50,25,Paper Co\n' +
    'Coffee Beans 1kg,CB-100,Grocery,8,14.00,20,Bean Bros\n';
  download('inventory-template.csv', csv);
  toast('Template downloaded', 'success');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function readFile(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    showImportSummary('Please choose a .csv file.', true);
    toast('Unsupported file type', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => importCSV(e.target.result);
  reader.onerror = () => { showImportSummary('Failed to read the file.', true); };
  reader.readAsText(file);
}

/* ---------------- Sample data ---------------- */
function loadSample() {
  if (items.length && !confirm('Loading sample data will replace your current inventory. Continue?')) return;
  const now = Date.now();
  const sample = [
    ['Wireless Mouse', 'WM-001', 'Electronics', 42, 19.99, 10, 'Acme Supplies'],
    ['Mechanical Keyboard', 'KB-220', 'Electronics', 15, 79.00, 8, 'Acme Supplies'],
    ['USB-C Cable 2m', 'UC-045', 'Electronics', 4, 9.50, 20, 'CableWorld'],
    ['A4 Notebook', 'NB-014', 'Stationery', 150, 2.50, 25, 'Paper Co'],
    ['Gel Pen (Blue) 10pk', 'GP-010', 'Stationery', 0, 6.75, 15, 'Paper Co'],
    ['Sticky Notes Pack', 'SN-033', 'Stationery', 60, 3.20, 20, 'Paper Co'],
    ['Coffee Beans 1kg', 'CB-100', 'Grocery', 8, 14.00, 20, 'Bean Bros'],
    ['Green Tea 50 Bags', 'GT-050', 'Grocery', 35, 5.40, 12, 'Bean Bros'],
    ['Water Bottle 750ml', 'WB-750', 'Lifestyle', 24, 12.00, 10, 'Hydro Inc'],
    ['Desk Lamp LED', 'DL-009', 'Lifestyle', 3, 24.99, 6, 'BrightHome'],
    ['Backpack 20L', 'BP-020', 'Lifestyle', 12, 39.90, 5, 'TravelGear'],
    ['Bluetooth Speaker', 'BS-300', 'Electronics', 0, 45.00, 5, 'SoundMax']
  ];
  items = sample.map((s, k) => ({
    id: uid(),
    name: s[0], sku: s[1], category: s[2],
    qty: s[3], price: s[4], reorder: s[5], supplier: s[6],
    createdAt: now - k * 3600000,
    updatedAt: now - k * 3600000
  }));
  save();
  refreshAll();
  toast('Sample data loaded', 'success');
  switchView('dashboard');
}

function clearAll() {
  if (!items.length) { toast('Nothing to clear'); return; }
  if (!confirm('Delete ALL inventory data? This cannot be undone.')) return;
  items = [];
  save();
  refreshAll();
  toast('All data cleared');
}

/* ---------------- Full refresh ---------------- */
function refreshAll() {
  // keep filters select in sync
  const catSel = $('#filterCategory');
  const current = catSel.value;
  const cats = getCategories();
  catSel.innerHTML = '<option value="">All Categories</option>' +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  catSel.value = cats.includes(current) ? current : '';

  // active view re-render
  const active = document.querySelector('.view.active');
  if (active) {
    const id = active.id.replace('view-', '');
    if (id === 'dashboard') renderDashboard();
    else if (id === 'inventory') renderTable();
    else if (id === 'alerts') renderAlertsView();
  }
  // always update badge
  updateAlertBadge(lowStockItems().length);
  // keep dashboard fresh if inventory changed while on other view
  if (!active || active.id !== 'view-dashboard') renderDashboard();
}

/* ---------------- Event wiring ---------------- */
function initEvents() {
  // nav
  $$('.nav-item').forEach((n) => n.addEventListener('click', () => switchView(n.dataset.view)));
  $$('[data-view]').forEach((b) => {
    if (b.classList.contains('nav-item')) return;
    b.addEventListener('click', (e) => {
      const view = b.dataset.view;
      if (view) { e.preventDefault(); switchView(view); }
    });
  });

  // sidebar toggle (mobile)
  $('#hamburger').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // add product
  $('#btnAddItem').addEventListener('click', () => openModal());
  $('#emptyAddBtn').addEventListener('click', () => openModal());

  // modal
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalCancel').addEventListener('click', closeModal);
  $('#itemForm').addEventListener('submit', submitForm);
  $('#itemModal').addEventListener('click', (e) => { if (e.target.id === 'itemModal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // table actions (event delegation)
  $('#inventoryBody').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.edit) openModal(t.dataset.edit);
    else if (t.dataset.del) deleteItem(t.dataset.del);
    else if (t.dataset.inc) adjustQty(t.dataset.inc, 1);
    else if (t.dataset.dec) adjustQty(t.dataset.dec, -1);
  });

  // search & filters
  $('#globalSearch').addEventListener('input', (e) => {
    filters.search = e.target.value;
    if (!document.querySelector('#view-inventory').classList.contains('active')) switchView('inventory');
    renderTable();
  });
  $('#filterCategory').addEventListener('change', (e) => { filters.category = e.target.value; renderTable(); });
  $('#filterStock').addEventListener('change', (e) => { filters.stock = e.target.value; renderTable(); });
  $('#sortBy').addEventListener('change', (e) => { filters.sort = e.target.value; renderTable(); });

  // column header sorting
  $$('#inventoryTable thead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const map = { name: 'name', sku: 'sku', category: 'category', qty: 'qty', reorder: 'reorder', price: 'price', value: 'value', updated: 'updated' };
      const k = map[key];
      if (!k) return;
      const asc = filters.sort === k + '-asc';
      filters.sort = k + '-' + (asc ? 'desc' : 'asc');
      $('#sortBy').value = filters.sort;
      renderTable();
    });
  });

  // upload
  const dz = $('#dropzone');
  const fileInput = $('#fileInput');
  $('#browseBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => { readFile(e.target.files[0]); fileInput.value = ''; });
  dz.addEventListener('click', (e) => { if (e.target === dz || e.target.classList.contains('dropzone-emoji')) fileInput.click(); });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) readFile(e.dataTransfer.files[0]); });
  $('#downloadTemplate').addEventListener('click', downloadTemplate);

  // sidebar actions
  $('#sidebarExport').addEventListener('click', exportCSV);
  $('#sidebarDemo').addEventListener('click', loadSample);
  $('#sidebarClear').addEventListener('click', clearAll);
}

/* ---------------- Boot ---------------- */
function init() {
  load();
  initEvents();
  refreshAll();
  switchView('dashboard');
}

document.addEventListener('DOMContentLoaded', init);