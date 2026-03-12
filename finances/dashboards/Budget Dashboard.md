<style>
.budget-dashboard .budget-section {
  margin-bottom: 2em;
  padding: 1em 1.25em;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
}
.budget-dashboard .budget-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1em;
  padding-bottom: 0.75em;
  border-bottom: 2px solid var(--background-modifier-border);
}
.budget-dashboard .budget-nav {
  display: flex;
  align-items: center;
  gap: 0.75em;
}
.budget-dashboard .budget-nav-label {
  font-size: 1.1em;
  font-weight: 600;
  min-width: 6em;
  text-align: center;
}
.budget-dashboard .budget-nav-btn {
  background: var(--interactive-normal);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 0.2em 0.6em;
  cursor: pointer;
  font-size: 0.9em;
}
.budget-dashboard .budget-nav-btn:hover { background: var(--interactive-hover); }
.budget-dashboard .budget-cards {
  display: flex;
  gap: 0.75em;
  margin-bottom: 1.25em;
  flex-wrap: wrap;
}
.budget-dashboard .budget-card {
  flex: 1;
  min-width: 110px;
  padding: 0.6em 0.9em;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
}
.budget-dashboard .budget-card-label {
  font-size: 0.75em;
  color: var(--text-muted);
  margin-bottom: 0.2em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.budget-dashboard .budget-card-value {
  font-size: 1.2em;
  font-weight: 600;
}
.budget-dashboard .budget-positive { color: var(--color-green); }
.budget-dashboard .budget-negative { color: var(--color-red); }
.budget-dashboard .budget-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
  margin-bottom: 1.25em;
}
.budget-dashboard .budget-table th {
  text-align: right;
  padding: 0.4em 0.75em;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.85em;
  border-bottom: 1px solid var(--background-modifier-border);
}
.budget-dashboard .budget-table td {
  text-align: right;
  padding: 0.45em 0.75em;
  border-bottom: 1px solid var(--background-modifier-border-subtle, var(--background-modifier-border));
}
.budget-dashboard .budget-table th:first-child,
.budget-dashboard .budget-table td:first-child { text-align: left; }
.budget-dashboard .budget-total-row td {
  font-weight: 600;
  border-top: 2px solid var(--background-modifier-border);
  border-bottom: none;
}
.budget-dashboard .budget-summary-table td {
  font-size: 1.2em;
  font-weight: 600;
  padding-top: 0.3em;
  padding-bottom: 0.75em;
}
.budget-dashboard .budget-section-heading {
  font-size: 1.3em;
  font-weight: 700;
  color: var(--text-normal);
  margin: 0;
}
.budget-dashboard .budget-section-title {
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin: 1.25em 0 0.5em;
}
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
// fixed_annual and epic are lump sums; monthly categories scale by months active.
function annualValue(record, year) {
  if (record.category === 'fixed_annual' || record.category === 'epic') {
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
  return record.category === 'fixed_annual' ? record.amount / 12 : record.amount;
}

// Spend records falling within a given year+month (0-indexed).
function spendInMonth(records, year, month) {
  return records.filter(r =>
    r.kind === 'spend' &&
    r.date.getFullYear() === year &&
    r.date.getMonth() === month
  );
}

function fmt(n) {
  return '£' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const CAT_ORDER  = ['monthly_fixed', 'monthly_variable', 'fixed_annual', 'epic'];
const CAT_LABELS = {
  monthly_fixed:    'Monthly Fixed',
  monthly_variable: 'Monthly Variable',
  fixed_annual:     'Fixed Annual',
  epic:             'Epic Projects',
};

function sumByCategory(records, valueFn) {
  const out = Object.fromEntries(CAT_ORDER.map(c => [c, 0]));
  records.forEach(r => { if (r.category in out) out[r.category] += valueFn(r); });
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
  const page = dv.pages('"finances/budget"')
    .where(p => p.budget_record && p.year === year)
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

function renderSummaryCards(parent, budgeted, committed, spent) {
  const remaining = budgeted - spent;
  const cols = [
    { label: 'Budgeted',  value: fmt(budgeted),  positive: null },
    { label: 'Committed', value: fmt(committed), positive: null },
    { label: 'Spent',     value: fmt(spent),     positive: null },
    { label: 'Remaining', value: fmt(remaining), positive: remaining >= 0 },
  ];
  const table = parent.createEl('table', { cls: 'budget-table budget-summary-table' });
  const thead = table.createEl('thead').createEl('tr');
  const tbody = table.createEl('tbody').createEl('tr');
  cols.forEach(({ label, value, positive }) => {
    thead.createEl('th', { text: label });
    const td = tbody.createEl('td', { text: value });
    if (positive === true)  td.addClass('budget-positive');
    if (positive === false) td.addClass('budget-negative');
  });
}

function renderCategoryTable(parent, budgetByCat, committedByCat, spentByCat) {
  const table = parent.createEl('table', { cls: 'budget-table' });
  const hr = table.createEl('thead').createEl('tr');
  ['Category', 'Budgeted', 'Committed', 'Spent', 'Remaining'].forEach(h =>
    hr.createEl('th', { text: h })
  );
  const tbody = table.createEl('tbody');
  let [tB, tC, tS] = [0, 0, 0];

  CAT_ORDER.forEach(cat => {
    const b = budgetByCat[cat] || 0;
    const c = committedByCat[cat] || 0;
    const s = spentByCat[cat] || 0;
    const rem = b - s;
    tB += b; tC += c; tS += s;

    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: CAT_LABELS[cat] });
    tr.createEl('td', { text: b ? fmt(b) : '—' });
    tr.createEl('td', { text: c ? fmt(c) : '—' });
    tr.createEl('td', { text: s ? fmt(s) : '—' });
    const remTd = tr.createEl('td', { text: b ? fmt(rem) : '—' });
    if (b) remTd.addClass(rem >= 0 ? 'budget-positive' : 'budget-negative');
  });

  const totRem = tB - tS;
  const tr = table.createEl('tfoot').createEl('tr', { cls: 'budget-total-row' });
  tr.createEl('td', { text: 'Total' });
  tr.createEl('td', { text: fmt(tB) });
  tr.createEl('td', { text: fmt(tC) });
  tr.createEl('td', { text: fmt(tS) });
  const remTd = tr.createEl('td', { text: fmt(totRem) });
  remTd.addClass(totRem >= 0 ? 'budget-positive' : 'budget-negative');
}

function renderCommitmentsTable(parent, records, year) {
  parent.createEl('div', { text: 'Repeating Commitments', cls: 'budget-section-title' });
  const table = parent.createEl('table', { cls: 'budget-table' });
  const hr = table.createEl('thead').createEl('tr');
  ['Description', 'Category', 'Per Month', 'Annual Total'].forEach(h =>
    hr.createEl('th', { text: h })
  );
  const tbody = table.createEl('tbody');

  records
    .filter(r => r.kind === 'repeating')
    .sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category))
    .forEach(r => {
      const monthly = r.category === 'fixed_annual' ? r.amount / 12 : r.amount;
      const annual  = annualValue(r, year);
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: r.description });
      tr.createEl('td', { text: CAT_LABELS[r.category] });
      tr.createEl('td', { text: fmt(monthly) });
      tr.createEl('td', { text: fmt(annual) });
    });
}

