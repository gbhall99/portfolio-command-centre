// WS4 — Skills framework + governed definitions: authored-vs-embedded sync
// (anti-drift), manifest integrity, per-customer template selection and
// enablement, registry contract, migration of new entity collections.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let app;
beforeAll(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ projects: [makeProject()] }));
  app.App.activeCustomer = 'Acme Industries';
});
afterAll(() => app.teardown());

describe('authored definitions stay in sync with the embedded islands', () => {
  const files = walk(path.join(ROOT, 'definitions')).map(p =>
    path.relative(path.join(ROOT, 'definitions'), p).split(path.sep).join('/'));

  it('finds the authored definition files', () => {
    expect(files).toContain('manifest.json');
    expect(files).toContain('sow/sow-definition.json');
    expect(files).toContain('sow/sow-template.md');
    expect(files).toContain('sow/sow-style.md');
    expect(files).toContain('tableau/wireframe-definition.json');
    expect(files).toContain('tableau/tableau-design-guidelines.md');
  });

  it.each(files)('embedded island matches authored file: %s', (rel) => {
    const authored = fs.readFileSync(path.join(ROOT, 'definitions', rel), 'utf8');
    const embedded = app.Definitions.loadText(rel);
    expect(embedded, rel + ' missing from index.html — run node scripts/embed-definitions.mjs').not.toBeNull();
    expect(embedded).toBe(authored);
  });

  it('every manifest file reference resolves', () => {
    const manifest = app.Definitions.manifest();
    Object.keys(manifest).forEach(kind => {
      if (!Array.isArray(manifest[kind])) return;
      manifest[kind].forEach(set => {
        Object.values(set.files).forEach(rel => {
          expect(files, 'manifest references missing file ' + rel).toContain(rel);
        });
      });
    });
  });
});

describe('definition content contract', () => {
  it('sow-definition has ordered sections, required flags and entity mappings', () => {
    const def = app.Definitions.loadJson('sow/sow-definition.json');
    expect(def.kind).toBe('sow');
    const orders = def.sections.map(s => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(def.sections.filter(s => s.required).length).toBeGreaterThanOrEqual(8);
    expect(def.entity_mappings.deliverables.valid_phases).toContain('Data Engineering');
    expect(def.validation.approval_requires).toContain('no_unresolved_flags');
    // Template placeholders cover every section id.
    const template = app.Definitions.loadText('sow/sow-template.md');
    def.sections.forEach(s => expect(template).toContain('{{' + s.id + '}}'));
  });

  it('wireframe-definition has a grid, a component vocabulary and rules', () => {
    const def = app.Definitions.loadJson('tableau/wireframe-definition.json');
    expect(def.grid.cols).toBe(12);
    expect(def.grid.rows).toBe(8);
    const types = def.components.map(c => c.type);
    ['title', 'kpi', 'bar', 'line', 'table', 'map', 'filter', 'container'].forEach(t => expect(types).toContain(t));
    const ruleIds = def.rules.map(r => r.id);
    ['title_required', 'no_overlap', 'on_grid', 'min_size'].forEach(r => expect(ruleIds).toContain(r));
    def.rules.forEach(r => expect(['error', 'warning']).toContain(r.severity));
  });
});

describe('per-customer template selection + enablement', () => {
  it('defaults to the first set and persists a per-customer override in settings', () => {
    const { Definitions, App } = app;
    expect(Definitions.selectedSetId('sow', 'Acme Industries')).toBe('default');
    Definitions.setSelectedSetId('sow', 'Acme Industries', 'default');
    expect(App.data.settings.skill_templates['Acme Industries'].sow).toBe('default');
    // An unknown saved id falls back to the first set rather than breaking.
    App.data.settings.skill_templates['Acme Industries'].sow = 'deleted-set';
    expect(Definitions.selectedSetId('sow', 'Acme Industries')).toBe('default');
    delete App.data.settings.skill_templates['Acme Industries'];
  });

  it('resolve() returns parsed definition + raw template/style text', () => {
    const r = app.Definitions.resolve('sow', 'Acme Industries');
    expect(r.id).toBe('default');
    expect(r.files.definition.kind).toBe('sow');
    expect(r.files.template).toContain('{{executive_summary}}');
    expect(r.files.style).toContain('Grounding rules');
  });

  it('skills are enabled by default; disable persists per customer', () => {
    const { Skills, App } = app;
    Skills.register({ id: 'test-skill', name: 'Test', icon: '<svg></svg>', description: 'd', produces: 'x', definitionKind: null, requiredCapabilities: [], approval: 'none', open() {} });
    expect(Skills.isEnabled('test-skill', 'Acme Industries')).toBe(true);
    Skills.setEnabled('test-skill', 'Acme Industries', false);
    expect(Skills.isEnabled('test-skill', 'Acme Industries')).toBe(false);
    expect(Skills.isEnabled('test-skill', 'Globex')).toBe(true); // other customers unaffected
    expect(App.data.settings.skills_enabled['Acme Industries']['test-skill']).toBe(false);
  });

  it('register is idempotent and the registry keeps descriptor shape', () => {
    const { Skills } = app;
    const before = Skills.list().length;
    Skills.register({ id: 'test-skill', name: 'Duplicate', icon: '', description: '', produces: '', open() {} });
    expect(Skills.list().length).toBe(before);
    Skills.list().forEach(s => {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.open).toBe('function');
    });
  });
});

describe('migration — new entity collections', () => {
  it('legacy datasets gain empty sows/wireframes arrays; existing entries survive', async () => {
    resetIdSeq();
    const legacy = makeDataset({ projects: [makeProject()] });
    delete legacy.sows;
    delete legacy.wireframes;
    const a2 = await loadApp(legacy);
    expect(Array.isArray(a2.App.data.sows)).toBe(true);
    expect(Array.isArray(a2.App.data.wireframes)).toBe(true);
    a2.teardown();

    resetIdSeq();
    const withSow = makeDataset({ projects: [makeProject()], sows: [{ id: 'SOW-1', customer: 'Acme Industries', status: 'Draft', sections: [] }] });
    const a3 = await loadApp(withSow);
    expect(a3.App.data.sows.length).toBe(1);
    expect(a3.App.data.sows[0].id).toBe('SOW-1');
    a3.teardown();
  });

  it('settings defaults seed skill_templates and skills_enabled maps', () => {
    expect(typeof app.App.data.settings.skill_templates).toBe('object');
    expect(typeof app.App.data.settings.skills_enabled).toBe('object');
  });
});
