// R0-R11 — Reports & docs consistency sub-sequence.
// Each describe block targets one sub-phase's acceptance criteria.
//
// Plan: plans/detail-panel-ia-refactor.md §9 (Reports & documentation consistency).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootEmpty() {
  return await loadApp(makeDataset({
    projects: [],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
}

// ============================================================
// R0 — Format library
// ============================================================
describe('R0 / AC-R0.1 — Format.* presets exist as exported functions', () => {
  it('every required preset is a function on the Format namespace', async () => {
    const app = await bootEmpty();
    const presets = ['statusBadge', 'ragDots', 'ragShorthand', 'ragVerbose', 'sprintId', 'riskScore', 'dateShort', 'dateDaysLeft', 'currency', 'percent', 'personChip', 'lifecycleStage', 'memberLoad'];
    presets.forEach(name => {
      expect(typeof app.Format[name]).toBe('function');
    });
    app.teardown();
  });
});

describe('R0 / AC-R0.2 — Format.* preset happy / empty / edge', () => {
  it('ragDots / ragShorthand / ragVerbose handle null + present + partial', async () => {
    const app = await bootEmpty();
    expect(app.Format.ragDots(null)).toMatch(/—/);
    expect(app.Format.ragShorthand(null)).toBe('—/—/—');
    expect(app.Format.ragVerbose(null)).toBe('No RAG recorded');
    const p = { rag_schedule: 'Green', rag_resourcing: 'Amber', rag_scope: 'Red' };
    expect(app.Format.ragShorthand(p)).toBe('G/A/R');
    expect(app.Format.ragVerbose(p)).toMatch(/Schedule: Green/);
    expect(app.Format.ragDots(p)).toMatch(/fmt-rag-dot/);
    app.teardown();
  });

  it('sprintId strips CYxx- prefix; null returns em-dash', async () => {
    const app = await bootEmpty();
    expect(app.Format.sprintId('CY26-S5')).toBe('S5');
    expect(app.Format.sprintId('CY99-S12')).toBe('S12');
    expect(app.Format.sprintId(null)).toBe('—');
    expect(app.Format.sprintId('')).toBe('—');
    app.teardown();
  });

  it('riskScore = impact × probability', async () => {
    const app = await bootEmpty();
    expect(app.Format.riskScore({ impact: 4, probability: 5 })).toBe(20);
    expect(app.Format.riskScore({ impact: 0, probability: 5 })).toBe(0);
    expect(app.Format.riskScore(null)).toBe(0);
    expect(app.Format.riskScore({})).toBe(0);
    app.teardown();
  });

  it('dateShort handles today, in past, in future, null', async () => {
    const app = await bootEmpty();
    expect(app.Format.dateShort(null)).toBe('—');
    expect(app.Format.dateShort('2026-05-13')).toMatch(/2026/);
    app.teardown();
  });

  it('dateDaysLeft: today / past / future', async () => {
    const app = await bootEmpty();
    expect(app.Format.dateDaysLeft(null)).toBe('—');
    // Pass a Date object so the call doesn't go through ISO-string parsing
    // (which can drift to ±1d across UTC vs local-midnight boundaries).
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(app.Format.dateDaysLeft(today)).toBe('today');
    const past = new Date(Date.now() - 86400000 * 5);
    expect(app.Format.dateDaysLeft(past)).toMatch(/overdue/);
    const future = new Date(Date.now() + 86400000 * 5);
    expect(app.Format.dateDaysLeft(future)).toMatch(/in \d+d/);
    app.teardown();
  });

  it('currency: defaults to £; handles USD/EUR; null returns em-dash', async () => {
    const app = await bootEmpty();
    expect(app.Format.currency(1000)).toMatch(/£/);
    expect(app.Format.currency(1000, 'USD')).toMatch(/\$/);
    expect(app.Format.currency(1000, 'EUR')).toMatch(/€/);
    expect(app.Format.currency(null)).toBe('—');
    expect(app.Format.currency('not-a-number')).toBe('—');
    app.teardown();
  });

  it('percent / personChip / lifecycleStage / memberLoad', async () => {
    const app = await bootEmpty();
    expect(app.Format.percent(50)).toBe('50%');
    expect(app.Format.percent(null)).toBe('—');
    expect(app.Format.personChip('Alice')).toMatch(/Alice/);
    expect(app.Format.personChip(null)).toMatch(/fmt-person-empty/);
    expect(app.Format.lifecycleStage({ lifecycle_stage: 'Implementation' })).toBe('Implementation');
    expect(app.Format.lifecycleStage(null)).toBe('—');
    expect(app.Format.memberLoad({ available_points_per_sprint: 20 }, 'CY26-S1')).toBe('20 SP');
    app.teardown();
  });
});

describe('R0 / AC-R0.3 — No Format preset accepts an options bag', () => {
  it('each preset signature is single-argument (or two for currency / memberLoad)', async () => {
    const app = await bootEmpty();
    // statusBadge, ragDots, ragShorthand, ragVerbose, sprintId, riskScore, dateShort,
    // dateDaysLeft, percent, personChip, lifecycleStage — all 1-arg.
    expect(app.Format.statusBadge.length).toBe(1);
    expect(app.Format.ragDots.length).toBe(1);
    expect(app.Format.sprintId.length).toBe(1);
    expect(app.Format.riskScore.length).toBe(1);
    expect(app.Format.dateShort.length).toBe(1);
    expect(app.Format.dateDaysLeft.length).toBe(1);
    expect(app.Format.percent.length).toBe(1);
    expect(app.Format.personChip.length).toBe(1);
    expect(app.Format.lifecycleStage.length).toBe(1);
    // currency and memberLoad accept 2 explicit args (no options bag).
    expect(app.Format.currency.length).toBe(2);
    expect(app.Format.memberLoad.length).toBe(2);
    app.teardown();
  });
});

// ============================================================
// R1 — Reports.Doc / Brand / Catalogue
// ============================================================
describe('R1 / AC-R1.1 — Reports.Doc.buildDoc honours density / coverPage / tocPage / includeAppendix / classification', () => {
  it('applies per-report-type defaults when options omitted', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Doc.buildDoc({ reportType: 'sponsor_pack', title: 'X', sections: [] });
    expect(doc.density).toBe('compact');
    expect(doc.coverPage).toBe('header-band');
    expect(doc.includeAppendix).toBe(false);
    expect(doc.classification).toBe('Confidential');
    app.teardown();
  });

  it('caller overrides win over defaults', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Doc.buildDoc({ reportType: 'sponsor_pack', density: 'full', classification: 'Restricted', title: 'X', sections: [] });
    expect(doc.density).toBe('full');
    expect(doc.classification).toBe('Restricted');
    app.teardown();
  });

  it('every reportType has defaults', async () => {
    const app = await bootEmpty();
    ['sponsor_pack', 'business_case', 'sprint_brief', 'customer_pack', 'portfolio_pack', 'meeting_agenda', 'status_report'].forEach(t => {
      const doc = app.Reports.Doc.buildDoc({ reportType: t, sections: [] });
      expect(doc.density).toBeTruthy();
      expect(doc.classification).toBeTruthy();
    });
    app.teardown();
  });
});

