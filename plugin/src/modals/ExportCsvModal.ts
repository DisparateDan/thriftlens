import { App, Modal, Notice, Setting, normalizePath } from 'obsidian';
import type ThriftLensPlugin from '../main';
import { getAvailableYears, loadYear } from '../loader';
import { fmtDate, fmtAmount } from '../parser';
import { serializeCSV } from '../csvUtils';
import type { BudgetEntry } from '../types';

const HEADERS = [
  'date', 'amount', 'spend_type', 'periodicity',
  'spend_category', 'description', 'valid_until',
];

function entryToRow(e: BudgetEntry): string[] {
  return [
    fmtDate(e.date),
    fmtAmount(e.amount),
    e.spend_type,
    e.periodicity,
    e.spend_category,
    e.description,
    e.valid_until ? fmtDate(e.valid_until) : '',
  ];
}

export class ExportCsvModal extends Modal {
  private filename = 'thriftlens-export.csv';

  constructor(app: App, private plugin: ThriftLensPlugin) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Export register to CSV' });

    new Setting(contentEl)
      .setName('Filename')
      .setDesc('Saved to vault root')
      .addText(t => t
        .setValue(this.filename)
        .onChange(v => { this.filename = v.trim(); }),
      );

    new Setting(contentEl)
      .addButton(b => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(b => b.setButtonText('Export').setCta().onClick(() => void this.run()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async run(): Promise<void> {
    const folder = this.plugin.settings.dataFolder;
    const years = getAvailableYears(this.app, folder);

    const allEntries: BudgetEntry[] = [];
    for (const year of years) {
      const entries = await loadYear(this.app, folder, year);
      allEntries.push(...entries);
    }

    const rows = allEntries.map(entryToRow);
    const csv = serializeCSV(HEADERS, rows);

    const filename = this.filename.endsWith('.csv') ? this.filename : this.filename + '.csv';
    const path = normalizePath(filename);
    const existing = this.app.vault.getFileByPath(path);
    if (existing) {
      await this.app.vault.modify(existing, csv);
    } else {
      await this.app.vault.create(path, csv);
    }

    new Notice(`ThriftLens: exported ${rows.length} entries to ${filename}`);
    this.close();
  }
}
