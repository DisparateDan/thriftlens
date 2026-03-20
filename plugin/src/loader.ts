import { App, normalizePath, TFile } from 'obsidian';
import { parseRecordsBlock } from './parser';
import type { BudgetEntry } from './types';

export function getAvailableYears(app: App, dataFolder: string): number[] {
  const folder = app.vault.getFolderByPath(normalizePath(dataFolder));
  if (!folder) return [];
  return folder.children
    .filter((f): f is TFile => f instanceof TFile && /^\d{4}\.md$/.test(f.name))
    .map(f => parseInt(f.basename, 10))
    .sort((a, b) => a - b);
}

export function yearFileExists(app: App, dataFolder: string, year: number): boolean {
  return !!app.vault.getFileByPath(normalizePath(`${dataFolder}/${year}.md`));
}

export async function loadYear(app: App, dataFolder: string, year: number): Promise<BudgetEntry[]> {
  const path = normalizePath(`${dataFolder}/${year}.md`);
  const file = app.vault.getFileByPath(path);
  if (!file) return [];
  const content = await app.vault.read(file);
  const match = content.match(/```yaml\n([\s\S]*?)\n```/);
  return match ? parseRecordsBlock(match[1]) : [];
}