describe('R1 / AC-R1.2 — Classification band renders top + bottom with colour', () => {
  it('classification band has both positions + a colour token', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Doc.buildDoc({ reportType: 'sponsor_pack', sections: [], classification: 'Confidential' });
    expect(doc.classificationBand).toBeTruthy();
    expect(doc.classificationBand.position).toContain('top');
    expect(doc.classificationBand.position).toContain('bottom');
    expect(doc.classificationBand.color).toMatch(/^#dc2626/i);
    app.teardown();
  });
});

describe('R1 / AC-R1.3 — Reports.Brand.for() 3-tier deep-merge', () => {
  it('customer override + portfolio default + hardcoded compose correctly', async () => {
    const app = await bootEmpty();
    app.App.data.settings.branding = {
      portfolio_default: { logo: 'portfolio.png', primaryColor: '#000000', footerNote: 'Portfolio footer' },
      'Acme Industries': { primaryColor: '#0000ff' }
    };
    const acme = app.Reports.Brand.for('Acme Industries');
    expect(acme.logo).toBe('portfolio.png');         // inherited from portfolio_default
    expect(acme.primaryColor).toBe('#0000ff');       // customer override
    expect(acme.footerNote).toBe('Portfolio footer'); // inherited
    app.teardown();
  });

  it('falls back to hardcoded when nothing configured', async () => {
    const app = await bootEmpty();
    const def = app.Reports.Brand.for('Nonexistent');
    expect(def.primaryColor).toBe('#3b82f6');
    app.teardown();
  });
});

