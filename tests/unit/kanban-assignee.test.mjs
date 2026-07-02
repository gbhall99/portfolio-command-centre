// Board developer dimension — surface who is assigned (from skill_splits
// assigned_to) on cards and as a "By assignee" swimlane.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

let app;

const splits = (members) => ({
  size_engineering: [{ sprint: 'CY26-S1', points: 8, status: 'in_progress', assigned_to: members.map(m => ({ member: m, points: 4 })) }]
});

beforeEach(async () => {
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [
      makeProject({ id: 'P1', name: 'Alpha', customer: 'Acme Industries', status: 'In Progress', skill_splits: splits(['Avery Nolan', 'Blair Okafor']) }),
      makeProject({ id: 'P2', name: 'Beta', customer: 'Acme Industries', status: 'In Progress', skill_splits: splits(['Avery Nolan']) }),
      makeProject({ id: 'P3', name: 'Gamma', customer: 'Acme Industries', status: 'Not Started' }) // no assignment
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.currentView = 'board';
});
afterEach(() => app.teardown());

describe('assignee helpers', () => {
  it('_assignees returns the distinct members across skill_splits', () => {
    const { Kanban, App } = app;
    const p1 = App.data.projects.find(p => p.id === 'P1');
    expect(Kanban._assignees(p1).sort()).toEqual(['Avery Nolan', 'Blair Okafor']);
    expect(Kanban._assignees(App.data.projects.find(p => p.id === 'P3'))).toEqual([]);
  });

  it('_initials abbreviates a name', () => {
    expect(app.Kanban._initials('Avery Nolan')).toBe('AN');
    expect(app.Kanban._initials('madonna')).toBe('M');
  });
});

describe('card + swimlane', () => {
  it('the card surfaces assignee initials', () => {
    const { Kanban, App } = app;
    const html = Kanban._cardHtml(App.data.projects.find(p => p.id === 'P1'));
    expect(html).toContain('kb-card-assignees');
    expect(html).toContain('>AN<'); // Avery Nolan
    expect(html).toContain('>BO<'); // Blair Okafor
  });

  it('the aggregate assignees tooltip escapes double quotes in member names (attribute injection)', () => {
    const { Kanban, App } = app;
    const evil = 'M" onmouseover="window.pwned=1';
    const p = makeProject({ id: 'PX', name: 'Evil', customer: 'Acme Industries', status: 'In Progress', skill_splits: splits([evil]) });
    App.data.projects.push(p);
    const div = app.document.createElement('div');
    div.innerHTML = Kanban._cardHtml(p);
    const agg = div.querySelector('.kb-card-assignees');
    expect(agg.hasAttribute('onmouseover')).toBe(false);
    expect(agg.getAttribute('title')).toBe('Assigned: ' + evil);
  });

  it('"By assignee" is an available swimlane and groups projects per member (Unassigned last)', () => {
    const { Kanban } = app;
    expect(Kanban.SWIMLANES.some(l => l.id === 'assignee')).toBe(true);
    Kanban.render();
    Kanban.setSwimlane('assignee');
    const labels = Array.from(app.document.querySelectorAll('#kbBoard .kb-lane-label')).map(e => e.textContent);
    // Avery Nolan is on P1 + P2 → count 2; Blair Okafor on P1 → 1; Gamma → Unassigned.
    expect(labels.some(l => /Avery Nolan \(2\)/.test(l))).toBe(true);
    expect(labels.some(l => /Blair Okafor \(1\)/.test(l))).toBe(true);
    expect(labels[labels.length - 1]).toMatch(/Unassigned \(1\)/);
  });
});
