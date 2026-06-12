import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprint } from '../harness/fixtures.mjs';

describe('Reports.tokens — parity stylesheet', () => {
  it('uses the app RAG tokens, not the legacy report hex', async () => {
    const app = await loadApp(makeDataset({}));
    const css = app.Reports.tokens();
    expect(css).toContain('<style>');
    // App RAG values (parity), NOT the legacy #22c55e / #f59e0b / #ef4444 family
    expect(css).toContain('#0d9488'); // status-green
    expect(css).toContain('#d97706'); // status-amber
    expect(css).toContain('#dc2626'); // status-red
    expect(css).not.toContain('#22c55e');
    expect(css).not.toContain('#ef4444');
    // print-tuned
    expect(css).toMatch(/@page/);
    app.teardown();
  });
  it('accepts a brand primary color', async () => {
    const app = await loadApp(makeDataset({}));
    const css = app.Reports.tokens({ primaryColor: '#112233' });
    expect(css).toContain('#112233');
    app.teardown();
  });
  it('rejects a non-hex primary color (CSS injection guard)', async () => {
    const app = await loadApp(makeDataset({}));
    const hostile = '</style><script>alert(1)</script>';
    const css = app.Reports.tokens({ primaryColor: hostile });
    expect(css).not.toContain('alert(1)');
    expect(css).not.toContain('</style><script>');
    expect(css).toContain('--rp-primary:#3b82f6'); // falls back to the default
    expect(app.Reports.tokens({ primaryColor: 'red;}body{display:none' })).toContain('--rp-primary:#3b82f6');
    app.teardown();
  });
});