function renderAnnual(container, records, year) {
  container.empty();

  const budget    = records.filter(r => r.kind === 'budget');
  const repeating = records.filter(r => r.kind === 'repeating');
  const spend     = records.filter(r => r.kind === 'spend');

  const budgetByCat    = sumByCategory(budget,    r => annualValue(r, year));
  const committedByCat = sumByCategory(repeating, r => annualValue(r, year));
  const spentByCat     = sumByCategory(spend,     r => r.amount);

  const totalBudgeted  = Object.values(budgetByCat).reduce((a, b) => a + b, 0);
  const totalCommitted = Object.values(committedByCat).reduce((a, b) => a + b, 0);
  const totalSpent     = Object.values(spentByCat).reduce((a, b) => a + b, 0);

  renderSummaryCards(container, totalBudgeted, totalCommitted, totalSpent);
  renderCategoryTable(container, budgetByCat, committedByCat, spentByCat);
}

function renderMonthSpendList(parent, spendRecords) {
  if (spendRecords.length === 0) return;
  parent.createEl('div', { text: 'Transactions', cls: 'budget-section-title' });
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
      tr.createEl('td', { text: CAT_LABELS[r.category] || r.category });
      tr.createEl('td', { text: fmt(r.amount) });
    });
}

function renderMonth(container, records, year, month) {
  container.empty();

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const budget     = records.filter(r => r.kind === 'budget');
  const repeating  = records.filter(r => r.kind === 'repeating');
  const monthSpend = spendInMonth(records, year, month);

  const budgetByCat    = sumByCategory(budget,    r => monthlyValue(r, year, month));
  const committedByCat = sumByCategory(repeating, r => monthlyValue(r, year, month));
  const spentByCat     = sumByCategory(monthSpend, r => r.amount);

  const totalBudget    = Object.values(budgetByCat).reduce((a, b) => a + b, 0);
  const totalCommitted = Object.values(committedByCat).reduce((a, b) => a + b, 0);
  const totalSpent     = Object.values(spentByCat).reduce((a, b) => a + b, 0);

  if (isCurrentMonth) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    container.createEl('div', {
      text: `Day ${now.getDate()} of ${daysInMonth} — month in progress`,
      attr: { style: 'font-size: 0.8em; color: var(--text-muted); margin-bottom: 0.75em;' }
    });
  }

  renderSummaryCards(container, totalBudget, totalCommitted, totalSpent);
  renderCategoryTable(container, budgetByCat, committedByCat, spentByCat);
  renderMonthSpendList(container, monthSpend);
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATION — state, cache, wiring
// ═══════════════════════════════════════════════════════════════

