// S4 — SOW review redline (baseline capture + per-section compare) and the
// resolved-comments approval gate.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function defFor() { return app.Definitions.loadJson('sow/sow-definition.json'); }

// A complete, approvable SOW on the default template (every required section
// filled past min_words, nothing flagged).
function makeSow() {
  const def = defFor();
  const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
  const sow = app.Sow.create({
    customer: 'Acme Industries',
    definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true })),
    name: 'Statement of Work',
    source_text: 'src'
  });
  sow.sections.forEach(s => { s.flagged = false; });
  return { sow, def };
}

describe('definition gate registration', () => {
  it('the default + quoted sets both require resolved comments', () => {
    expect(defFor().validation.approval_requires).toContain('comments_resolved');
    expect(app.Definitions.loadJson('sow-quoted/sow-definition.json').validation.approval_requires).toContain('comments_resolved');
  });
});

describe('baseline redline', () => {
  it('captures a baseline on the Review transition and reflects later edits', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    const sec0 = sow.sections[0];
    expect(sec0.baseline).toBeUndefined();        // none until a review state
    Sow.setStatus(sow.id, 'Review', def);
    const s = Sow.get(sow.id).sections[0];
    expect(s.baseline).toBe(s.content);            // snapshot equals content at review time
    expect(s.baseline_status).toBe('Review');
    expect(s.baseline_at).toBeTruthy();
    // Edit after review → baseline diverges from current (the redline).
    Sow.updateSection(sow.id, s.id, 'a wholly rewritten section body that differs');
    const after = Sow.get(sow.id).sections[0];
    expect(after.baseline).not.toBe(after.content);
    expect(after.baseline_status).toBe('Review');  // baseline unchanged by the edit
  });

  it('re-snapshots on the Approved transition', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    Sow.setStatus(sow.id, 'Review', def);
    Sow.updateSection(sow.id, sow.sections[0].id, Array.from({ length: 45 }, (_, i) => 'rev' + i).join(' '));
    Sow.setStatus(sow.id, 'Approved', def);
    const s = Sow.get(sow.id).sections[0];
    expect(s.baseline_status).toBe('Approved');
    expect(s.baseline).toBe(s.content);            // approved snapshot == approved content
  });
});

describe('resolved-comments approval gate', () => {
  it('an open comment blocks approval; resolving it clears the block', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    Sow.setStatus(sow.id, 'Review', def);
    Sow.addComment(sow.id, sow.sections[0].id, 'Tighten the scope wording');
    // New comments default to unresolved and surface in validation.
    expect(Sow.get(sow.id).sections[0].comments[0].resolved).toBe(false);
    let v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /unresolved comment/.test(e))).toBe(true);
    let res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(false);
    // Resolve → gate clears, approval succeeds.
    Sow.resolveComment(sow.id, sow.sections[0].id, 0);
    expect(Sow.get(sow.id).sections[0].comments[0].resolved).toBe(true);
    v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /unresolved comment/.test(e))).toBe(false);
    res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(true);
  });

  it('resolveComment is audited and undoable; reopen flips it back', () => {
    const { Sow, App } = app;
    const { sow } = makeSow();
    Sow.addComment(sow.id, sow.sections[0].id, 'Please clarify');
    const before = App.data.audit_log.length;
    Sow.resolveComment(sow.id, sow.sections[0].id, 0);
    expect(App.data.audit_log.length).toBeGreaterThan(before);
    App.undo();
    expect(Sow.get(sow.id).sections[0].comments[0].resolved).toBe(false);
    Sow.resolveComment(sow.id, sow.sections[0].id, 0, false); // explicit reopen no-op while open
    expect(Sow.get(sow.id).sections[0].comments[0].resolved).toBe(false);
  });
});

describe('back-compat migration', () => {
  it('legacy comments without a resolved flag are treated as resolved', () => {
    const { App } = app;
    App.data.sows.push({
      id: 'SOW-legacy', customer: 'Acme Industries', name: 'Old', status: 'Review', version: '0.1',
      template_id: 'default', template_kind: 'sow',
      sections: [{ id: 'scope', title: 'Scope', required: true, content: 'x', flagged: false,
        comments: [{ at: new Date().toISOString(), text: 'historic note' }] }],
      history: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    App.migrateSchema(App.data);
    expect(App.data.sows.find(s => s.id === 'SOW-legacy').sections[0].comments[0].resolved).toBe(true);
  });
});

describe('editor UI', () => {
  it('shows a Compare control + resolvable comments once in Review', () => {
    const { Sow, SowSkill, document } = app;
    const { sow, def } = makeSow();
    Sow.setStatus(sow.id, 'Review', def);
    Sow.addComment(sow.id, sow.sections[0].id, 'needs a tweak');
    SowSkill.open({});
    SowSkill.edit(sow.id);
    const main = document.querySelector('.sow-main');
    expect(main.textContent).toContain('Compare');
    expect(main.textContent).toContain('Resolve');
    // Open the diff view for the first section.
    SowSkill.uiToggleCompare(sow.sections[0].id);
    expect(document.getElementById('sowCompare')).toBeTruthy();
  });
});
