// Slot H — Items 18 (rename Meetings → Governance), 19 (Business Context
// sub-header), 20 (top-level RAID view with 4 tabs).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootEmpty() {
  return await loadApp(makeDataset({
    projects: [],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
}

describe('Governance nav item — labels swapped: section = Business Management, inner item = Governance', () => {
  it('sidebar inner nav item shows "Governance" (renamed from Business Management)', async () => {
    const app = await bootEmpty();
    const navItem = app.document.querySelector('[data-view="governance"]');
    expect(navItem).toBeTruthy();
    expect(navItem.textContent).toMatch(/Governance/);
    expect(navItem.textContent).not.toMatch(/Meetings/);
    app.teardown();
  });

  it('Business Management is the section header (replaces the prior Governance heading)', async () => {
    const app = await bootEmpty();
    const sectionHeader = Array.from(app.document.querySelectorAll('.nav-section-label'))
      .find(el => el.textContent.trim() === 'Business Management');
    expect(sectionHeader).toBeTruthy();
    app.teardown();
  });

  it('App.viewNames map shows "Governance" for "governance"', async () => {
    const app = await bootEmpty();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('governance');
    const title = app.document.getElementById('viewTitlebarName');
    expect(title.textContent).toBe('Governance');
    app.teardown();
  });

  it('Governance view body has NO .gov-tabs strip', async () => {
    const app = await bootEmpty();
    expect(app.document.querySelector('#govTabs')).toBeFalsy();
    expect(app.document.querySelectorAll('.gov-tab').length).toBe(0);
    app.teardown();
  });
});

describe('Governance section — flat menu (no Business Context sub-header)', () => {
  it('Business Context sub-header is no longer in the DOM (menu is flat)', async () => {
    const app = await bootEmpty();
    const subHeader = app.document.querySelector('[data-nav-subgroup="business-context"]');
    expect(subHeader).toBeFalsy();
    app.teardown();
  });

  it('Strategy nav item is no longer in the Portfolio section', async () => {
    const app = await bootEmpty();
    // The Portfolio section is the first .nav-section. Strategy should not be there.
    const sections = app.document.querySelectorAll('.nav-section');
    const portfolioSection = sections[0];
    const strategyItem = portfolioSection.querySelector('[data-view="strategy"]');
    expect(strategyItem).toBeFalsy();
    app.teardown();
  });

  it('Strategy + Metrics + Personas all appear inside the Governance nav section', async () => {
    const app = await bootEmpty();
    // Find the Governance section by its label.
    const sections = Array.from(app.document.querySelectorAll('.nav-section'));
    const govSection = sections.find(s => {
      const label = s.querySelector('.nav-section-label');
      return label && label.textContent.trim() === 'Business Management';
    });
    expect(govSection).toBeTruthy();
    expect(govSection.querySelector('[data-view="strategy"]')).toBeTruthy();
    expect(govSection.querySelector('[data-view="metrics"]')).toBeTruthy();
    expect(govSection.querySelector('[data-view="personas"]')).toBeTruthy();
    app.teardown();
  });

  it('navigating to strategy / metrics / personas still works (routes preserved)', async () => {
    const app = await bootEmpty();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('strategy');
    expect(app.App.currentView).toBe('strategy');
    app.App.navigate('metrics');
    expect(app.App.currentView).toBe('metrics');
    app.App.navigate('personas');
    expect(app.App.currentView).toBe('personas');
    app.teardown();
  });
});

describe('Slot H — Item 20: top-level RAID view with 4 inner tabs', () => {
  it('sidebar Portfolio section has a RAID nav item', async () => {
    const app = await bootEmpty();
    const sections = app.document.querySelectorAll('.nav-section');
    const portfolioSection = sections[0];
    expect(portfolioSection.querySelector('[data-view="raid"]')).toBeTruthy();
    app.teardown();
  });

  it('App.navigate("raid") activates the RAID view + renders 4 inner tabs', async () => {
    const app = await bootEmpty();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    expect(app.App.currentView).toBe('raid');
    const tabs = Array.from(app.document.querySelectorAll('.raid-tab')).map(t => t.dataset.raidTab);
    expect(tabs).toEqual(['risks', 'assumptions', 'issues', 'decisions']);
    app.teardown();
  });

  it('RaidView counts rows across every project for the active customer', async () => {
    const projA = makeProject({
      id: 'P1', name: 'A', customer: 'Acme Industries',
      risks_register: [{ id: 'r1', description: 'X', impact: 5, probability: 5 }, { id: 'r2', description: 'Y', impact: 3, probability: 3 }],
      assumptions_register: [{ id: 'a1', description: 'Ass1' }],
      issues_register: [{ id: 'i1', description: 'I1', status: 'open' }],
      decisions_register: [{ id: 'd1', decision: 'D1' }]
    });
    const projB = makeProject({
      id: 'P2', name: 'B', customer: 'Acme Industries',
      risks_register: [{ id: 'r3', description: 'Z', impact: 4, probability: 4 }]
    });
    const projC = makeProject({
      id: 'P3', name: 'C', customer: 'Globex',  // Different customer — excluded.
      risks_register: [{ id: 'r4', description: 'Other', impact: 4, probability: 4 }]
    });
    const app = await loadApp(makeDataset({
      projects: [projA, projB, projC],
      customers: [
        { name: 'Acme Industries', color: '#6366f1' },
        { name: 'Globex', color: '#ec4899' }
      ]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    expect(app.document.getElementById('raidCountRisks').textContent).toBe('3');
    expect(app.document.getElementById('raidCountAssumptions').textContent).toBe('1');
    expect(app.document.getElementById('raidCountIssues').textContent).toBe('1');
    expect(app.document.getElementById('raidCountDecisions').textContent).toBe('1');
    app.teardown();
  });

  it('default tab is Risks; switchTab("issues") flips the active tab', async () => {
    const proj = makeProject({
      id: 'P1', customer: 'Acme Industries',
      risks_register: [{ id: 'r', description: 'X', impact: 5, probability: 5 }],
      issues_register: [{ id: 'i', description: 'I', status: 'open' }]
    });
    const app = await loadApp(makeDataset({
      projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    expect(app.RaidView.activeTab).toBe('risks');
    expect(app.document.querySelector('[data-raid-tab="risks"][aria-selected="true"]')).toBeTruthy();
    app.RaidView.switchTab('issues');
    expect(app.RaidView.activeTab).toBe('issues');
    expect(app.document.querySelector('[data-raid-tab="issues"][aria-selected="true"]')).toBeTruthy();
    expect(app.document.querySelector('[data-raid-tab="risks"][aria-selected="false"]')).toBeTruthy();
    app.teardown();
  });

  it('Risks tab table shows the score column (Format.riskScore)', async () => {
    const proj = makeProject({
      id: 'P1', customer: 'Acme Industries',
      risks_register: [{ id: 'r', description: 'Severe risk', impact: 5, probability: 4 }]
    });
    const app = await loadApp(makeDataset({
      projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const content = app.document.getElementById('raidContent');
    expect(content.textContent).toContain('Severe risk');
    expect(content.textContent).toContain('20'); // 5 × 4
    app.teardown();
  });

  it('row click opens Detail panel on the RAID tab with deep-link section', async () => {
    const proj = makeProject({
      id: 'P-deep', customer: 'Acme Industries',
      risks_register: [{ id: 'r1', description: 'Click me', impact: 3, probability: 3 }]
    });
    const app = await loadApp(makeDataset({
      projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    app.RaidView.openDetailPanelFor('P-deep', 'risks', 0);
    expect(app.DetailPanel.currentId).toBe('P-deep');
    expect(app.DetailPanel.activeTab).toBe('raid');
    app.teardown();
  });

  it('empty state renders when no rows of that kind exist', async () => {
    const proj = makeProject({ id: 'P-empty', customer: 'Acme Industries' });
    const app = await loadApp(makeDataset({
      projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const content = app.document.getElementById('raidContent');
    expect(content.querySelector('.raid-empty')).toBeTruthy();
    expect(content.textContent).toMatch(/No risks recorded/);
    app.teardown();
  });
});
