// Regression tests for bugs found during the production-readiness audit on
// branch `audit-f-nnn-data-integrity`. Each `describe` block is one fix —
// keep them here (rather than scattering) so a future reader can see the
// audit's footprint in one place.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeProject, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Sprint.recomputeCapacity (F-037)', () => {
  it('reads sprint_overrides.available_points (not the team-level .available_points_per_sprint key)', async () => {
    // The original F-037 implementation read `ov.available_points_per_sprint` from
    // sprint_overrides — but that field only exists at the team-member root. Inside
    // sprint_overrides the field is `available_points`. Result: overrides were
    // silently ignored on load, so `capacity_points` on each sprint was always the
    // baseline. This test locks the field name in.
    const alice = makeMember({
      name: 'Alice',
      available_points_per_sprint: 20,
      sprint_overrides: { 'CY26-S1': { available_points: 5 } }
    });
    const app = await loadApp(makeDataset({
      team_members: [alice],
      sprints: makeSprintSequence(2)
    }));
    app.Sprint.recomputeCapacity(app.App.data);
    const s1 = app.App.data.sprints.find(s => s.sprint_id === 'CY26-S1');
    const s2 = app.App.data.sprints.find(s => s.sprint_id === 'CY26-S2');
    expect(s1.capacity_points).toBe(5);   // override applied
    expect(s2.capacity_points).toBe(20);  // baseline
    app.teardown();
  });
});

describe('App.evaluateRagRules (F-018)', () => {
  it('preserves a manual override that has a reason even when the rule outcome matches', async () => {
    // The audit-fix preserves reasoned overrides: the reason is an audit trail and
    // rule inputs change over time, so silently clearing a reasoned override on the
    // one tick that the rules happen to agree would destroy user intent.
    const p = makeProject({
      id: 'Acme Industries-RAG-REASON',
      rag_schedule: 'Red',
      rag_manual_override: {
        rag_schedule: { value: 'Red', reason: 'Vendor commitment at risk', set_at: '2026-04-01T10:00:00Z' }
      }
    });
    const app = await loadApp(makeDataset({
      projects: [p],
      settings: {
        ragRules: [
          { field: 'status', operator: 'eq', value: 'In Progress', rag: 'rag_schedule', result: 'Red', active: true }
        ]
      }
    }));
    app.App.evaluateRagRules(app.App.data.projects[0]);
    const after = app.App.data.projects[0];
    expect(after.rag_manual_override.rag_schedule).toBeDefined();
    expect(after.rag_manual_override.rag_schedule.reason).toBe('Vendor commitment at risk');
    expect(after.rag_schedule).toBe('Red');
    app.teardown();
  });

  it('still clears a bare (reason-less) object override as redundant', async () => {
    // The auto-clear behaviour is only defensible for bare overrides. This keeps
    // the original "clear redundant" intent for the no-reason case.
    const p = makeProject({
      id: 'Acme Industries-RAG-BARE',
      rag_schedule: 'Red',
      rag_manual_override: {
        rag_schedule: { value: 'Red', set_at: '2026-04-01T10:00:00Z' } // no reason
      }
    });
    const app = await loadApp(makeDataset({
      projects: [p],
      settings: {
        ragRules: [
          { field: 'status', operator: 'eq', value: 'In Progress', rag: 'rag_schedule', result: 'Red', active: true }
        ]
      }
    }));
    app.App.evaluateRagRules(app.App.data.projects[0]);
    expect(app.App.data.projects[0].rag_manual_override.rag_schedule).toBeUndefined();
    expect(app.App.data.projects[0].rag_schedule).toBe('Red');
    app.teardown();
  });
});
