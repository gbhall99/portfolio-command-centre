// Phase 3.1 — living documents. Source-drift detection + one-click refresh,
// generalising the SOW stale-quote pattern to status reports. Mock adapter only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({
      id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'In Progress',
      risks_register: [{ description: 'Open risk', resolution_date: null, impact: 4, probability: 3 }]
    })],
    settings: { billing: { currency: 'USD', hours_per_point: 8, rate_table: {}, customer_defaults: {} } }
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const def = () => app.Definitions.loadJson('status-report/status-report-definition.json');
const sections = () => def().sections.map(s => ({ id: s.id, content: 'Initial content for ' + s.id + ' '.repeat(0) + 'lorem ipsum dolor sit amet.' }));
function makeReport() {
  return app.StatusReport.create({ customer: 'Acme Industries', period: 'June 2026', definition: def(), generatedSections: sections(), source: 'ai' });
}

describe('drift detection', () => {
  it('stores a grounding snapshot at create and is not stale immediately', () => {
    const r = makeReport();
    expect(typeof r.grounding_snapshot).toBe('string');
    expect(app.StatusReport.isStale(r)).toBe(false);
  });

  it('the snapshot excludes as_at so it is stable on a quiet day', () => {
    const r = makeReport();
    // Re-querying the signature with no data change must equal the stored one.
    expect(app.StatusReport.groundingSignature('Acme Industries')).toBe(r.grounding_snapshot);
    expect(r.grounding_snapshot).not.toContain('as_at');
  });

  it('goes stale when project status / RAID drifts', () => {
    const r = makeReport();
    expect(app.StatusReport.isStale(r)).toBe(false);
    app.App.data.projects[0].status = 'At Risk';
    expect(app.StatusReport.isStale(r)).toBe(true);
  });

  it('goes stale when a new open risk is added', () => {
    const r = makeReport();
    app.App.data.projects[0].risks_register.push({ description: 'New risk', resolution_date: null });
    expect(app.StatusReport.isStale(r)).toBe(true);
  });

  it('a legacy report with no snapshot is never flagged stale', () => {
    const r = makeReport();
    r.grounding_snapshot = null; // simulate a pre-3.1 report
    app.App.data.projects[0].status = 'Blocked';
    expect(app.StatusReport.isStale(r)).toBe(false);
  });
});

describe('refresh (redline + audit)', () => {
  it('applyRefresh updates only changed sections, clears staleness, audits, and is undoable', () => {
    const { StatusReport, App } = app;
    const r = makeReport();
    App.data.projects[0].status = 'At Risk';
    expect(StatusReport.isStale(r)).toBe(true);
    const firstId = r.sections[0].id;
    const newSections = r.sections.map((s, i) => ({ id: s.id, content: i === 0 ? 'COMPLETELY NEW summary text.' : s.content }));
    const before = r.sections[0].content;
    const changed = StatusReport.applyRefresh(r.id, newSections, 'ai');
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe(firstId);
    expect(changed[0].before).toBe(before);
    expect(r.sections[0].content).toBe('COMPLETELY NEW summary text.');
    // Snapshot refreshed → no longer stale.
    expect(StatusReport.isStale(r)).toBe(false);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'status_report_refreshed')).toBe(true);
    // Undo restores the prior content AND the prior (stale) snapshot.
    App.undo();
    expect(app.StatusReport.get(r.id).sections[0].content).toBe(before);
    expect(app.StatusReport.isStale(app.StatusReport.get(r.id))).toBe(true);
  });

  it('StatusReportSkill.refresh re-grounds via the model and clears staleness', async () => {
    const { AI, StatusReport, StatusReportSkill, document } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    const r = makeReport();
    app.App.data.projects[0].status = 'Blocked';
    expect(StatusReport.isStale(r)).toBe(true);
    // Program the structuredOutput JSON the refresh expects.
    const payload = { sections: def().sections.map(s => ({ id: s.id, content: 'Refreshed ' + s.id + ' narrative.' })) };
    AI.ADAPTERS.mock.program([{ text: JSON.stringify(payload) }]);
    StatusReportSkill._id = r.id; StatusReportSkill._mode = 'edit';
    await StatusReportSkill.refresh(r.id);
    expect(StatusReport.get(r.id).sections[0].content).toMatch(/^Refreshed /);
    expect(StatusReport.isStale(StatusReport.get(r.id))).toBe(false);
  });
});

describe('SOW shares the living-doc contract', () => {
  it('Sow.isStale delegates to quoteIsStale', () => {
    const { Sow } = app;
    const orig = Sow.quoteIsStale;
    try {
      Sow.quoteIsStale = () => true;
      expect(Sow.isStale({})).toBe(true);
      Sow.quoteIsStale = () => false;
      expect(Sow.isStale({})).toBe(false);
    } finally { Sow.quoteIsStale = orig; }
  });
});
