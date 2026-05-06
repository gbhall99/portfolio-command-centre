import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Project details overhaul — migration', () => {
  it('drops comms_log + comms_date + external_delivery_date', async () => {
    const p = makeProject({ id: 'X', comms_log: [{ note: 'a' }], comms_date: '2026-04-01', external_delivery_date: '2026-09-01' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'X');
    expect(got.comms_log).toBeUndefined();
    expect(got.comms_date).toBeUndefined();
    expect(got.external_delivery_date).toBeUndefined();
    app.teardown();
  });

  it('migrates assumptions string to assumptions_register array', async () => {
    const p = makeProject({ id: 'A', assumptions: 'Stakeholders sign off by S5' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'A');
    expect(Array.isArray(got.assumptions_register)).toBe(true);
    expect(got.assumptions_register.length).toBe(1);
    expect(got.assumptions_register[0].text).toBe('Stakeholders sign off by S5');
    expect(got.assumptions).toBeUndefined();
    app.teardown();
  });

  it('migrates benefits string to a single-entry array', async () => {
    const p = makeProject({ id: 'B', benefits: 'Saves time and money' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'B');
    expect(Array.isArray(got.benefits)).toBe(true);
    expect(got.benefits.length).toBe(1);
    expect(got.benefits[0].description).toBe('Saves time and money');
    app.teardown();
  });

  it('initialises success_criteria to []', async () => {
    const p = makeProject({ id: 'S' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    expect(app.App.data.projects[0].success_criteria).toEqual([]);
    app.teardown();
  });

  it('seeds customer.sponsors from existing project sponsors', async () => {
    const dataset = makeDataset({
      projects: [
        makeProject({ id: 'P1', customer: 'GCC', sponsor: 'Sarah T.' }),
        makeProject({ id: 'P2', customer: 'GCC', sponsor: 'James M.' }),
        makeProject({ id: 'P3', customer: 'KS',  sponsor: 'Riley P.' })
      ]
    });
    // Strip seed sponsors so we test real seeding
    if (dataset.customers) dataset.customers.forEach(c => { delete c.sponsors; });
    const app = await loadApp(dataset);
    const gcc = app.App.data.customers.find(c => c.name === 'GCC');
    expect(gcc).toBeTruthy();
    expect(Array.isArray(gcc.sponsors)).toBe(true);
    expect(gcc.sponsors).toEqual(expect.arrayContaining(['Sarah T.', 'James M.']));
    app.teardown();
  });
});
