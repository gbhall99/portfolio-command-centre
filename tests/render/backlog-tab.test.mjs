import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Backlog tab render', () => {
  it('renders three columns with project names', async () => {
    resetIdSeq();
    const u = makeProject({ name: 'Unr', status: 'Not Started' });
    delete u.size_total; u.size_total = 0;
    const r = makeProject({ name: 'Ref', status: 'Not Started', business_value: 8, size_engineering: 10 });
    r.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [u, r] }));
    let host = app.window.document.getElementById('backlogTabBody');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'backlogTabBody';
      app.window.document.body.appendChild(host);
    }
    app.Dashboard.renderBacklogTab('Acme Industries');
    const html = host.innerHTML;
    expect(html).toMatch(/Unrefined/);
    expect(html).toMatch(/Refined/);
    expect(html).toMatch(/Parked/);
    expect(html).toMatch(/Unr/);
    expect(html).toMatch(/Ref/);
    app.teardown();
  });
});
