// Slot C — Items 3 (drop Overview Identity strip; add sponsor pill), 2 (RAID order R/A/I/D),
// 4 (Objectives before Metrics whenever shown together).
// Plan: plans/post-launch-ui-fixes.md.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootWithProject(extra = {}) {
  const p = makeProject(Object.assign({ id: 'C1', name: 'P', customer: 'Acme Industries' }, extra));
  const app = await loadApp(makeDataset({
    projects: [p],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return { app, p };
}

describe('Slot C — Item 3: Overview Identity strip removed; sponsor pill in sticky header', () => {
  it('Overview panel no longer renders a .dp-identity-strip', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('C1');
    const overview = app.document.querySelector('[data-dp-tab="overview"]');
    expect(overview).toBeTruthy();
    expect(overview.querySelector('.dp-identity-strip')).toBeFalsy();
    app.teardown();
  });

  it('Scope tab still renders the full editable Identity section', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('C1');
    const scope = app.document.querySelector('[data-dp-tab="scope"]');
    const titles = Array.from(scope.querySelectorAll('.panel-section-title')).map(t => t.textContent.trim());
    expect(titles.some(t => /^Identity/.test(t))).toBe(true);
    app.teardown();
  });

  it('sticky header row 1 renders a .dp-sponsor-pill with the sponsor name', async () => {
    const { app } = await bootWithProject({ sponsor: 'Ada Lovelace' });
    app.DetailPanel.open('C1');
    const pill = app.document.querySelector('#panelStickyMeta .dp-sponsor-pill');
    expect(pill).toBeTruthy();
    expect(pill.textContent).toContain('Ada Lovelace');
    expect(pill.dataset.field).toBe('sponsor');
    app.teardown();
  });

  it('sticky header sponsor pill shows em-dash when sponsor is empty', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('C1');
    const pill = app.document.querySelector('#panelStickyMeta .dp-sponsor-pill');
    expect(pill).toBeTruthy();
    expect(pill.textContent).toContain('—');
    app.teardown();
  });

  it('clicking the sponsor pill switches to the Scope tab', async () => {
    const { app } = await bootWithProject({ sponsor: 'Ada' });
    app.DetailPanel.open('C1');
    app.DetailPanel._jumpToSponsorEdit();
    expect(app.DetailPanel.activeTab).toBe('scope');
    app.teardown();
  });
});

describe('Slot C — Item 2: RAID sections in R → A → I → D order', () => {
  it('RAID tab renders Risks first, then Assumptions, then Issues, then Decisions', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('C1');
    const raid = app.document.querySelector('[data-dp-tab="raid"]');
    const titles = Array.from(raid.querySelectorAll('.panel-section-title')).map(t => t.textContent.trim().split(/\s/)[0]);
    // The first occurrence of each category establishes its position in the RAID order.
    const idx = (k) => titles.indexOf(k);
    expect(idx('Risks')).toBeGreaterThanOrEqual(0);
    expect(idx('Assumptions')).toBeGreaterThanOrEqual(0);
    expect(idx('Issues')).toBeGreaterThanOrEqual(0);
    expect(idx('Decisions')).toBeGreaterThanOrEqual(0);
    expect(idx('Risks')).toBeLessThan(idx('Assumptions'));
    expect(idx('Assumptions')).toBeLessThan(idx('Issues'));
    expect(idx('Issues')).toBeLessThan(idx('Decisions'));
    app.teardown();
  });

  it('Issues section appears exactly once on the RAID tab (no duplicate push)', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('C1');
    const raid = app.document.querySelector('[data-dp-tab="raid"]');
    const issuesTitles = Array.from(raid.querySelectorAll('.panel-section-title'))
      .filter(t => /^Issues\b/.test(t.textContent.trim()));
    expect(issuesTitles.length).toBe(1);
    app.teardown();
  });
});

describe('Slot C — Item 4: Objectives presented before Metrics whenever shown together', () => {
  it('renderStrategySection emits Objectives picker before Metrics picker', async () => {
    const { app } = await bootWithProject();
    const html = app.DetailPanel.renderStrategySection(app.App.data.projects[0]);
    const oIdx = html.indexOf('data-field="objective_ids"');
    const mIdx = html.indexOf('data-field="metric_ids"');
    expect(oIdx).toBeGreaterThanOrEqual(0);
    expect(mIdx).toBeGreaterThanOrEqual(0);
    expect(oIdx).toBeLessThan(mIdx);
    app.teardown();
  });

  it('renderStrategyEditFields emits Objectives row before Metrics row (Item 4 + Slot B)', async () => {
    const { app } = await bootWithProject();
    const html = app.DetailPanel.renderStrategyEditFields(app.App.data.projects[0]);
    const oIdx = html.indexOf('data-field="objective_ids"');
    const mIdx = html.indexOf('data-field="metric_ids"');
    expect(oIdx).toBeGreaterThanOrEqual(0);
    expect(mIdx).toBeGreaterThanOrEqual(0);
    expect(oIdx).toBeLessThan(mIdx);
    app.teardown();
  });
});
