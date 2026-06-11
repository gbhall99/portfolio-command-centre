// Status Report skill: governed generation grounded in live data, entity
// landing + audit, definition validation, editing, print export, migration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({
      id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'At Risk',
      risks_register: [{ description: 'Open risk', resolution_date: null, impact: 4, probability: 3 }]
    })],
    settings: { billing: { currency: 'USD', hours_per_point: 8, rate_table: {}, customer_defaults: {} } }
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const def = () => app.Definitions.loadJson('status-report/status-report-definition.json');

function goodSections() {
  const filler = (n) => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');
  return def().sections.map(s => ({ id: s.id, content: filler(Math.max(s.min_words || 5, 5)) }));
}

describe('migration + registration', () => {
  it('data.status_reports seeds additively; the skill and template set are registered', async () => {
    expect(Array.isArray(app.App.data.status_reports)).toBe(true);
    expect(app.Skills.get('status-report')).toBeTruthy();
    expect(app.Definitions.templateSets('status-report').map(s => s.id)).toEqual(['default']);
    const d = def();
    expect(d.sections.filter(s => s.required).map(s => s.id)).toEqual(['executive_summary', 'delivery_highlights', 'risks_and_issues', 'next_period']);
  });
});

describe('grounding', () => {
  it('compiles live project/RAID/billing facts for the prompt', () => {
    const g = app.StatusReport.groundingFor('Acme Industries');
    expect(g.projects.length).toBe(1);
    const p = g.projects[0];
    expect(p.name).toBe('Acme Alpha');
    expect(p.status).toBe('At Risk');
    expect(p.rag).toMatch(/^(Green|Amber|Red)\/(Green|Amber|Red)\/(Green|Amber|Red)$/); // live derived RAG
    expect(p.open_risks).toBe(1);
    expect(p.open_issues).toBe(0);
    expect(g.billing.has_billing_data).toBe(false);
  });
});

describe('generation via the skill (mock adapter)', () => {
  it('drafts a report whose sections follow the definition; lands as an audited entity', async () => {
    const { AI, StatusReportSkill, StatusReport, App, document } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ sections: goodSections() }) }]);
    StatusReportSkill.open({});
    document.getElementById('srPeriod').value = 'June 2026';
    await StatusReportSkill.generate();
    const reports = StatusReport.list('Acme Industries');
    expect(reports.length).toBe(1);
    expect(reports[0].period).toBe('June 2026');
    expect(reports[0].sections.map(s => s.id)).toEqual(def().sections.map(s => s.id));
    expect(StatusReport.validate(reports[0], def()).ok).toBe(true);
    expect(App.data.audit_log.some(e => e.field === 'status_report_created' && e.source === 'ai')).toBe(true);
    // The prompt carried the grounding facts, not free rein.
    const call = AI.ADAPTERS.mock._calls[0];
    expect(call.messages[1].content).toContain('GROUNDING DATA');
    expect(call.messages[1].content).toContain('Acme Alpha');
    expect(call.messages[0].content).toContain('never invent figures');
    // Undoable like everything else.
    App.undo();
    expect(StatusReport.list('Acme Industries').length).toBe(0);
  });
});

describe('validation + editing', () => {
  it('thin or empty required sections fail validation; edits are audited', () => {
    const { StatusReport, App } = app;
    const r = StatusReport.create({ customer: 'Acme Industries', period: 'July 2026', definition: def(), generatedSections: goodSections(), source: 'user' });
    StatusReport.updateSection(r.id, 'executive_summary', 'too short');
    let v = StatusReport.validate(StatusReport.get(r.id), def());
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => /Executive Summary.*too thin/.test(e))).toBe(true);
    expect(App.data.audit_log.some(e => e.field === 'status_report_section:executive_summary')).toBe(true);
    // The optional commercial section may stay empty without failing.
    StatusReport.updateSection(r.id, 'commercial_position', '');
    StatusReport.updateSection(r.id, 'executive_summary', Array.from({ length: 35 }, (_, i) => 'w' + i).join(' '));
    v = StatusReport.validate(StatusReport.get(r.id), def());
    expect(v.ok).toBe(true);
  });
});

describe('editor + export safety', () => {
  it('renders escaped content and writes a print document', () => {
    const { StatusReport, StatusReportSkill, App, window, document } = app;
    const sections = goodSections();
    sections[0].content = '<img src=x onerror=alert(1)> summary words ' + sections[0].content;
    const r = StatusReport.create({ customer: 'Acme Industries', period: 'Aug 2026', definition: def(), generatedSections: sections, source: 'user' });
    StatusReportSkill.open({});
    StatusReportSkill.edit(r.id);
    expect(document.getElementById('srModal').querySelector('img')).toBeNull();
    let written = '';
    window.open = () => ({ document: { write(h) { written += h; }, close() {} } });
    StatusReportSkill.exportPrint();
    expect(written).toContain('Status Report — Acme Industries');
    expect(written).not.toContain('<img src=x');
    expect(App.data.audit_log.some(e => e.field === 'report_generated' && e.newValue === 'status_report:Acme Industries')).toBe(true);
  });
});