describe('Gantt print exports — RAG colour parity (WS-E E1)', () => {
  // The two standalone Gantt exporters carry their own stylesheets; they must
  // source the RAG family from Reports.RAG_HEX, never the legacy report hexes.
  const LEGACY = ['#22c55e', '#f59e0b', '#ef4444'];

  async function bootForExport() {
    const app = await loadApp(makeDataset({
      projects: [
        makeProject({
          id: 'ACME-RAG-1', name: 'Red Schedule', customer: 'Acme Industries',
          status: 'At Risk', rag_schedule: 'Red', rag_resourcing: 'Amber', rag_scope: 'Green',
          start_date: '2026-01-05', target_date: '2026-04-01', hard_deadline: '2026-04-15'
        }),
        makeProject({
          id: 'ACME-RAG-2', name: 'Done Deal', customer: 'Acme Industries',
          status: 'Complete', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green',
          start_date: '2026-01-05', target_date: '2026-02-20'
        }),
        makeProject({
          id: 'ACME-RAG-3', name: 'Stuck Fast', customer: 'Acme Industries',
          status: 'Blocked', rag_schedule: 'Amber', rag_resourcing: 'Red', rag_scope: 'Amber',
          start_date: '2026-01-12', target_date: '2026-05-01'
        })
      ],
      sprints: [makeSprint()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    let captured = '';
    app.Reports.open = (html) => { captured = html; return {}; };
    return { app, getCaptured: () => captured };
  }

  it('exposes Reports.RAG_HEX as the single source the exporters share', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.Reports.RAG_HEX).toEqual({ Green: '#0d9488', Amber: '#d97706', Red: '#dc2626' });
    // tokens() must be built from the same constant
    const css = app.Reports.tokens();
    expect(css).toContain('--rp-green:' + app.Reports.RAG_HEX.Green);
    expect(css).toContain('--rp-amber:' + app.Reports.RAG_HEX.Amber);
    expect(css).toContain('--rp-red:' + app.Reports.RAG_HEX.Red);
    app.teardown();
  });

  it('exportCustomerRoadmap emits the unified RAG family, never the legacy hexes', async () => {
    const { app, getCaptured } = await bootForExport();
    app.Gantt.exportCustomerRoadmap();
    const html = getCaptured();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    for (const hex of LEGACY) expect(html).not.toContain(hex);
    // :root tokens carry the app RAG values…
    expect(html).toContain('--rp-green:#0d9488');
    expect(html).toContain('--rp-amber:#d97706');
    expect(html).toContain('--rp-red:#dc2626');
    // …and the inline RAG dots / metric numbers reference the tokens, not hexes.
    expect(html).toContain('var(--rp-green)');
    expect(html).toContain('var(--rp-amber)');
    expect(html).toContain('var(--rp-red)');
    app.teardown();
  });

  it('exportPDF emits the unified RAG family, never the legacy hexes', async () => {
    const { app, getCaptured } = await bootForExport();
    app.Gantt.exportPDF();
    const html = getCaptured();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    for (const hex of LEGACY) expect(html).not.toContain(hex);
    expect(html).toContain('--rp-green:#0d9488');
    expect(html).toContain('--rp-amber:#d97706');
    expect(html).toContain('--rp-red:#dc2626');
    // RAG dots + status colours (Complete/Blocked rows exist in the fixture) use the tokens.
    expect(html).toContain('var(--rp-green)');
    expect(html).toContain('var(--rp-amber)');
    expect(html).toContain('var(--rp-red)');
    app.teardown();
  });

  it('exportBriefingPack emits the unified RAG family, never the legacy hexes', async () => {
    // The forum Briefing Pack is delivered via Reports.open + Reports.Doc.toHtml,
    // so the E1 parity invariant applies: NEVER legacy #22c55e/#ef4444/#f59e0b.
    // An overdue risk resolution date exercises the OVERDUE label in Top Risks.
    const proj = makeProject({
      id: 'ACME-BP-1', name: 'Risky Venture', customer: 'Acme Industries',
      governance_forum: 'Governance Board', status: 'In Progress',
      rag_schedule: 'Red', rag_resourcing: 'Amber', rag_scope: 'Green'
    });
    proj.risks_register = [
      { description: 'Slipped risk', action: 'Mitigate', owner: 'Alice', impact: 5, probability: 5, resolution_date: '2026-01-01' },
      { description: 'Escalated risk', action: 'Contain', owner: 'Bob', impact: 4, probability: 4, escalation_severity: 'Red', escalation_log: [{ at: new Date().toISOString(), reason: 'Vendor slipped' }] }
    ];
    const forum = {
      id: 'GovBoard', name: 'Governance Board', cadence: 'Monthly', customer: 'Acme Industries',
      actions: [{ description: 'Overdue action', owner: 'Alice', due_date: '2026-01-01', status: 'Open' }],
      decisions: []
    };
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: [makeSprint()], governance_forums: [forum]
    }));
    let captured = '';
    app.Reports.open = (html) => { captured = html; return {}; };
    app.Governance.exportBriefingPack(0);
    expect(captured).toMatch(/^<!DOCTYPE html>/);
    for (const hex of LEGACY) expect(captured).not.toContain(hex);
    // The overdue resolution-date label colours via the --rp-red token.
    expect(captured).toMatch(/color:var\(--rp-red\)[^>]*>OVERDUE/);
    app.teardown();
  });

  it('exportBriefingPack RAG dots follow Reports.RAG_HEX (no local copy to drift)', async () => {
    // Reports.RAG_HEX is documented as the ONE source of truth for print RAG hexes;
    // mutate it and prove the briefing-pack dots track it rather than a private copy.
    const proj = makeProject({
      id: 'ACME-BP-2', name: 'Dotted', customer: 'Acme Industries',
      governance_forum: 'Governance Board', status: 'In Progress',
      rag_schedule: 'Red', rag_resourcing: 'Amber', rag_scope: 'Green'
    });
    const forum = { id: 'GovBoard', name: 'Governance Board', cadence: 'Monthly', customer: 'Acme Industries', actions: [], decisions: [] };
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: [makeSprint()], governance_forums: [forum]
    }));
    let captured = '';
    app.Reports.open = (html) => { captured = html; return {}; };
    app.Reports.RAG_HEX = { Green: '#010101', Amber: '#020202', Red: '#030303' };
    app.Governance.exportBriefingPack(0);
    expect(captured).toContain('background:#030303'); // Red dot
    expect(captured).toContain('background:#020202'); // Amber dot
    expect(captured).toContain('background:#010101'); // Green dot
    app.teardown();
  });
});
