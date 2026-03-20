import { Plugin, Notice, normalizePath } from 'obsidian';
import { ThriftLensView, VIEW_TYPE } from './ThriftLensView';
import { ThriftLensSettings, DEFAULT_SETTINGS, ThriftLensSettingTab } from './settings';
import { AddEntryModal }     from './modals/AddEntryModal';
import { CreateRecordModal } from './modals/CreateRecordModal';
import { CarryForwardModal } from './modals/CarryForwardModal';
import { ImportCsvModal }    from './modals/ImportCsvModal';
import { loadYear }          from './loader';
import { generateReport }    from './exporter';

export default class ThriftLensPlugin extends Plugin {
  settings: ThriftLensSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, leaf => new ThriftLensView(leaf, this));

    this.addRibbonIcon('hand-coins', 'ThriftLens', () => this.activateView());

    this.addCommand({
      id:       'open-dashboard',
      name:     'Open dashboard',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id:       'add-entry',
      name:     'Log an expense',
      callback: () => new AddEntryModal(this.app, this).open(),
    });

    this.addCommand({
      id:       'create-record',
      name:     'New register',
      callback: () => new CreateRecordModal(this.app, this).open(),
    });

    this.addCommand({
      id:       'carry-forward',
      name:     'Plan next year',
      callback: () => new CarryForwardModal(this.app, this).open(),
    });

    this.addCommand({
      id:       'import-csv',
      name:     'Import from CSV',
      callback: () => new ImportCsvModal(this.app, this).open(),
    });

    this.addCommand({
      id:       'export-report',
      name:     'Export report',
      callback: () => this.exportReport(),
    });

    this.addSettingTab(new ThriftLensSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async exportReport(): Promise<void> {
    const now    = new Date();
    const year   = now.getFullYear();
    const month  = now.getMonth();
    const folder = this.settings.dataFolder;
    const currency = this.settings.currencySymbol;

    const [monthRecords, annualRecords] = await Promise.all([
      loadYear(this.app, folder, year),
      loadYear(this.app, folder, year),
    ]);

    const html     = generateReport(monthRecords, annualRecords, year, month, currency);
    const monthStr = String(month + 1).padStart(2, '0');
    const filename = `ThriftLens-${year}-${monthStr}.html`;
    const path     = normalizePath(`${folder}/exports/${filename}`);

    await this.ensureDataFolder();
    const exportFolder = normalizePath(`${folder}/exports`);
    if (!this.app.vault.getFolderByPath(exportFolder)) {
      await this.app.vault.createFolder(exportFolder);
    }

    const existing = this.app.vault.getFileByPath(path);
    if (existing) {
      await this.app.vault.modify(existing, html);
    } else {
      await this.app.vault.create(path, html);
    }

    new Notice(`Report saved: ${filename}`);
  }

  // Called by modals before any vault write — never on load or view open.
  async ensureDataFolder(): Promise<void> {
    const path = normalizePath(this.settings.dataFolder);
    if (!this.app.vault.getFolderByPath(path)) {
      await this.app.vault.createFolder(path);
    }
  }

  async activateView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (leaves.length > 0) {
      this.app.workspace.revealLeaf(leaves[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
