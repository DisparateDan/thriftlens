import { App, Modal, Notice, Setting, normalizePath } from 'obsidian';
import type ThriftLensPlugin from '../main';
import type { BudgetEntry } from '../types';
import { serialiseEntry } from '../parser';
import { getAvailableYears, loadYear } from '../loader';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateStr(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return null;
  const [y, m, d] = s.trim().split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

interface FormState {
  dateStr:        string;
  amount:         string;
  spend_type:     BudgetEntry['spend_type'];
  periodicity:    BudgetEntry['periodicity'];
  spend_category: string;
  description:    string;
  validUntilStr:  string;
}

export class AddEntryModal extends Modal {
  private plugin: ThriftLensPlugin;
  private form: FormState = {
    dateStr:        todayStr(),
    amount:         '',
    spend_type:     'actual_spend',
    periodicity:    'monthly',
    spend_category: '',
    description:    '',
    validUntilStr:  '',
  };

  constructor(app: App, plugin: ThriftLensPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Log Entry' });

    const categories = await this.loadCategories();

    new Setting(contentEl)
      .setName('Date')
      .addText(t => t
        .setPlaceholder('YYYY-MM-DD')
        .setValue(this.form.dateStr)
        .onChange(v => { this.form.dateStr = v; }));

    const amountSetting = new Setting(contentEl).setName('Amount');
    amountSetting.controlEl.createEl('span', {
      text: this.plugin.settings.currencySymbol,
      cls: 'tl-currency-prefix',
    });
    amountSetting.addText(t => t
      .setPlaceholder('0.00')
      .onChange(v => { this.form.amount = v; }));

    new Setting(contentEl)
      .setName('Spend type')
      .addDropdown(d => d
        .addOption('actual_spend',     'Actual spend')
        .addOption('planned_known',    'Planned known')
        .addOption('planned_estimate', 'Planned estimate')
        .setValue(this.form.spend_type)
        .onChange(v => { this.form.spend_type = v as BudgetEntry['spend_type']; }));

    new Setting(contentEl)
      .setName('Periodicity')
      .addDropdown(d => d
        .addOption('monthly', 'Monthly')
        .addOption('annual',  'Annual')
        .setValue(this.form.periodicity)
        .onChange(v => { this.form.periodicity = v as BudgetEntry['periodicity']; }));

    // Spend category with datalist for existing slugs
    const catSetting = new Setting(contentEl)
      .setName('Spend category')
      .setDesc('Lowercase slug, e.g. groceries or heating_oil');
    catSetting.addText(t => {
      t.setPlaceholder('e.g. groceries')
        .onChange(v => { this.form.spend_category = v.trim().toLowerCase(); });
      if (categories.length > 0) {
        const listId  = 'tl-category-datalist';
        const datalist = contentEl.createEl('datalist');
        datalist.id   = listId;
        categories.forEach(c => datalist.createEl('option', { value: c }));
        t.inputEl.setAttribute('list', listId);
      }
    });

    new Setting(contentEl)
      .setName('Description')
      .addText(t => t
        .setPlaceholder('Brief description')
        .onChange(v => { this.form.description = v; }));

    new Setting(contentEl)
      .setName('Valid until')
      .setDesc('Optional. Only for mid-year expiry. Format: YYYY-MM-DD')
      .addText(t => t
        .setPlaceholder('YYYY-MM-DD')
        .onChange(v => { this.form.validUntilStr = v.trim(); }));

    new Setting(contentEl)
      .addButton(b => b
        .setButtonText('Add entry')
        .setCta()
        .onClick(() => this.submit()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async loadCategories(): Promise<string[]> {
    const folder = this.plugin.settings.dataFolder;
    const years  = getAvailableYears(this.app, folder);
    const all    = await Promise.all(years.map(y => loadYear(this.app, folder, y)));
    const cats   = new Set<string>();
    all.flat().forEach(e => { if (e.spend_category) cats.add(e.spend_category); });
    return [...cats].sort();
  }

  private async submit(): Promise<void> {
    const { dateStr, amount, spend_type, periodicity, spend_category, description, validUntilStr } = this.form;

    const date = parseDateStr(dateStr);
    if (!date)               { new Notice('Invalid date — use YYYY-MM-DD'); return; }
    const amountNum = parseFloat(amount);
    if (!amountNum)          { new Notice('Amount is required'); return; }
    if (!spend_category)     { new Notice('Spend category is required'); return; }
    if (!description.trim()) { new Notice('Description is required'); return; }

    let valid_until: Date | null = null;
    if (validUntilStr) {
      valid_until = parseDateStr(validUntilStr);
      if (!valid_until) { new Notice('Invalid valid_until date'); return; }
    }

    const entry: BudgetEntry = {
      date, amount: amountNum, spend_type, periodicity,
      spend_category, description, valid_until,
    };

    const year = date.getFullYear();
    const path = normalizePath(`${this.plugin.settings.dataFolder}/${year}.md`);
    const file = this.app.vault.getFileByPath(path);
    if (!file) {
      new Notice(`No register found for ${year}. Use "New Register" first.`);
      return;
    }

    await this.app.vault.process(file, content => {
      const closingFence = content.lastIndexOf('\n```');
      if (closingFence === -1) return content;
      return content.slice(0, closingFence) + '\n\n' + serialiseEntry(entry) + '\n' + content.slice(closingFence);
    });

    this.close();
  }
}
