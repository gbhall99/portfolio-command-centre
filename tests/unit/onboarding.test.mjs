// Conversational onboarding wizard — deterministic core: per-slot Q&A,
// "paste it all at once", prior-project suggestions, resume, and create().

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
afterEach(() => app && app.teardown());

async function boot(projects = []) {
  resetIdSeq();
  app = await loadApp(makeDataset({ projects }));
  app.App.activeCustomer = 'Acme Industries';
  return app.ProjectWizard;
}

describe('coaxed Q&A flow', () => {
  it('asks for a name, lets optionals be skipped, and creates a valid project', async () => {
    const O = await boot();
    O.open('Acme Industries');
    O.submitAnswer('Test Project');     // name
    O.submitAnswer('done');             // jump to summary (only name required)
    const proj = O.create();
    expect(proj.name).toBe('Test Project');
    expect(proj.customer).toBe('Acme Industries');
    expect(proj.status).toBe('Not Started');
    expect(app.App.data.projects.some(p => p.id === proj.id)).toBe(true);
    // Draft cleared after create.
    expect(app.App.uiStateGet('onboarding.draft.Acme Industries', null)).toBe(null);
  });

  it('rejects an empty name (required) but accepts skip for optionals', async () => {
    const O = await boot();
    O.open('Acme Industries');
    O.submitAnswer('   ');               // ignored (empty)
    expect('name' in O._state.answers).toBe(false);
    O.submitAnswer('Alpha');
    expect(O._state.answers.name).toBe('Alpha');
    O.submitAnswer('skip');              // manager skipped
    expect(O._state.answers.manager).toBe('');
  });
});

describe('paste it all at once', () => {
  it('fills multiple fields from field: value lines', async () => {
    const O = await boot();
    O.open('Acme Industries');
    O.submitAnswer('name: Bravo; manager: Dana; size: 20; deadline: 2026-09-01; priority: Must; stage: Discovery');
    const a = O._state.answers;
    expect(a.name).toBe('Bravo');
    expect(a.manager).toBe('Dana');
    expect(a.size_total).toBe(20);
    expect(a.hard_deadline).toBe('2026-09-01');
    expect(a.moscow).toBe('Must');
    expect(a.lifecycle_stage).toBe('Discovery');
    const proj = O.create();
    expect(proj.size_total).toBe(20);          // split across phase skills, sums back
    expect(proj.hard_deadline).toBe('2026-09-01');
    expect(proj.moscow).toBe('Must');
  });

  it('ignores an invalid date rather than recording it', async () => {
    const O = await boot();
    O.open('Acme Industries');
    O.submitAnswer('Gamma');   // name
    O.submitAnswer('skip');    // manager
    O.submitAnswer('skip');    // lifecycle
    O.submitAnswer('skip');    // size → now on target_date
    O.submitAnswer('not-a-date');               // target_date slot rejects → no change
    expect(O._state.answers.target_date).toBeUndefined();
  });
});

describe('proactive suggestions from prior projects', () => {
  it('derives the common manager/category and a typical size, and "yes" accepts it', async () => {
    const O = await boot();
    // Control the project set exactly (the fixture dataset seeds extras).
    app.App.data.projects = [
      { customer: 'Acme Industries', manager: 'Dana', category: 'Analytics', size_total: 10 },
      { customer: 'Acme Industries', manager: 'Dana', category: 'Analytics', size_total: 20 }
    ];
    const sug = O._suggestionsFor('Acme Industries');
    expect(sug.manager).toBe('Dana');
    expect(sug.category).toBe('Analytics');
    expect(sug.size_total).toBe(15);
    O.open('Acme Industries');
    O.submitAnswer('Charlie');                  // name → advances to manager
    O.submitAnswer('yes');                       // accept suggested manager
    expect(O._state.answers.manager).toBe('Dana');
  });
});

describe('resume', () => {
  it('persists a draft per customer and restores it on reopen', async () => {
    const O = await boot();
    O.open('Acme Industries');
    O.submitAnswer('Delta');                     // persisted
    O.close();
    O.open('Acme Industries');                   // reopen
    expect(O._state.answers.name).toBe('Delta');
  });
});
