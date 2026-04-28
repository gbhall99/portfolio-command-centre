// Issue 1 (round 2): the unsaved-changes prompt was firing on ownership even when the
// user opened a project and closed it without editing. Root cause: the seed data carries
// values like 'We Own' and 'Requirements Received' for `ownership`, but the dropdown
// options are ['Lead & Delivery', 'Delivery']. The <select> auto-selected 'Lead & Delivery'
// because the persisted value wasn't in the list, then the dirty detector compared the
// (auto-selected) DOM value against the (legacy) data value and reported a phantom edit.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('DetailPanel close — phantom ownership warning', () => {
  it('opening a project with legacy "We Own" then closing without edits does not fire confirm', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Legacy P' });
    proj.ownership = 'We Own';
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    let confirmCalls = 0;
    app.window.confirm = () => { confirmCalls += 1; return true; };
    app.DetailPanel.open(proj.id);
    app.DetailPanel.close();
    expect(confirmCalls).toBe(0);
    app.teardown();
  });

  it('opening a project with legacy "Requirements Received" then closing does not fire confirm', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Legacy P2' });
    proj.ownership = 'Requirements Received';
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    let confirmCalls = 0;
    app.window.confirm = () => { confirmCalls += 1; return true; };
    app.DetailPanel.open(proj.id);
    app.DetailPanel.close();
    expect(confirmCalls).toBe(0);
    app.teardown();
  });

  it('after migration, ownership values are always one of the dropdown options', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-OW-A' }); a.ownership = 'We Own';
    const b = makeProject({ id: 'GCC-OW-B' }); b.ownership = 'Requirements Received';
    const c = makeProject({ id: 'GCC-OW-C' }); delete c.ownership;
    const d = makeProject({ id: 'GCC-OW-D' }); d.ownership = 'Lead & Delivery';
    const e = makeProject({ id: 'GCC-OW-E' }); e.ownership = 'Delivery';
    const app = await loadApp(makeDataset({ projects: [a, b, c, d, e] }));
    const allowed = new Set(app.DetailPanel.OWNERSHIPS);
    app.App.data.projects.forEach(p => {
      expect(allowed.has(p.ownership)).toBe(true);
    });
    app.teardown();
  });
});
