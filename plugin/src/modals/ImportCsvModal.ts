import { App, Modal, Notice, Setting, normalizePath, TFile } from 'obsidian';
import type ThriftLensPlugin from '../main';
import type { BudgetEntry } from '../types';
import { parseDate, serialiseEntry } from '../parser';
import { loadYear } from '../loader';
import { splitCsvRow } from '../csvUtils';

// ── CSV parsing ───────────────────────────────────────────────────
// splitCsvRow imported from ../csvUtils

interface ParseResult {
  entries:     BudgetEntry[];
  parseErrors: string[];
}

function parseCsv(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { entries: [], parseErrors: ['File appears to be empty or has no data rows'] };

  const headers  = splitCsvRow(lines[0]).map(h => h.toLowerCase().trim());
  const col      = (name: string) => headers.indexOf(name);
  const dateIdx  = col('date');
  const amountIdx = col('amount');
  const typeIdx  = col('spend_type');
  const catIdx   = col('spend_category');
  const descIdx  = col('description');
  const untilIdx = col('valid_until');

  if ([dateIdx, amountIdx, typeIdx, catIdx, descIdx].some(i => i === -1)) {
    return {
      entries: [],
      parseErrors: ['Missing required column(s). Expected: date, amount, spend_type, spend_category, description'],
    };
  }

  const entries: BudgetEntry[] = [];
  const parseErrors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row     = splitCsvRow(lines[i]);
    const rowNum  = i + 1;
    const get     = (idx: number) => (row[idx] ?? '').trim();

    const date   = parseDate(get(dateIdx));
    const amount = parseFloat(get(amountIdx));
    const type   = get(typeIdx) as BudgetEntry['spend_type'];
    const cat    = get(catIdx);
    const desc   = get(descIdx);
    const untilRaw = untilIdx >= 0 ? get(untilIdx) : '';

    if (!date)         { parseErrors.push(`Row ${rowNum}: invalid date "${get(dateIdx)}"`); continue; }
    if (isNaN(amount)) { parseErrors.push(`Row ${rowNum}: invalid amount "${get(amountIdx)}"`); continue; }
    if (!['monthly_fixed', 'annual_budget', 'actual_spend'].includes(type)) {
      parseErrors.push(`Row ${rowNum}: invalid spend_type "${type}"`); continue;
    }
    if (!cat) { parseErrors.push(`Row ${rowNum}: missing spend_category`); continue; }

    const valid_until = untilRaw ? parseDate(untilRaw) : null;
    entries.push({ date, amount, spend_type: type, spend_category: cat, description: desc, valid_until });
  }

  return { entries, parseErrors };
}

// ── Section-aware insertion ───────────────────────────────────────

const SECTION_MARKERS: Record<BudgetEntry['spend_type'], string> = {
  annual_budget: '# ── Annual budget',
  monthly_fixed: '# ── Monthly fixed',
  actual_spend:  '# ── Actual spend',
};

// Process bottom-to-top so earlier insertion positions stay valid.
const INSERTION_ORDER: BudgetEntry['spend_type'][] = ['actual_spend', 'monthly_fixed', 'annual_budget'];

function insertBySection(content: string, entries: BudgetEntry[]): string {
  const groups = new Map<BudgetEntry['spend_type'], BudgetEntry[]>(
    INSERTION_ORDER.map(t => [t, []]),
  );
  for (const e of entries) groups.get(e.spend_type)!.push(e);

  let result = content;

  for (const type of INSERTION_ORDER) {
    const typeEntries = groups.get(type)!;
    if (typeEntries.length === 0) continue;

    const block = '\n\n' + typeEntries.map(e => serialiseEntry(e)).join('\n\n');
    const marker = SECTION_MARKERS[type];
    const markerPos = result.indexOf(marker);

    if (markerPos === -1) {
      const fence = result.lastIndexOf('\n```');
      if (fence === -1) continue;
      result = result.slice(0, fence) + block + result.slice(fence);
      continue;
    }

    const markerLineEnd = result.indexOf('\n', markerPos) + 1;
    let sectionEnd = result.lastIndexOf('\n```');
    for (const otherType of INSERTION_ORDER) {
      if (otherType === type) continue;
      const otherPos = result.indexOf(SECTION_MARKERS[otherType], markerLineEnd);
      if (otherPos !== -1 && otherPos < sectionEnd) sectionEnd = otherPos;
    }

    const trimmedLen = result.slice(markerLineEnd, sectionEnd).trimEnd().length;
    const insertAt = markerLineEnd + trimmedLen;
    result = result.slice(0, insertAt) + block + result.slice(insertAt);
  }

  return result;
}

// ── Import result ─────────────────────────────────────────────────

interface SkippedEntry {
  year:           number;
  spend_category: string;
  periodicity:    string;
}

interface ImportResult {
  imported: number;
  created:  number;
  skipped:  SkippedEntry[];
}

// ── Modal ─────────────────────────────────────────────────────────

export class ImportCsvModal extends Modal {
  private plugin:  ThriftLensPlugin;
  private csvPath = '';

