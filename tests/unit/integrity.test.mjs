// validateDataIntegrity — guard rail for JSON hand-edits and solver bugs.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, resetIdSeq } from '../harness/fixtures.mjs';

describe('validateDataIntegrity', () => {
  it('flags duplicate project ids', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-DUP' });
    const b = makeProject({ id: 'GCC-DUP' });
    const app = await loadApp(makeDataset({ projects: [a, b] }));
    const issues = app.App.validateDataIntegrity();
    expect(issues.some(i => i.message.includes('Duplicate project ID: GCC-DUP'))).toBe(true);
    app.teardown();
  });

  it('flags dependencies pointing to non-existent projects', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-P', dependencies: [{ type: 'blocked_by', target_id: 'NOT-REAL' }] });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const issues = app.App.validateDataIntegrity();
    expect(issues.some(i => i.message.includes('non-existent project ID: NOT-REAL'))).toBe(true);
    app.teardown();
  });

  it('flags skill_splits referencing missing sprints', async () => {
    resetIdSeq();
    const p = makeProject({
      id: 'GCC-X',
      skill_splits: { size_engineering: [{ sprint: 'CY99-NOPE', points: 5 }] }
    });
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(1) }));
    const issues = app.App.validateDataIntegrity();
    expect(issues.some(i => i.message.includes('non-existent sprint: CY99-NOPE'))).toBe(true);
    app.teardown();
  });

  it('clean dataset returns no error-severity issues', async () => {
    const app = await loadApp();
    const issues = app.App.validateDataIntegrity();
    const errors = issues.filter(i => i.type === 'error');
    expect(errors.length).toBe(0);
    app.teardown();
  });
});