const now = new Date();
const state = {
  annualYear: now.getFullYear(),
  monthYear:  now.getFullYear(),
  month:      now.getMonth(),   // 0-indexed
};

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

// loadYear is now synchronous so no cache needed
const root = dv.container;
root.addClass('budget-dashboard');

const HEADER_STYLE  = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:1em;padding-bottom:0.75em;border-bottom:2px solid var(--background-modifier-border)';
const TITLE_STYLE   = 'font-size:1.3em;font-weight:700;margin:0';

const monthSection  = root.createEl('div', { cls: 'budget-section' });
const monthHeader   = monthSection.createEl('div', { attr: { style: HEADER_STYLE } });
monthHeader.createEl('div', { text: 'Monthly View', attr: { style: TITLE_STYLE } });
const monthNav      = monthHeader.createEl('div');
const monthContent  = monthSection.createEl('div');

const commitSection = root.createEl('div', { cls: 'budget-section' });
const commitHeader  = commitSection.createEl('div', { attr: { style: HEADER_STYLE } });
commitHeader.createEl('div', { text: 'Repeating Commitments', attr: { style: TITLE_STYLE } });
const commitNav     = commitHeader.createEl('div');
const commitContent = commitSection.createEl('div');

const annualSection = root.createEl('div', { cls: 'budget-section' });
const annualHeader  = annualSection.createEl('div', { attr: { style: HEADER_STYLE } });
annualHeader.createEl('div', { text: 'Annual View', attr: { style: TITLE_STYLE } });
const annualNav     = annualHeader.createEl('div');
const annualContent = annualSection.createEl('div');

async function refreshAnnual() {
  const records = await loadYear(state.annualYear);
  annualNav.empty();
  commitNav.empty();
  renderNavBar(annualNav, String(state.annualYear),
    () => { state.annualYear--; refreshAnnual(); },
    () => { state.annualYear++; refreshAnnual(); }
  );
  renderNavBar(commitNav, String(state.annualYear),
    () => { state.annualYear--; refreshAnnual(); },
    () => { state.annualYear++; refreshAnnual(); }
  );
  renderAnnual(annualContent, records, state.annualYear);
  commitContent.empty();
  renderCommitmentsTable(commitContent, records, state.annualYear);
}

async function refreshMonth() {
  const records = await loadYear(state.monthYear);
  monthNav.empty();
  renderNavBar(monthNav, `${MONTH_NAMES[state.month]} ${state.monthYear}`,
    () => {
      state.month--;
      if (state.month < 0) { state.month = 11; state.monthYear--; }
      refreshMonth();
    },
    () => {
      state.month++;
      if (state.month > 11) { state.month = 0; state.monthYear++; }
      refreshMonth();
    }
  );
  renderMonth(monthContent, records, state.monthYear, state.month);
}

await refreshAnnual();
await refreshMonth();
```
