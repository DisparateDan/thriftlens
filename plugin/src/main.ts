import { Plugin, normalizePath } from 'obsidian';
import { ThriftLensView, VIEW_TYPE } from './ThriftLensView';
import { ThriftLensSettings, DEFAULT_SETTINGS, ThriftLensSettingTab } from './settings';
import { AddEntryModal }     from './modals/AddEntryModal';
import { CreateRecordModal } from './modals/CreateRecordModal';
import { CarryForwardModal } from './modals/CarryForwardModal';
import { ImportCsvModal }    from './modals/ImportCsvModal';

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
