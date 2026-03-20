import { App, Modal, Notice, Setting, normalizePath } from 'obsidian';
import type ThriftLensPlugin from '../main';

export class CreateRecordModal extends Modal {
  private plugin: ThriftLensPlugin;
  private yearStr: string;

  constructor(app: App, plugin: ThriftLensPlugin) {
    super(app);
    this.plugin  = plugin;
    this.yearStr = String(new Date().getFullYear() + 1);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Create Record' });

    new Setting(contentEl)
      .setName('Year')
      .addText(t => t
        .setValue(this.yearStr)
        .onChange(v => { this.yearStr = v.trim(); }));

    new Setting(contentEl)
      .addButton(b => b
        .setButtonText('Create')
        .setCta()
        .onClick(() => this.submit()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    const year = parseInt(this.yearStr, 10);
    if (isNaN(year) || String(year).length !== 4) {
      new Notice('Enter a valid 4-digit year');
      return;
    }

    await this.plugin.ensureDataFolder();

    const path = normalizePath(`${this.plugin.settings.dataFolder}/${year}.md`);
    if (this.app.vault.getFileByPath(path)) {
      new Notice(`A record for ${year} already exists`);
      return;
    }

    const content = [
      '---',
      'tl_type: register',
      `year: ${year}`,
      '---',
      '',
      '```yaml',
      '# ── Planned estimate ──────────────────────────────',
      '',
      '# ── Planned known ─────────────────────────────────',
      '',
      '# ── Actual spend ──────────────────────────────────',
      '```',
      '',
    ].join('\n');

    await this.app.vault.create(path, content);
    new Notice(`Record for ${year} created`);
    this.close();
  }
}
