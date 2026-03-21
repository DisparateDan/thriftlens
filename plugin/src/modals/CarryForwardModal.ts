import { App, Modal, Notice, Setting, normalizePath } from 'obsidian';
import type ThriftLensPlugin from '../main';
import type { BudgetEntry } from '../types';
import { loadYear, getAvailableYears } from '../loader';
import { serialiseEntry } from '../parser';
import { buildProposal, type ProposedEntry } from '../carryForward';

export class CarryForwardModal extends Modal {
  private plugin:      ThriftLensPlugin;
  private sourceYear:  number;
  private targetYear:  number;
  private proposed:    ProposedEntry[] = [];
  private listEl!:     HTMLElement;
  private confirmBtn!: HTMLButtonElement;

  constructor(app: App, plugin: ThriftLensPlugin) {
    super(app);
    this.plugin     = plugin;
    this.sourceYear = new Date().getFullYear();
    this.targetYear = this.sourceYear + 1;
  }

  onOpen(): void {
    this.renderYearPicker();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  // ── Phase 1: year picker ─────────────────────────────────────

  private renderYearPicker(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tl-carry-modal');
    contentEl.createEl('h2', { text: 'Plan Next Year' });

    const years = getAvailableYears(this.app, this.plugin.settings.dataFolder);

    if (years.length === 0) {
      contentEl.createEl('p', {
        text: 'No registers found. Create one first using New Register.',
        cls: 'tl-carry-intro',
      });
      new Setting(contentEl).addButton(b => b.setButtonText('Close').onClick(() => this.close()));
      return;
    }

    // Default to the latest available year
    this.sourceYear = years[years.length - 1];
    this.targetYear = this.sourceYear + 1;

    let targetLabel: HTMLElement;

    new Setting(contentEl)
      .setName('Copy from')
      .setDesc('Entries from this register will seed the proposal.')
      .addDropdown(d => {
        years.forEach(y => d.addOption(String(y), String(y)));
        d.setValue(String(this.sourceYear));
        d.onChange(v => {
          this.sourceYear = parseInt(v, 10);
          this.targetYear = this.sourceYear + 1;
          targetLabel.textContent = `Target register: ${this.targetYear}`;
        });
      });

    targetLabel = contentEl.createEl('p', {
      text: `Target register: ${this.targetYear}`,
      cls: 'tl-carry-target-label',
    });

    new Setting(contentEl)
      .addButton(b => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(b => b.setButtonText('Continue →').setCta().onClick(() => this.loadAndRender()));
  }

  private async loadAndRender(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `Plan Next Year: ${this.sourceYear} → ${this.targetYear}` });

    const loading = contentEl.createEl('p', { text: 'Loading source records…' });
    const sourceRecords = await loadYear(this.app, this.plugin.settings.dataFolder, this.sourceYear);
    loading.remove();

    this.proposed = buildProposal(sourceRecords, this.sourceYear, this.targetYear);
    this.renderBody(contentEl);
  }

  // ── Rendering ───────────────────────────────────────────────

  private renderBody(contentEl: HTMLElement): void {
    const targetPath = normalizePath(`${this.plugin.settings.dataFolder}/${this.targetYear}.md`);
    if (this.app.vault.getFileByPath(targetPath)) {
      contentEl.createEl('p', {
        text: `⚠ A record for ${this.targetYear} already exists. Confirming will overwrite it.`,
        cls: 'tl-carry-warn',
      });
    }

    contentEl.createEl('p', {
      text: `Review the proposed entries for ${this.targetYear}. Edit amounts, delete unwanted entries, then confirm.`,
      cls: 'tl-carry-intro',
    });

    this.listEl = contentEl.createEl('div', { cls: 'tl-carry-list' });
    this.renderList();

    contentEl.createEl('button', { text: '+ Add entry', cls: 'tl-carry-add-btn' })
      .addEventListener('click', () => this.addBlankEntry());

    new Setting(contentEl)
      .addButton(b => b
        .setButtonText('Cancel')
        .onClick(() => this.close()))
      .addButton(b => {
        b.setButtonText('Confirm & Write').setCta().onClick(() => this.confirm());
        this.confirmBtn = b.buttonEl;
      });
  }

  private renderList(): void {
    this.listEl.empty();
    this.proposed.forEach((entry, idx) => {
      const row = this.listEl.createEl('div', {
        cls: `tl-carry-row${entry.discretionary ? ' tl-carry-row--discretionary' : ''}`,
      });

      const info = row.createEl('div', { cls: 'tl-carry-info' });
      info.createEl('span', { text: entry.description || '(no description)', cls: 'tl-carry-desc' });
      info.createEl('span', { text: entry.origin, cls: 'tl-carry-origin' });

      const controls = row.createEl('div', { cls: 'tl-carry-controls' });
      const amountInput = controls.createEl('input', { cls: 'tl-carry-amount' }) as HTMLInputElement;
      amountInput.type  = 'number';
      amountInput.value = String(entry.amount);
      amountInput.step  = '0.01';
      amountInput.addEventListener('change', () => {
        this.proposed[idx].amount = parseFloat(amountInput.value) || 0;
      });

      controls.createEl('button', { text: '✕', cls: 'tl-carry-del-btn' })
        .addEventListener('click', () => {
          this.proposed.splice(idx, 1);
          this.renderList();
        });
    });
  }

  private addBlankEntry(): void {
    this.proposed.push({
      date: new Date(this.targetYear, 0, 1),
      amount: 0,
      spend_type:     'planned_known',
      periodicity:    'monthly',
      description:    '',
      spend_category: '',
      valid_until:    null,
      origin:         'new entry',
      discretionary:  false,
    });
    this.renderList();
  }

  // ── Confirm ──────────────────────────────────────────────────

  private async confirm(): Promise<void> {
    for (const e of this.proposed) {
      if (!e.spend_category.trim() || !e.description.trim()) {
        new Notice('All entries must have a spend_category and description');
        return;
      }
    }

    // Group by spend_type for canonical section ordering
    const sections: Record<string, BudgetEntry[]> = {
      planned_estimate: [],
      planned_known:    [],
      actual_spend:     [],
    };
    for (const e of this.proposed) {
      sections[e.spend_type].push(e);
    }

    const yamlLines: string[] = [
      '# ── Planned estimate ──────────────────────────────',
      ...sections['planned_estimate'].map(e => serialiseEntry(e)),
      '',
      '# ── Planned known ─────────────────────────────────',
      ...sections['planned_known'].map(e => serialiseEntry(e)),
      '',
      '# ── Actual spend ──────────────────────────────────',
    ];

    const content = [
      '---',
      'tl_type: register',
      `year: ${this.targetYear}`,
      '---',
      '',
      '```yaml',
      yamlLines.join('\n'),
      '```',
      '',
    ].join('\n');

    await this.plugin.ensureDataFolder();

    const path    = normalizePath(`${this.plugin.settings.dataFolder}/${this.targetYear}.md`);
    const existing = this.app.vault.getFileByPath(path);

    if (existing) {
      await this.app.vault.process(existing, () => content);
    } else {
      await this.app.vault.create(path, content);
    }

    new Notice(`Record for ${this.targetYear} written`);
    this.close();
  }
}