  constructor(app: App, plugin: ThriftLensPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tl-import-modal');
    contentEl.createEl('h2', { text: 'Import from CSV' });

    contentEl.createEl('p', {
      text: 'Place your CSV in the vault and enter its path below. '
          + 'Required columns: date, amount, spend_type, spend_category, description. '
          + 'Optional: valid_until.',
      cls: 'tl-import-intro',
    });

    new Setting(contentEl)
      .setName('CSV file path')
      .setDesc('Relative to vault root, e.g. imports/expenses.csv')
      .addText(t => t
        .setPlaceholder('imports/expenses.csv')
        .onChange(v => { this.csvPath = v.trim(); }));

    new Setting(contentEl)
      .addButton(b => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(b => b.setButtonText('Create template').onClick(() => this.createTemplate()))
      .addButton(b => b.setButtonText('Import').setCta().onClick(() => this.run()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  // ── Create template ───────────────────────────────────────────

  private async createTemplate(): Promise<void> {
    if (!this.csvPath) { new Notice('Enter a file path for the template'); return; }
    const path = normalizePath(this.csvPath);
    if (this.app.vault.getFileByPath(path)) { new Notice(`File already exists: ${this.csvPath}`); return; }
    const header = 'date,amount,spend_type,periodicity,spend_category,description,valid_until\n';
    await this.app.vault.create(path, header);
    new Notice(`Template created: ${this.csvPath}`);
    this.close();
  }

  // ── Run ───────────────────────────────────────────────────────

  private async run(): Promise<void> {
    if (!this.csvPath) { new Notice('Enter a CSV file path'); return; }

    const file = this.app.vault.getFileByPath(normalizePath(this.csvPath));
    if (!(file instanceof TFile)) { new Notice(`File not found: ${this.csvPath}`); return; }

    const raw = await this.app.vault.read(file);
    const { entries, parseErrors } = parseCsv(raw);

    if (entries.length === 0 && parseErrors.length === 0) {
      new Notice('No entries found in CSV');
      return;
    }

    const result = entries.length > 0 ? await this.doImport(entries) : { imported: 0, created: 0, skipped: [] };
    this.renderSummary(result, parseErrors);
  }

  private async doImport(entries: BudgetEntry[]): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, created: 0, skipped: [] };
    const folder = this.plugin.settings.dataFolder;

    // Group by year
    const byYear = new Map<number, BudgetEntry[]>();
    for (const e of entries) {
      const y = e.date.getFullYear();
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(e);
    }

    for (const [year, yearEntries] of byYear) {
      await this.plugin.ensureDataFolder();

      const path = normalizePath(`${folder}/${year}.md`);
      const fileExists = !!this.app.vault.getFileByPath(path);

      // Build conflict key set from existing planned entries
      const existing = await loadYear(this.app, folder, year);
      const plannedKey = (e: BudgetEntry) =>
        `${e.spend_category}|${e.description.toLowerCase().trim()}`;

      const plannedKeys = new Set(
        existing
          .filter(e => e.spend_type === 'monthly_fixed' || e.spend_type === 'annual_budget')
          .map(plannedKey),
      );

      // Partition: append vs skip
      const toAppend: BudgetEntry[] = [];
      for (const e of yearEntries) {
        if (e.spend_type === 'monthly_fixed' || e.spend_type === 'annual_budget') {
          const key = plannedKey(e);
          if (plannedKeys.has(key)) {
            result.skipped.push({ year, spend_category: e.spend_category, periodicity: e.periodicity });
            continue;
          }
          plannedKeys.add(key); // block CSV-internal duplicates too
        }
        toAppend.push(e);
      }

      if (toAppend.length === 0) continue;

      if (!fileExists) {
        const scaffold = [
          '---', 'tl_type: register', `year: ${year}`, '---', '',
          '```yaml',
          '# ── Annual budget ──────────────────────────────────', '',
          '# ── Monthly fixed ─────────────────────────────────', '',
          '# ── Actual spend ──────────────────────────────────',
          '```', '',
        ].join('\n');
        await this.app.vault.create(path, scaffold);
        result.created++;
      }

      const target = this.app.vault.getFileByPath(path)!;
      await this.app.vault.process(target, content => insertBySection(content, toAppend));

      result.imported += toAppend.length;
    }

    return result;
  }

  // ── Summary ───────────────────────────────────────────────────

  private renderSummary(result: ImportResult, parseErrors: string[]): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Import complete' });

    const createdNote = result.created > 0
      ? ` (${result.created} register${result.created > 1 ? 's' : ''} created)`
      : '';
    contentEl.createEl('p', { text: `${result.imported} entries imported${createdNote}.` });

    if (result.skipped.length > 0) {
      contentEl.createEl('p', {
        text: `${result.skipped.length} planned entr${result.skipped.length > 1 ? 'ies' : 'y'} skipped — already present in register:`,
        cls: 'tl-import-warn',
      });
      const list = contentEl.createEl('ul', { cls: 'tl-import-list' });
      result.skipped.forEach(s =>
        list.createEl('li', { text: `${s.year}: ${s.spend_category} / ${s.periodicity}` }),
      );
    }

    if (parseErrors.length > 0) {
      contentEl.createEl('p', {
        text: `${parseErrors.length} row${parseErrors.length > 1 ? 's' : ''} could not be parsed:`,
        cls: 'tl-import-warn',
      });
      const list = contentEl.createEl('ul', { cls: 'tl-import-list' });
      parseErrors.forEach(e => list.createEl('li', { text: e }));
    }

    new Setting(contentEl)
      .addButton(b => b.setButtonText('Close').setCta().onClick(() => this.close()));
  }
}