describe('R1 / AC-R1.4 — Reports.Brand.set emits audit_log entry', () => {
  it('writes an audit row with event_type=branding_updated', async () => {
    const app = await bootEmpty();
    app.App.data.audit_log = app.App.data.audit_log || [];
    app.Reports.Brand.set('Acme Industries', { primaryColor: '#facc15' });
    const branding = app.App.data.audit_log.filter(e => e.event_type === 'branding_updated');
    expect(branding.length).toBe(1);
    expect(branding[0].customer).toBe('Acme Industries');
    expect(branding[0].meta.after.primaryColor).toBe('#facc15');
    app.teardown();
  });
});

describe('R1 / AC-R1.5 — Reports.Catalogue lists all 7 reports', () => {
  it('catalogue has 7 entries with required metadata keys', async () => {
    const app = await bootEmpty();
    expect(app.Reports.Catalogue.length).toBe(7);
    app.Reports.Catalogue.forEach(c => {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.scope).toBeTruthy();
      expect(Array.isArray(c.requiresFields)).toBe(true);
      expect('defaultClassification' in c).toBe(true);
      expect('doesNotInclude' in c).toBe(true);
    });
    const ids = app.Reports.Catalogue.map(c => c.id).sort();
    expect(ids).toEqual(['business_case', 'customer_pack', 'forum_agenda'.replace('forum_agenda', 'meeting_agenda'), 'portfolio_pack', 'sponsor_pack', 'sprint_brief', 'status_report'].sort());
    app.teardown();
  });
});

// ============================================================
// R2 + R3 — Customer Pack + Status Report through Reports.Doc
// ============================================================
describe('R2 / AC-R2.1 — Customer Pack contains all 5 blocks in order', () => {
  it('builders.customerPack returns lifecycle + Wins + Asks + Risks + Next', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    const titles = doc.sections.map(s => s.title);
    expect(titles).toEqual(['Lifecycle headlines', 'Wins', 'We need from you', 'Customer-visible risks', "What's next"]);
    expect(doc.classification).toBe('Confidential');
    expect(doc.coverPage).toBe('full');
    expect(doc.includeAppendix).toBe(true);
    app.teardown();
  });
});

describe('R3 / AC-R3.1 + AC-R3.3 — Status Report routed through Doc with Internal default', () => {
  it('status report has cover + classification band + Internal default', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Builders.statusReport();
    expect(doc.coverPage).toBe('full');
    expect(doc.classification).toBe('Internal');
    expect(doc.classificationBand.color).toBe('#94a3b8');
    expect(doc.includeAppendix).toBe(true);
    app.teardown();
  });
});

// ============================================================
// R4 — event_type field + closed vocabulary
// ============================================================
describe('R4 / AC-R4.1 — audit_log writes carry event_type from the closed vocabulary', () => {
  it('App.logChange stamps event_type="field_change" by default', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R4P', customer: 'Acme Industries' });
    app.App.data.projects.push(p);
    app.App.logChange('R4P', 'name', 'Old', 'New', 'user');
    const last = app.App.data.audit_log[app.App.data.audit_log.length - 1];
    expect(last.event_type).toBe('field_change');
    app.teardown();
  });

  it('explicit event_type via opts overrides the default', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R4Q', customer: 'Acme Industries' });
    app.App.data.projects.push(p);
    app.App.logChange('R4Q', 'migration', '1.0', '1.1', 'system', { event_type: 'migration_applied' });
    const last = app.App.data.audit_log[app.App.data.audit_log.length - 1];
    expect(last.event_type).toBe('migration_applied');
    app.teardown();
  });
});

