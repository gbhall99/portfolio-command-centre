import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Report.openSprintBriefPicker', () => {
  it('exists as a function', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()], sprints: makeSprintSequence(3) }));
    expect(typeof app.Report.openSprintBriefPicker).toBe('function');
    app.teardown();
  });
});
