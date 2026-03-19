<style>
/* ─── Toolbar ────────────────────────────────────────── */
.budget-dashboard .tl-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75em;
  padding: 0.45em 0.75em;
  margin-bottom: 1.5em;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
}
.budget-dashboard .tl-tab-group {
  display: flex;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.budget-dashboard .tl-tab-btn {
  padding: 0.28em 1.1em;
  background: transparent;
  border: none;
  border-right: 1px solid var(--background-modifier-border);
  cursor: pointer;
  font-size: 0.88em;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
}
.budget-dashboard .tl-tab-btn:last-child { border-right: none; }
.budget-dashboard .tl-sep {
  width: 1px;
  height: 1.2em;
  background: var(--background-modifier-border);
  flex-shrink: 0;
}
.budget-dashboard .tl-spacer { flex: 1; }
.budget-dashboard .tl-today-btn {
  padding: 0.25em 0.75em;
  border-radius: 5px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  cursor: pointer;
  font-size: 0.82em;
  color: var(--text-normal);
  font-weight: 500;
  flex-shrink: 0;
}
.budget-dashboard .tl-today-btn:hover { background: var(--interactive-hover); }

/* ─── Sections ───────────────────────────────────────── */
.budget-dashboard .budget-section {
  margin-bottom: 1.25em;
  padding: 1em 1.25em;
  border: 1px solid var(--background-modifier-border);
  border-radius: 10px;
  background: var(--background-secondary);
}
.budget-dashboard .tl-section-blue   { border-left: 3px solid rgba(100, 140, 220, 0.6); }
.budget-dashboard .tl-section-purple { border-left: 3px solid rgba(160, 100, 220, 0.6); }
.budget-dashboard .budget-inner-header {
  margin-bottom: 0.85em;
  padding-bottom: 0.5em;
  border-bottom: 1px solid var(--background-modifier-border);
}
.budget-dashboard .budget-inner-title {
  font-size: 0.7em;
  font-weight: 700;
  margin: 0;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.budget-dashboard .budget-section-title {
  font-size: 0.7em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin: 1.25em 0 0.5em;
}

/* ─── Nav ────────────────────────────────────────────── */
.budget-dashboard .budget-nav {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
.budget-dashboard .budget-nav-label {
  font-size: 0.95em;
  font-weight: 600;
  min-width: 8.5em;
  text-align: center;
  color: var(--text-normal);
}
.budget-dashboard .budget-nav-btn {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 5px;
  padding: 0.12em 0.55em;
  cursor: pointer;
  font-size: 0.85em;
  color: var(--text-muted);
}
.budget-dashboard .budget-nav-btn:hover {
  background: var(--interactive-hover);
  color: var(--text-normal);
}

/* ─── Summary table ──────────────────────────────────── */
.budget-dashboard .budget-summary-table {
  margin-bottom: 1.25em;
}
.budget-dashboard .budget-summary-table thead th {
  font-size: 0.68em !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint) !important;
  font-weight: 600;
  text-align: center !important;
}
.budget-dashboard .budget-summary-table tbody td {
  font-size: 1.45em;
  font-weight: 800;
  text-align: center !important;
  padding: 0.55em 1em !important;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  border-bottom: none !important;
}
.budget-dashboard .budget-positive { color: var(--color-green); }
.budget-dashboard .budget-negative { color: var(--color-red); }

/* ─── Tables ─────────────────────────────────────────── */
.budget-dashboard .budget-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.9em;
  margin-bottom: 0.5em;
}
.budget-dashboard .budget-table thead th {
  text-align: right;
  padding: 0.45em 0.85em;
  color: var(--text-faint);
  font-weight: 600;
  font-size: 0.7em;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--background-modifier-form-field);
  border-bottom: 1px solid var(--background-modifier-border);
}
.budget-dashboard .budget-table thead th:first-child { text-align: left; }
.budget-dashboard .budget-table tbody td {
  text-align: right;
  padding: 0.5em 0.85em;
  border-bottom: 1px solid var(--background-modifier-border-hover);
  font-variant-numeric: tabular-nums;
}
.budget-dashboard .budget-table tbody td:first-child { text-align: left; }
.budget-dashboard .budget-table tbody tr:last-child td { border-bottom: none; }
.budget-dashboard .budget-table tbody tr:hover td { background: var(--background-modifier-hover); }
.budget-dashboard .budget-table tfoot td {
  text-align: right;
  padding: 0.65em 0.85em 0.35em;
  font-weight: 800;
  font-size: 1.0em;
  color: var(--text-accent);
  font-variant-numeric: tabular-nums;
  border-top: 2px solid var(--background-modifier-border);
}
.budget-dashboard .budget-table tfoot td:first-child { text-align: left; }
</style>