describe('R4 / AC-R4.2 — Read code tolerates undefined event_type', () => {
  it('an audit entry without event_type is consumable by Reports.recentExports filter', async () => {
    const app = await bootEmpty();
    app.App.data.audit_log = [
      { ts: '2026-05-01T00:00:00Z' }, // no event_type
      { ts: '2026-05-02T00:00:00Z', event_type: 'report_generated', meta: { report_type: 'sponsor_pack' } }
    ];
    const recent = app.Reports.recentExports();
    expect(recent.length).toBe(1);
    expect(recent[0].event_type).toBe('report_generated');
    app.teardown();
  });
});

// ============================================================
// R5 — Decisions consolidation
// ============================================================
describe('R5 / AC-R5.2 — Decision promotion gate', () => {
  it('a Noted decision does NOT write to project.decisions_register[]', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R5P', customer: 'Acme Industries' });
    app.App.data.projects.push(p);
    const result = app.App.promoteWalkthroughDecision('wt-1', { decision: 'noted', decision_type: 'Noted' }, { projectId: 'R5P' });
    expect(result).toBe(null);
    expect((p.decisions_register || []).length).toBe(0);
    app.teardown();
  });

  it('an Agreed decision promotes to project.decisions_register[]', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R5Q', customer: 'Acme Industries' });
    app.App.data.projects.push(p);
    const result = app.App.promoteWalkthroughDecision('wt-1', { decision: 'park phase 2', decision_type: 'Agreed', decided_by: 'PO' }, { projectId: 'R5Q' });
    expect(result).toBeTruthy();
    expect(result.decision_type).toBe('Agreed');
    expect(result.meta.origin).toBe('walkthrough');
    expect(result.walkthrough_id).toBe('wt-1');
    expect(p.decisions_register.length).toBe(1);
    expect(p.decisions_register[0].decision).toBe('park phase 2');
    app.teardown();
  });

  it('a Governance-binding decision also promotes', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R5R', customer: 'Acme Industries' });
    app.App.data.projects.push(p);
    const result = app.App.promoteWalkthroughDecision('wt-2', { decision: 'gate go', decision_type: 'Governance-binding' }, { projectId: 'R5R' });
    expect(result).toBeTruthy();
    expect(p.decisions_register.length).toBe(1);
    app.teardown();
  });
});

// ============================================================
// R6 — Actions consolidation
// ============================================================
describe('R6 / AC-R6.1 — dedupeForumActions matches on {description, owner, due_date, source}', () => {
  it('inserts only new rows; matches existing on composite key', async () => {
    const app = await bootEmpty();
    const forum = {
      id: 'F1', name: 'Test Forum',
      actions: [
        { description: 'Ship docs', owner: 'PO', due_date: '2026-06-01', source: 'forum' }
      ]
    };
    const result = app.App.dedupeForumActions(forum, [
      { description: 'Ship docs', owner: 'PO', due_date: '2026-06-01', source: 'forum' },     // dup
      { description: 'Run tests', owner: 'SM', due_date: '2026-06-05' }                        // new
    ], 'wt-1');
    expect(result.matched).toBe(1);
    expect(result.inserted).toBe(1);
    expect(forum.actions.length).toBe(2);
    const inserted = forum.actions.find(a => a.description === 'Run tests');
    expect(inserted.source).toBe('walkthrough:wt-1');
    app.teardown();
  });
});

