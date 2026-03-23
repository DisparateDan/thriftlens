import { App, Modal, Notice, Platform, Setting, normalizePath } from 'obsidian';
import type ThriftLensPlugin from '../main';
import type { BudgetEntry } from '../types';
import { serialiseEntry } from '../parser';
import { getAvailableYears, loadYear } from '../loader';

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function parseDateInput(s: string): Date | null {
  const trimmed = s.trim();
  if (!/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return null;
  const [d, m, y] = trimmed.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

interface FormState {
  dateStr:        string;
  yearStr:        string;
  amount:         string;
  spend_type:     BudgetEntry['spend_type'];
  spend_category: string;
  description:    string;
  validUntilStr:  string;
}

export class AddEntryModal extends Modal {
  private plugin: ThriftLensPlugin;
  private form: FormState = {
    dateStr:        todayStr(),
    yearStr:        String(new Date().getFullYear()),
    amount:         '',
    spend_type:     'actual_spend',
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
    contentEl.createEl('h2', { text: 'Log entry' });

    if (Platform.isMobile) {
      contentEl.style.paddingBottom = '50vh';
      contentEl.addEventListener('focus', e => {
        (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, true);
    }

    const categories = await this.loadCategories();

    // Date (actual_spend only)
    const dateSetting = new Setting(contentEl)
      .setName('Date')
      .addText(t => t
        .setPlaceholder('DD-MM-YYYY')
        .setValue(this.form.dateStr)
        .onChange(v => { this.form.dateStr = v; }));

    // Year (monthly_fixed / annual_estimate only)
    const yearSetting = new Setting(contentEl)
      .setName('Year')
      .addText(t => t
        .setPlaceholder('YYYY')
        .setValue(this.form.yearStr)
        .onChange(v => { this.form.yearStr = v.trim(); }));

    const amountSetting = new Setting(contentEl).setName('Amount');
    amountSetting.controlEl.createEl('span', {
      text: this.plugin.settings.currencySymbol,
      cls: 'tl-currency-prefix',
    });
    amountSetting.addText(t => t
      .setPlaceholder('0.00')
      .onChange(v => { this.form.amount = v; }));

    // Spend category with datalist
    const catSetting = new Setting(contentEl)
      .setName('Spend category')
      .setDesc('Lowercase slug, e.g. groceries or heating_oil');
    catSetting.addText(t => {
      t.setPlaceholder('e.g. groceries')
        .onChange(v => { this.form.spend_category = v.trim().toLowerCase(); });
      if (categories.length > 0) {
        const listId   = 'tl-category-datalist';
        const datalist = contentEl.createEl('datalist');
        datalist.id    = listId;
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
      .setName('Spend type')
      .addDropdown(d => d
        .addOption('actual_spend',    'Actual spend')
        .addOption('monthly_fixed',   'Monthly fixed')
        .addOption('annual_estimate', 'Annual estimate')
        .addOption('exceptional',     'Exceptional')
        .setValue(this.form.spend_type)
        .onChange(v => {
          this.form.spend_type = v as BudgetEntry['spend_type'];
          updateVisibility(this.form.spend_type);
        }));

    const validUntilRow = new Setting(contentEl)
      .setName('Valid until')
      .setDesc('Optional. Only for mid-year expiry of a monthly fixed cost.')
      .addText(t => t
        .setPlaceholder('DD-MM-YYYY')
        .onChange(v => { this.form.validUntilStr = v.trim(); }));

    const updateVisibility = (spendType: BudgetEntry['spend_type']) => {
      const isActual        = spendType === 'actual_spend' || spendType === 'exceptional';
      const isMonthlyFixed  = spendType === 'monthly_fixed';
      dateSetting.settingEl.style.display     = isActual       ? '' : 'none';
      yearSetting.settingEl.style.display     = isActual       ? 'none' : '';
      validUntilRow.settingEl.style.display   = isMonthlyFixed ? '' : 'none';
    };

    updateVisibility(this.form.spend_type);

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
    const { dateStr, yearStr, amount, spend_type, spend_category, description, validUntilStr } = this.form;

    let date: Date;
    if (spend_type === 'actual_spend' || spend_type === 'exceptional') {
      const parsed = parseDateInput(dateStr);
      if (!parsed) { new Notice('Invalid date — use DD-MM-YYYY'); return; }
      date = parsed;
    } else {
      const y = parseInt(yearStr, 10);
      if (isNaN(y) || y < 2000 || y > 2100) { new Notice('Invalid year'); return; }
      date = new Date(y, 0, 1);
    }

    const amountNum = parseFloat(amount);
    if (!amountNum)          { new Notice('Amount is required'); return; }
    if (!spend_category)     { new Notice('Spend category is required'); return; }
    if (!description.trim()) { new Notice('Description is required'); return; }

    let valid_until: Date | null = null;
    if (validUntilStr) {
      valid_until = parseDateInput(validUntilStr);
      if (!valid_until) { new Notice('Invalid valid until date — use DD-MM-YYYY'); return; }
    }

    const entry: BudgetEntry = {
      date, amount: amountNum, spend_type,
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