```dataviewjs
// ═══════════════════════════════════════════════════════════════
// PURE LOGIC — no DataviewJS/Obsidian dependencies
// (these functions move unchanged into the plugin)
// ═══════════════════════════════════════════════════════════════

// Number of months a record is active within a given year.
function monthsActiveInYear(record, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31);
  if (record.date > yearEnd) return 0;
  if (record.valid_until && record.valid_until < yearStart) return 0;
  const start = record.date > yearStart ? record.date : yearStart;
  const end   = record.valid_until && record.valid_until < yearEnd ? record.valid_until : yearEnd;
  return end.getMonth() - start.getMonth() + 1;
}

// Annualised value of a budget or repeating record.
// annual costs are lump sums (amortised ÷12 per month); monthly costs scale by months active.
function annualValue(record, year) {
  if (record.periodicity === 'annual') {
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31);
    if (record.date > yearEnd) return 0;
    if (record.valid_until && record.valid_until < yearStart) return 0;
    return record.amount;
  }
  return record.amount * monthsActiveInYear(record, year);
}

// Monthly value of a budget or repeating record for a given year+month (0-indexed).
function monthlyValue(record, year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  if (record.date > monthEnd) return 0;
  if (record.valid_until && record.valid_until < monthStart) return 0;
  return record.periodicity === 'annual' ? record.amount / 12 : record.amount;
}

// Months a record has been active up to and including the current month.
function monthsToDate(record, year) {
  const now      = new Date();
  const nowYear  = now.getFullYear();
  const nowMonth = now.getMonth();
  if (year > nowYear) return 0;
  const effectiveEnd = year < nowYear ? 11 : nowMonth;
  const yearStart  = new Date(year, 0, 1);
  const yearEnd    = new Date(year, effectiveEnd, 1);
  if (record.date > yearEnd) return 0;
  if (record.valid_until && record.valid_until < yearStart) return 0;
  const start = record.date > yearStart ? record.date : yearStart;
  const end   = record.valid_until && record.valid_until < yearEnd ? record.valid_until : yearEnd;
  return end.getMonth() - start.getMonth() + 1;
}

// Spend records falling within a given year+month (0-indexed).
function spendInMonth(records, year, month) {
  return records.filter(r =>
    r.spend_type === 'actual_spend' &&
    r.date.getFullYear() === year &&
    r.date.getMonth() === month
  );
}

const CURRENCY = '€';

function fmtCat(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmt(n) {
  return CURRENCY + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const CAT_ORDER  = ['monthly', 'annual'];
const CAT_LABELS = {
  monthly: 'Monthly',
  annual:  'Annual',
};

function sumByCategory(records, valueFn) {
  const out = Object.fromEntries(CAT_ORDER.map(c => [c, 0]));
  records.forEach(r => { if (r.periodicity in out) out[r.periodicity] += valueFn(r); });
  return out;
}

// ═══════════════════════════════════════════════════════════════
// DATA LOADING — Dataview/Obsidian API (swap for plugin.app on migration)
// ═══════════════════════════════════════════════════════════════

function parseDate(str) {
  if (!str || !String(str).trim()) return null;
  const [y, m, d] = String(str).trim().split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Parse the yaml fenced block from a file's body into record objects.
function parseRecordsBlock(text) {
  const records = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*-\s+date:/.test(line)) {
      if (current) records.push(current);
      current = {};
    }
    if (current) {
      const m = line.match(/^\s*-?\s*([\w_]+):\s*(.+)$/);
      if (m) current[m[1]] = m[2].trim();
    }
  }
  if (current) records.push(current);
  return records
    .filter(r => r.date)
    .map(r => ({
      ...r,
      amount:      parseFloat(r.amount) || 0,
      date:        parseDate(r.date),
      valid_until: parseDate(r.valid_until) || null,
    }));
}

async function loadYear(year) {
  const page = dv.pages('"budget"')
    .where(p => p.tl_type === 'record' && p.year === year)
    .first();
  if (!page) return [];
  const content = await app.vault.read(app.vault.getAbstractFileByPath(page.file.path));
  const match = content.match(/```yaml\n([\s\S]*?)\n```/);
  return match ? parseRecordsBlock(match[1]) : [];
}

// ═══════════════════════════════════════════════════════════════
// RENDERING — DataviewJS DOM (swap for ItemView on migration)
// ═══════════════════════════════════════════════════════════════

function renderNavBar(parent, label, onPrev, onNext) {
  const bar = parent.createEl('div', { cls: 'budget-nav' });
  const prev = bar.createEl('button', { text: '◀', cls: 'budget-nav-btn' });
  bar.createEl('span', { text: label, cls: 'budget-nav-label' });
  const next = bar.createEl('button', { text: '▶', cls: 'budget-nav-btn' });
  prev.onclick = onPrev;
  next.onclick = onNext;
}

function renderSummaryCards(parent, cols) {
  const table = parent.createEl('table', { cls: 'budget-table budget-summary-table' });
  const thead = table.createEl('thead').createEl('tr');
  const tbody = table.createEl('tbody').createEl('tr');
  cols.forEach(({ label, value }) => {
    thead.createEl('th', { text: label });
    tbody.createEl('td', { text: value });
  });
}

function renderSpendByCategoryTable(parent, spendRecords) {
  if (spendRecords.length === 0) return;
  const totals = {};
  spendRecords.forEach(r => {
    const cat = r.spend_category || '(uncategorised)';
    totals[cat] = (totals[cat] || 0) + r.amount;
  });
  const table = parent.createEl('table', { cls: 'budget-table' });
  const hr = table.createEl('thead').createEl('tr');
  ['Category', 'Amount'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  let total = 0;
  Object.entries(totals).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
    total += amount;
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: fmtCat(cat) });
    tr.createEl('td', { text: fmt(amount) });
  });
  const tr = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(total)].forEach(val => tr.createEl('td', { text: val }));
}

function renderCommitmentsTable(parent, records, year) {
  const table = parent.createEl('table', { cls: 'budget-table' });
  const hr = table.createEl('thead').createEl('tr');
  ['Description', 'Per Month'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  let tMonthly = 0;

  records
    .filter(r => (r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate') && r.periodicity === 'monthly')
    .forEach(r => {
      const monthly = r.amount;
      tMonthly += monthly;
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: r.description });
      tr.createEl('td', { text: fmt(monthly) });
    });

  const tr = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(tMonthly)].forEach(val => tr.createEl('td', { text: val }));
}

function renderAnnual(blueContainer, purpleContainer, records, year) {
  blueContainer.empty();
  purpleContainer.empty();

  const committed = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const spend     = records.filter(r => r.spend_type === 'actual_spend');

  const rows = [
    {
      label:   'Annual Costs',
      total:   committed.filter(r => r.periodicity === 'annual').reduce((s, r) => s + annualValue(r, year), 0),
      spent:   spend.filter(r => r.periodicity === 'annual').reduce((s, r) => s + r.amount, 0),
    },
    {
      label:   'Monthly Fixed Costs',
      total:   committed.filter(r => r.periodicity === 'monthly').reduce((s, r) => s + annualValue(r, year), 0),
      spent:   spend.filter(r => r.periodicity === 'monthly').reduce((s, r) => s + r.amount, 0),
    },
  ];

  const table = blueContainer.createEl('table', { cls: 'budget-table' });
  const hr = table.createEl('thead').createEl('tr');
  ['Frequency', 'Total', 'Spend To Date', 'Remaining Commitment'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');

  rows.forEach(({ label, total, spent }) => {
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: label });
    tr.createEl('td', { text: fmt(total) });
    tr.createEl('td', { text: fmt(spent) });
    tr.createEl('td', { text: fmt(total - spent) });
  });

  const tTotal = rows.reduce((s, r) => s + r.total, 0);
  const tSpent = rows.reduce((s, r) => s + r.spent, 0);
  const tr = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(tTotal), fmt(tSpent), fmt(tTotal - tSpent)].forEach(val => tr.createEl('td', { text: val }));

  // Detailed breakdown — one row per committed record
  const spendByCat = {};
  spend.forEach(r => {
    const cat = r.spend_category || '';
    spendByCat[cat] = (spendByCat[cat] || 0) + r.amount;
  });

  function renderDetailTable(parent, subtitle, records, spentFn) {
    parent.createEl('div', { text: subtitle, cls: 'budget-section-title' });
    const table = parent.createEl('table', { cls: 'budget-table' });
    const hr = table.createEl('thead').createEl('tr');
    ['Category', 'Total', 'Spend To Date', 'Remaining Commitment'].forEach(h => hr.createEl('th', { text: h }));
    const tbody = table.createEl('tbody');
    records.forEach(r => {
      const total = annualValue(r, year);
      const spent = spentFn(r);
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: fmtCat(r.spend_category) });
      tr.createEl('td', { text: fmt(total) });
      tr.createEl('td', { text: spent ? fmt(spent) : '—' });
      tr.createEl('td', { text: fmt(total - spent) });
    });
  }

  renderDetailTable(blueContainer,   'Annual Costs Detail',        committed.filter(r => r.periodicity === 'annual'),  r => spendByCat[r.spend_category] || 0);
  renderDetailTable(purpleContainer, 'Monthly Fixed Costs Detail', committed.filter(r => r.periodicity === 'monthly'), r => monthsToDate(r, year) * r.amount);
}

function renderMonthSpendList(parent, spendRecords) {
  if (spendRecords.length === 0) return;
  parent.createEl('div', { text: "This Month's Transactions", cls: 'budget-section-title' });
  const table = parent.createEl('table', { cls: 'budget-table' });
  const hr = table.createEl('thead').createEl('tr');
  ['Date', 'Description', 'Category', 'Amount'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  [...spendRecords]
    .sort((a, b) => a.date - b.date)
    .forEach(r => {
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: r.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
      tr.createEl('td', { text: r.description });
      tr.createEl('td', { text: fmtCat(r.spend_category) });
      tr.createEl('td', { text: fmt(r.amount) });
    });
}

function renderMonth(cardsContainer, spendContainer, dayInfoEl, records, year, month) {
  cardsContainer.empty();
  spendContainer.empty();

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  if (isCurrentMonth) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    dayInfoEl.textContent = `Day ${now.getDate()} of ${daysInMonth} — month in progress`;
    dayInfoEl.style.display = '';
  } else {
    dayInfoEl.style.display = 'none';
  }

  const committed  = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const monthSpend = spendInMonth(records, year, month);

  const committedByCat = sumByCategory(committed,  r => monthlyValue(r, year, month));
  const spentByCat     = sumByCategory(monthSpend, r => r.amount);

  const totalCommitted = Object.values(committedByCat).reduce((a, b) => a + b, 0);
  const totalSpent     = Object.values(spentByCat).reduce((a, b) => a + b, 0);

  const annualInstallment = committedByCat.annual  || 0;
  const fixedCosts        = committedByCat.monthly || 0;
  renderSummaryCards(cardsContainer, [
    { label: 'Annual Costs Installment', value: fmt(annualInstallment) },
    { label: 'Fixed Costs',              value: fmt(fixedCosts)        },
    { label: 'Spend This Month',         value: fmt(totalSpent)        },
    { label: 'Total',                    value: fmt(annualInstallment + fixedCosts + totalSpent) },
  ]);
  renderMonthSpendList(spendContainer, monthSpend);
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATION — state, cache, wiring
// ═══════════════════════════════════════════════════════════════

const now = new Date();
const state = {
  year:       now.getFullYear(),
  month:      now.getMonth(),   // 0-indexed
  annualYear: now.getFullYear(),
  activeTab:  'monthly',
};

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];


const root = dv.container;
root.addClass('budget-dashboard');

// Inject CSS via JS — more reliable than <style> tag in DataviewJS context
const styleEl = document.createElement('style');
styleEl.textContent = `
  .budget-dashboard .tl-toolbar {
    display:flex !important; align-items:center; gap:0.75em;
    padding:0.45em 0.75em; margin-bottom:1.5em;
    background:var(--background-secondary);
    border:1px solid var(--background-modifier-border); border-radius:8px;
  }
  .budget-dashboard .tl-tab-group { display:flex !important; border:1px solid var(--background-modifier-border); border-radius:6px; overflow:hidden; }
  .budget-dashboard .tl-tab-btn { padding:0.28em 1.1em; background:transparent; border:none; border-right:1px solid var(--background-modifier-border); cursor:pointer; font-size:0.88em; font-weight:500; color:var(--text-muted); white-space:nowrap; }
  .budget-dashboard .tl-tab-btn:last-child { border-right:none; }
  .budget-dashboard .tl-sep { width:1px; height:1.2em; background:var(--background-modifier-border); flex-shrink:0; }
  .budget-dashboard .tl-spacer { flex:1; }
  .budget-dashboard .tl-today-btn { padding:0.25em 0.75em; border-radius:5px; border:1px solid var(--background-modifier-border); background:var(--background-primary); cursor:pointer; font-size:0.82em; font-weight:500; flex-shrink:0; }
  .budget-dashboard .tl-section-blue   { border-left:3px solid rgba(100,140,220,0.7) !important; }
  .budget-dashboard .tl-section-purple { border-left:3px solid rgba(160,100,220,0.7) !important; }
  .budget-dashboard .budget-table thead th { background:var(--background-modifier-form-field) !important; }
  .budget-dashboard .budget-section { background:var(--background-secondary) !important; }
  .budget-dashboard .budget-table { table-layout:fixed !important; width:100% !important; }
  .budget-dashboard .budget-summary-table tbody td { font-variant-numeric:tabular-nums; }
  .budget-dashboard .budget-table tbody td { font-variant-numeric:tabular-nums; }
  .budget-dashboard .budget-table tfoot td { font-variant-numeric:tabular-nums; }