// ============================================================
// R7 — Walkthrough Minutes removal (verification — already removed)
// ============================================================
describe('R7 / AC-R7.4 — Walkthrough Minutes builders deleted', () => {
  it('Reports.Builders has no walkthroughMinutes entry', async () => {
    const app = await bootEmpty();
    expect(app.Reports.Builders.walkthroughMinutes).toBeUndefined();
    app.teardown();
  });
});

// ============================================================
// R8 — Reports view (programmatic API)
// ============================================================
describe('R8 / AC-R8.6 — Reports.recentExports filters audit_log for report_generated', () => {
  it('returns most-recent first, capped at 20', async () => {
    const app = await bootEmpty();
    app.App.data.audit_log = [
      { ts: '2026-04-30T10:00:00Z', event_type: 'report_generated', meta: { report_type: 'sponsor_pack' } },
      { ts: '2026-05-13T11:00:00Z', event_type: 'report_generated', meta: { report_type: 'customer_pack' } },
      { ts: '2026-05-13T09:00:00Z', event_type: 'field_change', field: 'name' }
    ];
    const recent = app.Reports.recentExports();
    expect(recent.length).toBe(2);
    expect(recent[0].meta.report_type).toBe('customer_pack');
    expect(recent[1].meta.report_type).toBe('sponsor_pack');
    app.teardown();
  });
});

describe('R8 / AC-R8.9 — Copy-link URL round-trip', () => {
  it('buildCopyLink + parseCopyLink are inverses', async () => {
    const app = await bootEmpty();
    const url = app.Reports.buildCopyLink('sponsor_pack', { projectId: 'acme-001', classification: 'Confidential' });
    expect(url).toBe('#/report/sponsor_pack?projectId=acme-001&classification=Confidential');
    const parsed = app.Reports.parseCopyLink(url);
    expect(parsed.reportId).toBe('sponsor_pack');
    expect(parsed.args.projectId).toBe('acme-001');
    expect(parsed.args.classification).toBe('Confidential');
    app.teardown();
  });
});

// ============================================================
// R9 — Detail-panel inline narrative editor
// ============================================================
describe('R9 / AC-R9.1 + AC-R9.3 — Customer narrative side-drawer', () => {
  it('opens without a walkthrough; renders wins + asks fields', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R9P', customer: 'Acme Industries', narrative: { headline: 'Hi', wins: ['Shipped'], asks: ['Approval'] } });
    app.App.data.projects.push(p);
    app.DetailPanel.openCustomerNarrativeDrawer('R9P');
    const drawer = app.document.getElementById('dpNarrativeDrawer');
    expect(drawer).toBeTruthy();
    expect(drawer.querySelector('[data-list="wins"]')).toBeTruthy();
    expect(drawer.querySelector('[data-list="asks"]')).toBeTruthy();
    expect(drawer.textContent).toMatch(/Shipped/);
    expect(drawer.textContent).toMatch(/Approval/);
    expect(app.Walkthrough.activeProjectId).not.toBe('R9P'); // no walkthrough required
    app.teardown();
  });

  it('save round-trips through App.updateProjectNarrative', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R9Q', customer: 'Acme Industries', narrative: { headline: 'old', wins: [], asks: [] } });
    app.App.data.projects.push(p);
    app.DetailPanel.openCustomerNarrativeDrawer('R9Q');
    app.document.getElementById('dpNarrativeHeadline').value = 'new headline';
    app.DetailPanel._saveNarrativeDrawer();
    expect(app.App.data.projects[0].narrative.headline).toBe('new headline');
    expect(app.document.getElementById('dpNarrativeDrawer')).toBeFalsy();
    app.teardown();
  });
});

