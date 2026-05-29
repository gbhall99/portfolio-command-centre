// UX benchmark overhaul — Wave 3 (direct-manipulation workflows) regression guards.
// R2: backlog park/un-park direct manipulation.
// R5: inline "off sick" zeroes a member's sprint availability.
// R6: My Actions aggregates open RAID issues + high risks (customer-scoped).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMember, makeSprint } from '../harness/fixtures.mjs';

describe('Wave 3 R2 — backlog park / un-park moves cards between buckets', () => {
  it('backlogPark sets On Hold (→ Parked); backlogUnpark restores it', async () => {
    const p = makeProject({ id: 'P1', name: 'Groomable', customer: 'Acme Industries', status: 'Not Started', size_total: 10, business_value: 8 });
    const app = await loadApp(makeDataset({ projects: [p], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('backlog');
    expect(app.App.computeBacklogBuckets('Acme Industries').parked.map(x => x.id)).not.toContain('P1');
    app.Dashboard.backlogPark('P1');
    expect(app.App.data.projects.find(x => x.id === 'P1').status).toBe('On Hold');
    expect(app.App.computeBacklogBuckets('Acme Industries').parked.map(x => x.id)).toContain('P1');
    app.Dashboard.backlogUnpark('P1');
    expect(app.App.computeBacklogBuckets('Acme Industries').parked.map(x => x.id)).not.toContain('P1');
    app.teardown();
  });
});

describe('Wave 3 R5 — inline off-sick zeroes a member\'s sprint availability', () => {
  it('Capacity.markOffSick writes available_points = 0 for that sprint', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      team_members: [makeMember({ name: 'Sam Carter', customer: 'Acme Industries', available_points_per_sprint: 12 })],
      sprints: [makeSprint({ sprint_id: 'CY26-S1' })]
    }));
    app.App.setActiveCustomer('Acme Industries');
    expect(typeof app.Capacity.markOffSick).toBe('function');
    app.Capacity.markOffSick(0, 'CY26-S1');
    const tm = app.App.data.team_members[0];
    expect(tm.sprint_overrides['CY26-S1'].available_points).toBe(0);
    app.teardown();
  });
});

describe('Wave 3 R6 — My Actions aggregates open RAID blockers (customer-scoped)', () => {
  it('collect().blockers includes open issues + high risks for the active customer only', async () => {
    const acme = makeProject({ id: 'P1', name: 'Acme proj', customer: 'Acme Industries',
      issues_register: [{ id: 'i1', description: 'Acme open issue', status: 'open' }],
      risks_register: [{ id: 'r1', description: 'Acme severe', impact: 5, probability: 4, status: 'open' },
                       { id: 'r2', description: 'Acme low', impact: 1, probability: 1, status: 'open' }] });
    const globex = makeProject({ id: 'P2', name: 'Globex proj', customer: 'Globex',
      issues_register: [{ id: 'i2', description: 'Globex issue', status: 'open' }] });
    const app = await loadApp(makeDataset({
      projects: [acme, globex],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    const blockers = app.MyActions.collect().blockers;
    // 1 open issue + 1 high risk (score 20 ≥ 12); the low risk (score 1) and Globex issue are excluded.
    expect(blockers).toHaveLength(2);
    expect(blockers.every(b => b.project.customer === 'Acme Industries')).toBe(true);
    expect(blockers.some(b => b.kind === 'issue')).toBe(true);
    expect(blockers.some(b => b.kind === 'risk')).toBe(true);
    app.teardown();
  });
});
