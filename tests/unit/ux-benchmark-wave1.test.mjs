// UX benchmark overhaul — Wave 1 regression guards.
// Covers: RAID view visibility bug (inline display:none), RAID sidebar badge wiring,
// semantic h1 titlebar, dashboard-filter aria-labels, and the benefit-led onboarding CTA.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Wave 1 — RAID view is no longer hard-hidden by an inline style', () => {
  it('#viewRaid has no inline display:none and gains .active on navigate', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries', risks_register: [{ id: 'r', description: 'X', impact: 5, probability: 5, status: 'open' }] })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    const vr = app.document.getElementById('viewRaid');
    expect(vr).toBeTruthy();
    // The bug: a hardcoded style="display:none" overrode .view.active { display:flex }.
    expect(vr.getAttribute('style') || '').not.toMatch(/display\s*:\s*none/);
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    expect(vr.classList.contains('active')).toBe(true);
    app.teardown();
  });
});

describe('Wave 1 — RAID sidebar badge counts open risks + issues for the active customer', () => {
  it('updateNavBadge writes the open risk+issue count (excludes closed/resolved)', async () => {
    const app = await loadApp(makeDataset({
      projects: [
        makeProject({ id: 'P1', customer: 'Acme Industries',
          risks_register: [{ id: 'r1', description: 'open risk', impact: 3, probability: 3, status: 'open' },
                           { id: 'r2', description: 'closed risk', impact: 3, probability: 3, status: 'closed' }],
          issues_register: [{ id: 'i1', description: 'open issue', status: 'open' }] }),
        makeProject({ id: 'P2', customer: 'Globex',
          risks_register: [{ id: 'r3', description: 'other customer', impact: 3, probability: 3, status: 'open' }] })
      ],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    // 1 open risk + 1 open issue = 2 (closed risk and Globex risk excluded)
    expect(app.document.getElementById('navBadgeRaid').textContent).toBe('2');
    app.App.setActiveCustomer('Globex');
    expect(app.document.getElementById('navBadgeRaid').textContent).toBe('1');
    app.teardown();
  });
});

describe('Wave 1 — accessibility & onboarding polish', () => {
  it('per-view titlebar name is a semantic h1', async () => {
    const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    const el = app.document.getElementById('viewTitlebarName');
    expect(el).toBeTruthy();
    expect(el.tagName).toBe('H1');
    app.teardown();
  });

  it('dashboard metric/objective/persona filter selects have aria-labels', async () => {
    const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    ['filterMetric', 'filterObjective', 'filterPersona'].forEach(id => {
      const sel = app.document.getElementById(id);
      expect(sel, id).toBeTruthy();
      expect(sel.getAttribute('aria-label'), id).toBeTruthy();
    });
    app.teardown();
  });

  it('first-run drop zone offers a sample-data CTA wired to loadDemoData', async () => {
    const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    const zone = app.document.getElementById('dropZone');
    expect(zone).toBeTruthy();
    const demoBtn = Array.from(zone.querySelectorAll('button')).find(b => /sample data/i.test(b.textContent));
    expect(demoBtn).toBeTruthy();
    expect(demoBtn.getAttribute('onclick') || '').toMatch(/loadDemoData/);
    app.teardown();
  });
});