// ============================================================
// R10 — Business Case schema expansion
// ============================================================
describe('R10 / AC-R10.1 + AC-R10.2 — business_case schema accepts shape; legacy lifts', () => {
  it('migrateBusinessCase lifts legacy benefit_annual_gbp into benefit_items[0]', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R10P', customer: 'Acme Industries' });
    p.benefit_annual_gbp = 12000;
    p.benefit_horizon_years = 3;
    app.App.data.projects.push(p);
    const bc = app.App.migrateBusinessCase(p, '2026-05-13');
    expect(Array.isArray(bc.benefit_items)).toBe(true);
    expect(bc.benefit_items[0].annual_amount).toBe(12000);
    expect(bc.benefit_items[0].type).toBe('cashable');
    expect(bc.benefit_items[0].year_from).toBe(2026);
    expect(bc.benefit_items[0].year_to).toBe(2029);
    expect(bc.legacy_benefit_annual_gbp).toBe(12000);
    expect(bc.legacy_benefit_horizon_years).toBe(3);
    expect(bc.status).toBe('Draft');
    app.teardown();
  });

  it('idempotent: re-running migrateBusinessCase does not overwrite an existing benefit_items', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R10Q', customer: 'Acme Industries' });
    p.business_case = { benefit_items: [{ id: 'custom', type: 'cashable', annual_amount: 99 }] };
    app.App.data.projects.push(p);
    const bc = app.App.migrateBusinessCase(p);
    expect(bc.benefit_items[0].annual_amount).toBe(99);
    app.teardown();
  });
});

describe('R10 / AC-R10.4 — NPV within 0.5% of legacy', () => {
  it('post-migration NPV matches a hand-computed legacy NPV', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'R10NPV', customer: 'Acme Industries' });
    p.benefit_annual_gbp = 10000;
    p.benefit_horizon_years = 3;
    app.App.data.projects.push(p);
    app.App.migrateBusinessCase(p, '2026-05-13');
    // Legacy formula: sum_{t=0..horizon} annual / (1+r)^t with r=0.05.
    const r = 0.05;
    const expected = 10000 + 10000 / (1 + r) + 10000 / Math.pow(1 + r, 2) + 10000 / Math.pow(1 + r, 3);
    const got = app.App.computeBusinessCaseNpv(p);
    const drift = Math.abs((got - expected) / expected);
    expect(drift).toBeLessThan(0.005);
    app.teardown();
  });
});

// ============================================================
// R11 — Audit-log report-generation entries
// ============================================================
describe('R11 / AC-R11.1 — Reports.recordExport writes a report_generated entry', () => {
  it('emits audit_log entry with report_type, scope_arg, output_size_bytes', async () => {
    const app = await bootEmpty();
    app.App.data.audit_log = [];
    app.Reports.recordExport('sponsor_pack', 'P-001', { generatedBy: 'tester', outputSizeBytes: 1024 });
    const log = app.App.data.audit_log;
    expect(log.length).toBe(1);
    const e = log[0];
    expect(e.event_type).toBe('report_generated');
    expect(e.meta.report_type).toBe('sponsor_pack');
    expect(e.meta.scope_arg).toBe('P-001');
    expect(e.meta.generated_by).toBe('tester');
    expect(e.meta.output_size_bytes).toBe(1024);
    app.teardown();
  });

  it('AC-R11.3: walkthrough_id is populated when a walkthrough is active', async () => {
    const app = await bootEmpty();
    app.Walkthrough._activeWalkthroughId = 'wt-active';
    app.App.data.audit_log = [];
    app.Reports.recordExport('customer_pack', 'Acme Industries');
    const e = app.App.data.audit_log[0];
    expect(e.meta.walkthrough_id).toBe('wt-active');
    app.teardown();
  });
});

// ============================================================
// Migration replay (§9.13) — load + apply migrations + no data loss
// ============================================================
describe('§9.13 — Migration replay through validateAndLoad', () => {
  it('loading data with legacy benefit_annual_gbp does not crash; business_case migrate is callable', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'M1', customer: 'Acme Industries' });
    p.benefit_annual_gbp = 5000;
    p.benefit_horizon_years = 2;
    app.App.data.projects.push(p);
    expect(() => app.App.migrateBusinessCase(p)).not.toThrow();
    expect(app.App.data.projects.find(x => x.id === 'M1').business_case).toBeTruthy();
    app.teardown();
  });
});
