// WS-H: demo dataset embedded inline so the demo loads under file:// (no fetch),
// and the inline copy stays in sync with portfolio-data-demo.json.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadApp } from '../harness/loadApp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function extractInlineDemo() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const m = html.match(/<script type="application\/json" id="demoDataset">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('demoDataset island not found');
  return JSON.parse(m[1]);
}

describe('WS-H inline demo dataset', () => {
  it('inline #demoDataset deep-equals portfolio-data-demo.json', () => {
    const inline = extractInlineDemo();
    const file = JSON.parse(readFileSync(join(root, 'portfolio-data-demo.json'), 'utf8'));
    expect(inline).toEqual(file);
  });

  it('loadDemoData loads from the inline island synchronously (inline path, no fetch needed)', async () => {
    const app = await loadApp({ projects: [], customers: [], team_members: [], sprints: [] });
    app.App.data = null;
    app.App.loadDemoData();
    // Inline path is synchronous — data populated immediately after the call.
    expect(app.App.data).toBeTruthy();
    expect((app.App.data.projects || []).length).toBeGreaterThan(0);
    app.teardown();
  });
});
