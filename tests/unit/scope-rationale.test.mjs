import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Scope rationale', () => {
  it('logChange records a rationale on size_engineering changes', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', size_engineering: 10 });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.App.logChange(proj.id, 'size_engineering', 10, 14, 'user', { rationale: 'New requirement from sponsor' });
    const last = app.App.data.audit_log[app.App.data.audit_log.length - 1];
    expect(last.rationale).toMatch(/sponsor/);
    app.teardown();
  });
});

describe('Persistent audit (no rollover)', () => {
  it('archives entries beyond 1000 instead of dropping them', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({}));
    for (let i = 0; i < 1100; i++) {
      app.App.logChange('p1', 'priority', i, i + 1, 'auto');
    }
    expect(app.App.data.audit_log.length).toBeLessThanOrEqual(1000);
    expect(Array.isArray(app.App.data.audit_log_archive)).toBe(true);
    expect(app.App.data.audit_log_archive.length).toBeGreaterThan(0);
    app.teardown();
  });
});
