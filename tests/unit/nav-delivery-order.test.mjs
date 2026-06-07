// Delivery nav: chronological reorder — RAID/Governance/Actions at top with Projects,
// then a Planning subsection (Backlog first), then a Customer Profile subsection (Personas before
// Metrics). No nav-strategy-group wrapper (the vertical line is gone).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }]
}));

const deliverySection = (app) => {
  const sections = Array.from(app.document.querySelectorAll('.nav-section'));
  return sections.find(s => {
    const label = s.querySelector('.nav-section-label');
    return label && /delivery/i.test(label.textContent || '');
  });
};

describe('Delivery nav — chronological order', () => {
  it('RAID, Governance and Actions sit at the top with Projects, before any subsection label', async () => {
    const app = await boot();
    const sec = deliverySection(app);
    const children = Array.from(sec.children);
    const firstSubLabelIdx = children.findIndex(c => c.classList.contains('nav-subsection-label'));
    const topViews = children.slice(0, firstSubLabelIdx)
      .filter(c => c.classList.contains('nav-item'))
      .map(c => c.getAttribute('data-view'));
    expect(topViews).toEqual(['dashboard', 'raid', 'governance', 'myactions']);
    app.teardown();
  });

  it('Backlog is the first item under the Planning subsection', async () => {
    const app = await boot();
    const sec = deliverySection(app);
    const children = Array.from(sec.children);
    const planningIdx = children.findIndex(c => c.classList.contains('nav-subsection-label') && /planning/i.test(c.textContent));
    expect(planningIdx).toBeGreaterThan(-1);
    expect(children[planningIdx + 1].getAttribute('data-view')).toBe('backlog');
    app.teardown();
  });

  it('Customer Profile subsection lists Objectives, Personas, then Metrics (Personas before Metrics)', async () => {
    const app = await boot();
    const sec = deliverySection(app);
    const children = Array.from(sec.children);
    const stratIdx = children.findIndex(c => c.classList.contains('nav-subsection-label') && /customer profile/i.test(c.textContent));
    expect(stratIdx).toBeGreaterThan(-1);
    const after = children.slice(stratIdx + 1).filter(c => c.classList.contains('nav-item')).map(c => c.getAttribute('data-view'));
    expect(after.slice(0, 4)).toEqual(['strategy', 'personas', 'metrics', 'products']);
    app.teardown();
  });

  it('the nav-strategy-group wrapper (vertical line) is gone', async () => {
    const app = await boot();
    expect(app.document.querySelector('.nav-strategy-group')).toBeFalsy();
    app.teardown();
  });

  it('all Delivery routes still resolve', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    for (const v of ['dashboard', 'raid', 'governance', 'myactions', 'backlog', 'roadmap', 'sprint', 'capacity', 'strategy', 'personas', 'metrics']) {
      app.App.navigate(v);
      expect(app.App.currentView).toBe(v);
    }
    app.teardown();
  });
});
