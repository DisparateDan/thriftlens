/**
 * deploy.mjs — build and copy plugin files to the vault
 *
 * Usage:
 *   npm run deploy          — production build then copy
 *   npm run dev:deploy      — watch mode: rebuild + copy on every change
 *   node deploy.mjs --watch — same as dev:deploy
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────
// Path to the vault's plugin folder, relative to this file.
const VAULT_PLUGIN_DIR = path.resolve(__dirname, '../vault/.obsidian/plugins/thriftlens');

// Files to copy after each build
const DEPLOY_FILES = ['main.js', 'manifest.json', 'styles.css'];
// ─────────────────────────────────────────────────────────────────

const isWatch = process.argv.includes('--watch');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function deploy() {
  ensureDir(VAULT_PLUGIN_DIR);
  let ok = true;
  for (const file of DEPLOY_FILES) {
    const src  = path.join(__dirname, file);
    const dest = path.join(VAULT_PLUGIN_DIR, file);
    if (!fs.existsSync(src)) {
      console.error(`  ✗ missing: ${file}`);
      ok = false;
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file} → ${path.relative(__dirname, dest)}`);
  }
  if (ok) console.log(`Deployed to ${VAULT_PLUGIN_DIR}\n`);
}

if (isWatch) {
  // Watch mode: esbuild rebuilds on change, deploy plugin after each rebuild
  console.log('Watching for changes…');

  const context = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    external: ['obsidian', 'electron'],
    format: 'cjs',
    target: 'es2018',
    sourcemap: 'inline',
    treeShaking: true,
    outfile: 'main.js',
    plugins: [{
      name: 'deploy-on-rebuild',
      setup(build) {
        build.onEnd(result => {
          if (result.errors.length === 0) {
            console.log(`[${new Date().toLocaleTimeString()}] Rebuilt`);
            deploy();
          }
        });
      },
    }],
  });

  await context.watch();
  // Copy manifest and styles once at start (they don't change on rebuild)
  deploy();

} else {
  // One-shot deploy (build already done by npm run deploy)
  deploy();
}
