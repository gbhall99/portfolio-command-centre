import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('portfolio-data-demo.json', () => {
  it('parses as JSON', () => {
    const raw = readFileSync(resolve(process.cwd(), 'portfolio-data-demo.json'), 'utf8');
    const data = JSON.parse(raw);
    expect(data && typeof data).toBe('object');
    expect(Array.isArray(data.projects)).toBe(true);
  });

  it('has the expected shape', () => {
    const raw = readFileSync(resolve(process.cwd(), 'portfolio-data-demo.json'), 'utf8');
    const data = JSON.parse(raw);
    expect(data.projects.length).toBeGreaterThanOrEqual(10);
    expect(data.customers.length).toBe(3);
    expect(data.sprints.length).toBe(6);
    expect(data.team_members.length).toBeGreaterThanOrEqual(4);
    for (const c of data.customers) {
      expect(Array.isArray(c.sponsors)).toBe(true);
    }
    for (const p of data.projects) {
      expect(Array.isArray(p.benefits) || p.benefits === undefined).toBe(true);
      expect(Array.isArray(p.assumptions_register) || p.assumptions_register === undefined).toBe(true);
    }
  });

  it('loads via App.validateAndLoad without throwing', async () => {
    const raw = readFileSync(resolve(process.cwd(), 'portfolio-data-demo.json'), 'utf8');
    const data = JSON.parse(raw);
    const app = await loadApp(makeDataset({ projects: [] }));
    const ok = app.App.validateAndLoad(data);
    expect(ok).toBe(true);
    expect(app.App.data.projects.length).toBeGreaterThanOrEqual(10);
    app.teardown();
  });
});