`;
document.head.appendChild(styleEl);

const INNER_HEADER_CLS = 'budget-inner-header';
const INNER_TITLE_CLS  = 'budget-inner-title';

// Toolbar: [Monthly | Annual]  |  [nav]  [Today]
const toolbar    = root.createEl('div', { cls: 'tl-toolbar', attr: { style: 'display:flex;align-items:center' } });
const tabGroup   = toolbar.createEl('div', { cls: 'tl-tab-group', attr: { style: 'display:flex' } });
const monthTabBtn  = tabGroup.createEl('button', { text: 'Monthly', cls: 'tl-tab-btn' });
const annualTabBtn = tabGroup.createEl('button', { text: 'Annual',  cls: 'tl-tab-btn' });
toolbar.createEl('div', { cls: 'tl-sep' });
const monthNav  = toolbar.createEl('div', { attr: { style: 'display:flex;align-items:center;flex-shrink:0' } });
const annualNav = toolbar.createEl('div', { attr: { style: 'display:none;align-items:center;flex-shrink:0' } });
toolbar.createEl('div', { cls: 'tl-spacer', attr: { style: 'flex:1' } });
const todayBtn  = toolbar.createEl('button', { text: 'Today', cls: 'tl-today-btn' });

// Monthly outer (invisible container)
const monthlyOuter = root.createEl('div');
const dayInfoEl    = monthlyOuter.createEl('div', { attr: { style: 'font-size:0.8em;color:var(--text-muted);margin:0 0 0.75em;text-align:right;display:none' } });

const commitSection = monthlyOuter.createEl('div', { cls: 'budget-section tl-section-blue' });
commitSection.createEl('div', { cls: INNER_HEADER_CLS })
  .createEl('span', { text: 'Summary', cls: INNER_TITLE_CLS });
const cardsContent  = commitSection.createEl('div');
commitSection.createEl('div', { text: 'Fixed Costs Detail', cls: 'budget-section-title' });
const commitContent = commitSection.createEl('div');

const spendSection  = monthlyOuter.createEl('div', { cls: 'budget-section tl-section-purple' });
spendSection.createEl('div', { cls: INNER_HEADER_CLS })
  .createEl('span', { text: 'Transactions', cls: INNER_TITLE_CLS });
const spendContent  = spendSection.createEl('div');

// Annual outer (invisible container)
const annualOuter         = root.createEl('div', { attr: { style: 'display:none' } });
const annualBlueSection   = annualOuter.createEl('div', { cls: 'budget-section tl-section-blue' });
annualBlueSection.createEl('div', { cls: INNER_HEADER_CLS })
  .createEl('span', { text: 'Summary', cls: INNER_TITLE_CLS });
const annualBlueContent   = annualBlueSection.createEl('div');
const annualPurpleSection = annualOuter.createEl('div', { cls: 'budget-section tl-section-purple' });
annualPurpleSection.createEl('div', { cls: INNER_HEADER_CLS })
  .createEl('span', { text: 'Planned Fixed Costs', cls: INNER_TITLE_CLS });
const annualPurpleContent = annualPurpleSection.createEl('div');

function setTabActive(btn, active) {
  btn.style.background = active ? 'var(--interactive-accent)' : '';
  btn.style.color      = active ? 'var(--text-on-accent)'     : '';
  btn.style.fontWeight = active ? '700'                        : '';
}

function showTab(tab) {
  state.activeTab = tab;
  monthlyOuter.style.display = tab === 'monthly' ? '' : 'none';
  annualOuter.style.display  = tab === 'annual'  ? '' : 'none';
  monthNav.style.display     = tab === 'monthly' ? 'flex' : 'none';
  annualNav.style.display    = tab === 'annual'  ? 'flex' : 'none';
  setTabActive(monthTabBtn, tab === 'monthly');
  setTabActive(annualTabBtn, tab === 'annual');
}

monthTabBtn.onclick  = () => showTab('monthly');
annualTabBtn.onclick = () => showTab('annual');
todayBtn.onclick     = () => {
  state.year  = now.getFullYear();
  state.month = now.getMonth();
  showTab('monthly');
  refreshMonth();
};

async function refreshAnnual() {
  const records = await loadYear(state.annualYear);
  annualNav.empty();
  renderNavBar(annualNav, String(state.annualYear),
    () => { state.annualYear--; refreshAnnual(); },
    () => { state.annualYear++; refreshAnnual(); }
  );
  renderAnnual(annualBlueContent, annualPurpleContent, records, state.annualYear);
}

async function refreshMonth() {
  const records = await loadYear(state.year);
  monthNav.empty();
  renderNavBar(monthNav, `${MONTH_NAMES[state.month]} ${state.year}`,
    () => {
      state.month--;
      if (state.month < 0) { state.month = 11; state.year--; }
      refreshMonth();
    },
    () => {
      state.month++;
      if (state.month > 11) { state.month = 0; state.year++; }
      refreshMonth();
    }
  );
  renderMonth(cardsContent, spendContent, dayInfoEl, records, state.year, state.month);
  commitContent.empty();
  renderCommitmentsTable(commitContent, records, state.year);
}

showTab('monthly');
await refreshAnnual();
await refreshMonth();
```
