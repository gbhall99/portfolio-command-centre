import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Forum agenda generator', () => {
  it('builds an agenda doc with linked projects and open actions', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Linked', governance_forum: 'GovBoard' });
    proj.size_total = 5;
    const forum = {
      id: 'GovBoard', name: 'Governance Board', cadence: 'Monthly',
      next_date: '2026-05-15',
      actions: [{ description: 'Approve scope', owner: 'Alice', due_date: '2026-05-01', status: 'Open' }],
      decisions: []
    };
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      governance_forums: [forum]
    }));
    const Governance = app.window.__pcc__.Governance;
    expect(Governance).toBeDefined();
    const doc = Governance.buildAgendaDoc('GovBoard');
    expect(doc).toBeDefined();
    const html = String(doc);
    expect(html).toMatch(/Governance Board/);
    expect(html).toMatch(/Linked/);
    expect(html).toMatch(/Approve scope/);
    app.teardown();
  });
});

describe('Briefing pack audience tagging', () => {
  // Every builder emits sections as { id, title, html, audiences }. Sections
  // without an audiences array pass Reports.Doc._filterSections for ANY
  // audience (shown-to-all default), so internal-only content — the exec
  // summary, overdue-action escalations and the audit-log "Recent Changes"
  // table — must carry an explicit audiences: ['internal'] tag rather than
  // relying on the buildDoc call's audience: 'internal' alone.
  it('every briefing-pack section is tagged internal and none survives a customer-audience filter', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Linked', governance_forum: 'Governance Board', status: 'In Progress' });
    proj.size_total = 5;
    proj.risks_register = [
      { description: 'Plain risk', action: 'Mitigate', owner: 'Alice', impact: 4, probability: 4 },
      { description: 'Escalated risk', action: 'Contain', owner: 'Bob', impact: 5, probability: 5, escalation_severity: 'Red', escalation_log: [{ at: new Date().toISOString(), reason: 'Vendor slipped' }] }
    ];
    const forum = {
      id: 'GovBoard', name: 'Governance Board', cadence: 'Monthly',
      customer: 'Acme Industries',
      roster: [{ name: 'Alice', role: 'Accountable' }],
      minutes: [{ date: '2026-06-01', chair: 'Alice', attendees_present: ['Alice'], attendees_apologies: [], agenda: 'Review', notes: 'Internal commentary' }],
      actions: [{ description: 'Overdue action', owner: 'Alice', due_date: '2026-01-01', status: 'Open' }],
      decisions: [{ date: '2026-05-20', text: 'Approved scope change', linkedProjects: [], recordedBy: 'Alice' }]
    };
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      governance_forums: [forum],
      audit_log: [{ projectId: proj.id, projectName: 'Linked', field: 'status', oldValue: 'Not Started', newValue: 'In Progress', timestamp: new Date().toISOString() }]
    }));
    const { Governance, Reports } = app.window.__pcc__;

    // Capture the sections handed to buildDoc; suppress the print window.
    let captured = null;
    const origBuildDoc = Reports.Doc.buildDoc;
    Reports.Doc.buildDoc = function (opts) { captured = opts; return origBuildDoc.call(this, opts); };
    Reports.open = () => null;
    try {
      Governance.exportBriefingPack(0);
    } finally {
      Reports.Doc.buildDoc = origBuildDoc;
    }

    expect(captured).toBeTruthy();
    const sections = captured.sections;
    // The fixture exercises every section the pack can emit.
    const ids = sections.map(s => s.id);
    ['forum-exec', 'forum-raci', 'forum-minutes', 'forum-escalations', 'forum-decisions',
      'forum-status', 'forum-escalated-risks', 'forum-risks', 'forum-changes'].forEach(id => {
      expect(ids).toContain(id);
    });
    // Contract: explicit internal tag on every section.
    sections.forEach(s => {
      expect(s.audiences, 'section "' + s.id + '" must be tagged audiences: [\'internal\']').toEqual(['internal']);
    });
    // The leak this prevents: re-serialising the doc for a customer audience
    // must drop everything (audit log, exec summary, escalations included).
    expect(Reports.Doc._filterSections(sections, 'customer')).toEqual([]);
    app.teardown();
  });
});
