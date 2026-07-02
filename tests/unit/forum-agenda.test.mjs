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

describe('Forum agenda missing-id guard', () => {
  // Demo forums carry no `id` field, so a loose `f.id === forumId` match lets
  // an undefined forumId resolve to the FIRST id-less forum (undefined ===
  // undefined) and silently exports the wrong forum's agenda. A missing
  // forumId must behave like an unknown one: builder returns null,
  // Reports.generate toasts 'Meeting not found', nothing opens or audits.
  function idlessForums() {
    return [
      { name: 'Acme Delivery Forum', cadence: 'Monthly', actions: [], decisions: [] },
      { name: 'Acme Steering Board', cadence: 'Quarterly', actions: [], decisions: [] }
    ];
  }

  it('forumAgenda(undefined) returns null instead of matching the first id-less forum', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'Linked' })], sprints: makeSprintSequence(2),
      team_members: [makeMember()], governance_forums: idlessForums()
    }));
    const { Reports } = app.window.__pcc__;
    expect(Reports.Builders.forumAgenda(undefined)).toBeNull();
    expect(Reports.Builders.forumAgenda(null)).toBeNull();
    expect(Reports.Builders.forumAgenda('no-such-forum')).toBeNull();
    app.teardown();
  });

  it('buildAgendaDoc(undefined) returns null instead of the first forum agenda HTML', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'Linked' })], sprints: makeSprintSequence(2),
      team_members: [makeMember()], governance_forums: idlessForums()
    }));
    const { Governance } = app.window.__pcc__;
    expect(Governance.buildAgendaDoc(undefined)).toBeNull();
    expect(Governance.buildAgendaDoc('no-such-forum')).toBeNull();
    app.teardown();
  });

  it("generate('meeting_agenda', {}) toasts 'Meeting not found' and neither opens nor audits", async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'Linked' })], sprints: makeSprintSequence(2),
      team_members: [makeMember()], governance_forums: idlessForums()
    }));
    const { App, Reports } = app.window.__pcc__;
    const toasts = [];
    App.toast = (msg, kind) => { toasts.push({ msg, kind }); };
    let opened = 0;
    Reports.open = () => { opened++; return null; };
    const auditBefore = (App.data.audit_log || []).length;
    Reports.generate('meeting_agenda', {});
    expect(toasts).toEqual([{ msg: 'Meeting not found', kind: 'error' }]);
    expect(opened).toBe(0);
    expect((App.data.audit_log || []).length).toBe(auditBefore);
    app.teardown();
  });

  it('still resolves an id-less forum by name', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'Linked', governance_forum: 'Acme Steering Board' })],
      sprints: makeSprintSequence(2), team_members: [makeMember()],
      governance_forums: idlessForums()
    }));
    const { Reports, Governance } = app.window.__pcc__;
    const doc = Reports.Builders.forumAgenda('Acme Steering Board');
    expect(doc).toBeTruthy();
    expect(doc.title).toMatch(/Acme Steering Board/);
    const html = Governance.buildAgendaDoc('Acme Steering Board');
    expect(String(html)).toMatch(/Acme Steering Board/);
    app.teardown();
  });
});

describe('Build Agenda handler escaping (H-005 class)', () => {
  // esc() does not encode quotes, so interpolating the free-text forum name
  // into onclick="…exportForumAgenda('name')" broke the JS string on any
  // apostrophe (silently dead button) and was script-injectable via imported
  // JSON. The button is now index-based (realIdx into governance_forums, like
  // the sibling edit/delete/startMeeting handlers); exportForumAgenda resolves
  // numeric refs via the array and passes string refs through unchanged.
  async function bootForums(forums) {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'Linked' })],
      sprints: makeSprintSequence(2), team_members: [makeMember()],
      governance_forums: forums
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Governance.render();
    return app;
  }
  function agendaButtons(app) {
    return [...app.document.querySelectorAll('#govForumsContent button[title^="Build agenda pack"]')];
  }

  it("a forum named \"Bob's Steerco\" gets an index-based onclick and clicking builds the right agenda", async () => {
    const app = await bootForums([
      { name: "Bob's Steerco", customer: 'Acme Industries', cadence: 'Monthly', actions: [], decisions: [] }
    ]);
    const btn = agendaButtons(app)[0];
    expect(btn).toBeTruthy();
    const onclick = btn.getAttribute('onclick') || '';
    // Index-based call — the raw name (and its handler-breaking quote) never
    // appears in the inline handler.
    expect(onclick).toMatch(/Governance\.exportForumAgenda\(\d+\)$/);
    expect(onclick).not.toContain("Bob's");
    // Clicking routes through to Reports.generate with the correct forum.
    const { Reports } = app;
    const calls = [];
    const orig = Reports.generate;
    Reports.generate = (kind, args) => { calls.push({ kind, args }); };
    try { btn.click(); } finally { Reports.generate = orig; }
    expect(calls).toEqual([{ kind: 'meeting_agenda', args: { forumId: "Bob's Steerco" } }]);
    app.teardown();
  });

  it("a hostile name x',alert(1),' cannot alter the handler", async () => {
    const app = await bootForums([
      { name: "x',alert(1),'", customer: 'Acme Industries', cadence: 'Monthly', actions: [], decisions: [] }
    ]);
    const btn = agendaButtons(app)[0];
    expect(btn).toBeTruthy();
    const onclick = btn.getAttribute('onclick') || '';
    expect(onclick).toMatch(/^event\.stopPropagation\(\);Governance\.exportForumAgenda\(\d+\)$/);
    expect(onclick).not.toContain('alert');
    app.teardown();
  });

  it('the index survives the next_date display sort (realIdx keys the unsorted array)', async () => {
    const app = await bootForums([
      { name: 'Later Forum', customer: 'Acme Industries', cadence: 'Monthly', next_date: '2099-12-01', actions: [], decisions: [] },
      { name: 'Sooner Forum', customer: 'Acme Industries', cadence: 'Monthly', next_date: '2098-01-01', actions: [], decisions: [] }
    ]);
    // Sooner Forum sorts first on screen but is index 1 in governance_forums.
    const btns = agendaButtons(app);
    expect(btns.length).toBe(2);
    const { Reports } = app;
    const calls = [];
    const orig = Reports.generate;
    Reports.generate = (kind, args) => { calls.push(args.forumId); };
    try { btns[0].click(); btns[1].click(); } finally { Reports.generate = orig; }
    expect(calls).toEqual(['Sooner Forum', 'Later Forum']);
    app.teardown();
  });

  it('exportForumAgenda still accepts string refs (id or name) for programmatic callers', async () => {
    const app = await bootForums([
      { id: 'gf-1', name: 'Acme Forum', customer: 'Acme Industries', cadence: 'Monthly', actions: [], decisions: [] }
    ]);
    const { Governance, Reports } = app;
    const calls = [];
    const orig = Reports.generate;
    Reports.generate = (kind, args) => { calls.push(args.forumId); };
    try {
      Governance.exportForumAgenda('gf-1');
      Governance.exportForumAgenda('Acme Forum');
      Governance.exportForumAgenda(0); // numeric resolves to id first
    } finally { Reports.generate = orig; }
    expect(calls).toEqual(['gf-1', 'Acme Forum', 'gf-1']);
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
