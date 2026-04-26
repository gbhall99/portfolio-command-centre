import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('POC → Implementation conversion', () => {
  it('flips lifecycle_stage and captures a baseline + audit entry', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', lifecycle_stage: 'POC', size_engineering: 10, start_date: '2026-04-01', target_date: '2026-06-30' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.App.convertToImplementation(proj.id, { sponsor: 'Sandra Lee', notes: 'Demo accepted in March steerco' });
    const after = app.App.data.projects[0];
    expect(after.lifecycle_stage).toBe('Implementation');
    expect(after.baseline_start).toBe('2026-04-01');
    expect(after.baseline_end).toBe('2026-06-30');
    const lastAudit = (app.App.data.audit_log || []).slice(-1)[0];
    expect(lastAudit.field).toBe('lifecycle_stage');
    expect(lastAudit.rationale).toMatch(/Demo accepted/);
    app.teardown();
  });
});

describe('Promote TBD phase', () => {
  it('flips a phase from tbd to planned and audits the change', async () => {
    resetIdSeq();
    const proj = makeProject({
      name: 'Disc', size_requirements: 5,
      delivery_config: { phase_order: ['Requirements', { phase: 'Data Engineering', status: 'tbd' }] }
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const ok = app.App.promoteTbdPhase(proj.id, 'Data Engineering', { rationale: 'Discovery findings landed', sizePoints: 12 });
    expect(ok).toBe(true);
    const after = app.App.data.projects[0];
    const phaseEntry = after.delivery_config.phase_order.find(e => (typeof e === 'object' ? e.phase : e) === 'Data Engineering');
    const isPlanned = (typeof phaseEntry === 'string') || (phaseEntry && phaseEntry.status === 'planned');
    expect(isPlanned).toBe(true);
    expect(after.size_engineering).toBe(12);
    const lastAudit = (app.App.data.audit_log || []).slice(-1)[0];
    expect(lastAudit.field).toBe('phase_order');
    app.teardown();
  });
});
