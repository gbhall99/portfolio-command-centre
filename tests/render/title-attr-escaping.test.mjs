// Hardening L1 (escaping/XSS) — free-text title="…" sinks app-wide (H-006).
// Same class as the Strategy/Personas sinks: a project / member / RAID name or
// description carrying a double-quote could break out of a tooltip attribute
// and inject a live handler. This pins the Gantt pipeline fragment (a pure,
// export-safe function used by the report packs) at the DOM level.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const HOSTILE = '" onmouseover="window.__xss=1';

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('Gantt pipeline — free-text title escaping (L1/H-006)', () => {
  it('a quote in a project name cannot break out of the pipeline label/bar titles', () => {
    const { Gantt, document } = app;
    const project = makeProject({
      name: HOSTILE,
      start_date: '2026-01-01',
      target_date: '2026-03-01',
    });

    const frag = document.createElement('div');
    frag.innerHTML = Gantt.pipelineHtml([project]);

    // The month-header row also has an (empty) .gp-label; the project row's
    // label lives inside .gp-row, so scope the query there.
    const label = frag.querySelector('.gp-row .gp-label');
    expect(label).toBeTruthy();
    expect(label.getAttribute('onmouseover')).toBe(null);
    expect(label.getAttribute('title')).toBe(HOSTILE);

    const bar = frag.querySelector('.gp-row .gp-bar');
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('onmouseover')).toBe(null);
    // title is "<name>: <start> to <target>" — hostile name encoded inside.
    expect(bar.getAttribute('title')).toContain(HOSTILE);
  });
});

describe('Capacity team schedule — ts-bar title/aria-label escaping (L1/H-006)', () => {
  const HOSTILE_MEMBER = 'M' + HOSTILE;

  it('quotes in project and hand-over member names cannot break out of the bar attributes', () => {
    const { App, Capacity, document } = app;
    // A sprint spanning today so it lands in the 4-sprint horizon.
    const iso = (d) => d.toISOString().slice(0, 10);
    const start = new Date(); start.setDate(start.getDate() - 7);
    const end = new Date(); end.setDate(end.getDate() + 21);
    App.data.sprints.push({ sprint_id: 'CY26-S9', start_date: iso(start), end_date: iso(end), hardening_start: iso(end) });
    App.data.team_members.push(makeMember({ name: 'Alice' }));
    App.data.team_members.push(makeMember({ name: HOSTILE_MEMBER, primary_skills: ['UAT'] }));
    App.data.projects.push(makeProject({
      name: HOSTILE,
      size_engineering: 5,
      size_uat_adoption: 3,
      delivery_config: { phase_order: ['Data Engineering', 'UAT'] },
      skill_splits: {
        size_engineering: [{ sprint: 'CY26-S9', points: 5, status: 'pending', assigned_to: [{ member: 'Alice', points: 5 }] }],
        size_uat_adoption: [{ sprint: 'CY26-S9', points: 3, status: 'pending', assigned_to: [{ member: HOSTILE_MEMBER, points: 3 }] }]
      }
    }));

    let host = document.getElementById('teamScheduleGantt');
    if (!host) { host = document.createElement('div'); host.id = 'teamScheduleGantt'; document.body.appendChild(host); }
    Capacity.renderTeamSchedule();

    const bars = [...host.querySelectorAll('.ts-bar')];
    expect(bars.length).toBeGreaterThan(0);
    bars.forEach(bar => {
      expect(bar.getAttribute('onmouseover')).toBe(null);
    });
    // Alice's bar: hostile project name round-trips in title AND the hand-over
    // line carries the hostile member name — both encoded, neither breaks out.
    const alice = bars.find(b => (b.getAttribute('title') || '').includes('Hand over to '));
    expect(alice).toBeTruthy();
    expect(alice.getAttribute('title')).toContain(HOSTILE);
    expect(alice.getAttribute('title')).toContain('Hand over to ' + HOSTILE_MEMBER);
    expect(alice.getAttribute('aria-label')).toBe(alice.getAttribute('title'));
  });
});
