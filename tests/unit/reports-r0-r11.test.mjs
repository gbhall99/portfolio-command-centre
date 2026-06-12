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
    ['sponsor_pack', 'business_case', 'sprint_brief', 'customer_pack', 'portfolio_pack', 'meeting_agenda', 'status_report', 'costs_report'].forEach(t => {
      // Own entry required — the sponsor_pack fallback in buildDoc must never
      // be what supplies a catalogued type's defaults.
      expect(Object.prototype.hasOwnProperty.call(app.Reports._DEFAULTS_BY_TYPE, t)).toBe(true);
      const doc = app.Reports.Doc.buildDoc({ reportType: t, sections: [] });
      expect(doc.density).toBeTruthy();
      expect(doc.classification).toBeTruthy();
    });
    app.teardown();
  });

  // Regression: buildDoc used `opts.coverPage || defaults.coverPage`, so an
  // explicit `coverPage: false` silently became the type default and the cover
  // could never be disabled.
  it('coverPage: false disables the cover (no || fallback to the type default)', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Doc.buildDoc({ reportType: 'customer_pack', title: 'X', coverPage: false, sections: [] });
    expect(doc.coverPage).toBe(false);
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).not.toContain('<div class="rp-cover'); // stylesheet rules remain; the cover element must not
    app.teardown();
  });

  // Regression: toHtml only truthiness-checked doc.coverPage, so the
  // 'header-band' and 'full' variants encoded in _DEFAULTS_BY_TYPE rendered
  // identical cover markup.
  it("coverPage 'header-band' renders a compact band distinct from 'full'", async () => {
    const app = await bootEmpty();
    const band = app.Reports.Doc.toHtml(
      app.Reports.Doc.buildDoc({ reportType: 'sponsor_pack', title: 'X', coverPage: 'header-band', sections: [] }), {});
    const full = app.Reports.Doc.toHtml(
      app.Reports.Doc.buildDoc({ reportType: 'sponsor_pack', title: 'X', coverPage: 'full', sections: [] }), {});
    expect(band).toContain('<div class="rp-cover rp-cover--band">');
    expect(full).not.toContain('<div class="rp-cover rp-cover--band">');
    expect(full).toContain('<div class="rp-cover">');
    app.teardown();
  });

  // Regression: density was stored on the doc but never read, so compact /
  // standard / full all produced byte-identical HTML.
  it('density varies the rendered document (compact vs standard vs full)', async () => {
    const app = await bootEmpty();
    const sections = [{ id: 's1', title: 'One', html: '<p>x</p>' }];
    const render = density => app.Reports.Doc.toHtml(
      app.Reports.Doc.buildDoc({ reportType: 'portfolio_pack', title: 'X', density, sections }), {});
    const compact = render('compact');
    const standard = render('standard');
    const full = render('full');
    expect(compact).toContain('<div class="rp-page rp-density-compact">');
    expect(standard).toContain('<div class="rp-page rp-density-standard">');
    expect(full).toContain('<div class="rp-page rp-density-full">');
    expect(compact).not.toBe(full);
    // The density classes are backed by real stylesheet rules, not dead classes.
    expect(compact).toContain('.rp-density-compact');
    expect(full).toContain('.rp-density-full');
    app.teardown();
  });

  it('unknown density falls back to the type default; unknown coverPage strings normalise to full', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Doc.buildDoc({ reportType: 'sponsor_pack', title: 'X', density: 'bogus"<x>', coverPage: 'bogus', sections: [] });
    expect(doc.density).toBe('compact'); // sponsor_pack default — never an unvetted class token
    expect(doc.coverPage).toBe('full');
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

describe('R1 hardening — Doc.toHtml branding parity (logo + companyName)', () => {
  // Regression: the legacy serializer (Report.buildDoc/_coverPage/_logoHtml)
  // rendered brand.logo and brand.companyName on every export's cover and
  // footer. Reports.configureBranding still prompts for and persists both,
  // so the unified engine must render them or the settings are dead config.
  function buildCoverDoc(app) {
    return app.Reports.Doc.buildDoc({
      reportType: 'sponsor_pack',
      title: 'Quarterly Pack',
      customer: 'Acme Industries',
      coverPage: 'full',
      sections: [{ id: 's1', title: 'Summary', html: '<p>ok</p>' }]
    });
  }

  it('renders the configured logo on the cover and companyName on cover + footer', async () => {
    const app = await bootEmpty();
    const brand = {
      logo: 'data:image/png;base64,iVBORw0KGgo=',
      companyName: 'Acme Consulting Ltd',
      primaryColor: '#0000ff',
      footerNote: 'Confidential'
    };
    const html = app.Reports.Doc.toHtml(buildCoverDoc(app), brand);
    const dom = app.window.document.createElement('div');
    dom.innerHTML = html;
    const coverImg = dom.querySelector('.rp-cover img');
    expect(coverImg).toBeTruthy();
    expect(coverImg.getAttribute('src')).toBe(brand.logo);
    const cover = dom.querySelector('.rp-cover');
    expect(cover.textContent).toContain('Acme Consulting Ltd');
    const footer = dom.querySelector('.rp-footer');
    expect(footer.textContent).toContain('Acme Consulting Ltd');
    app.teardown();
  });

  it('a double quote in the logo URL cannot break out of the src attribute', async () => {
    const app = await bootEmpty();
    const brand = { logo: 'x.png" onerror="alert(document.domain)', companyName: 'Acme' };
    const html = app.Reports.Doc.toHtml(buildCoverDoc(app), brand);
    const dom = app.window.document.createElement('div');
    dom.innerHTML = html;
    expect(dom.querySelector('[onerror]')).toBeNull();
    const coverImg = dom.querySelector('.rp-cover img');
    expect(coverImg).toBeTruthy();
    expect(coverImg.getAttribute('src')).toBe(brand.logo);
    app.teardown();
  });

  it('omits the logo img and brand line when branding is unconfigured', async () => {
    const app = await bootEmpty();
    const html = app.Reports.Doc.toHtml(buildCoverDoc(app), {});
    const dom = app.window.document.createElement('div');
    dom.innerHTML = html;
    expect(dom.querySelector('.rp-cover img')).toBeNull();
    expect(dom.querySelector('.rp-cover-brand')).toBeNull();
    app.teardown();
  });
});

describe('R1 hardening — Doc.toHtml escapes section ids in attribute context', () => {
  // Section ids derive from untrusted free-text names (customer / team member)
  // with only whitespace stripped. A name containing a double quote (no spaces)
  // survives the \s+ replace; Dashboard.esc does NOT escape quotes, so a
  // double-quoted id attribute could be closed and a live event handler
  // injected into the report HTML written to the new window (stored XSS).
  it('a double quote in a section id cannot break out of the id attribute', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Doc.buildDoc({
      reportType: 'sprint_brief',
      title: 'Brief',
      sections: [{
        id: 'sb-Bob"onmouseover="alert(document.domain)',
        title: 'Bob',
        html: '<p>load</p>'
      }]
    });
    const html = app.Reports.Doc.toHtml(doc, {});
    const dom = app.window.document.createElement('div');
    dom.innerHTML = html;
    const section = dom.querySelector('.rp-section:not(.rp-toc)');
    expect(section).toBeTruthy();
    // The quote must not terminate the attribute early: the whole payload
    // stays inside the id as inert data...
    expect(section.id).toBe('rp-sb-Bob"onmouseover="alert(document.domain)');
    // ...and no injected event-handler attribute may exist anywhere.
    expect(dom.querySelector('[onmouseover]')).toBeNull();
    app.teardown();
  });
});

describe('R1 hardening — Doc.toHtml tolerates null/undefined section entries', () => {
  // buildDoc accepts any caller-supplied array unvalidated, and Doc.toHtml is
  // the single serialization path for all 8 document types including
  // skill-fed content. _filterSections dereferenced s.audiences on every
  // entry, so a holey/garbage sections array (one null or undefined element)
  // threw TypeError and the whole document failed to serialize.
  it('null and undefined section entries are skipped, valid ones still render', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Doc.buildDoc({
      reportType: 'sponsor_pack',
      title: 'Resilient',
      sections: [null, { id: 'a', title: 'Alpha', html: '<p>x</p>' }, undefined]
    });
    let html;
    expect(() => { html = app.Reports.Doc.toHtml(doc, {}); }).not.toThrow();
    expect(html).toContain('Alpha');
    expect(html).toContain('<p>x</p>');
    app.teardown();
  });

  it('_filterSections drops nullish entries for every audience', async () => {
    const app = await bootEmpty();
    const sections = [null, undefined, { id: 'a', title: 'A' }, { id: 'b', title: 'B', audiences: ['customer'] }];
    expect(app.Reports.Doc._filterSections(sections, 'internal').map(s => s.id)).toEqual(['a']);
    expect(app.Reports.Doc._filterSections(sections, 'customer').map(s => s.id)).toEqual(['a', 'b']);
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

  // Regression: the unified engine dropped legacy Report.branding's
  // customer-accent tier (primaryColor || App.getCustomerColor(customer) ||
  // '#3b82f6'), so every unbranded customer rendered generic blue while the
  // Settings swatch still showed the customer's app colour.
  it('unbranded customer tints with their app accent colour, not hardcoded blue', async () => {
    const app = await loadApp(makeDataset({
      projects: [],
      customers: [{ name: 'Acme Industries', color: '#a855f7' }]
    }));
    const acme = app.Reports.Brand.for('Acme Industries');
    expect(acme.primaryColor).toBe('#a855f7');
    app.teardown();
  });

  it('explicit primaryColor (customer or portfolio default) beats the accent tier', async () => {
    const app = await loadApp(makeDataset({
      projects: [],
      customers: [{ name: 'Acme Industries', color: '#a855f7' }]
    }));
    app.App.data.settings.branding = { portfolio_default: { primaryColor: '#000000' } };
    expect(app.Reports.Brand.for('Acme Industries').primaryColor).toBe('#000000');
    app.App.data.settings.branding = { 'Acme Industries': { primaryColor: '#0000ff' } };
    expect(app.Reports.Brand.for('Acme Industries').primaryColor).toBe('#0000ff');
    app.teardown();
  });

  it('Settings branding swatch shows the same colour Brand.for resolves', async () => {
    const app = await loadApp(makeDataset({
      projects: [],
      customers: [{ name: 'Acme Industries', color: '#a855f7' }]
    }));
    const card = app.App._renderBrandingCard();
    expect(card).toContain('background:' + app.Reports.Brand.for('Acme Industries').primaryColor);
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

describe('R1 hardening — branding writes honour the entity-mutators contract (pushUndo before mutation)', () => {
  // Regression: Brand.set mutated App.data.settings.branding (and setCustomerLogo
  // mutated the customer entity) without App.pushUndo, making branding/logo changes
  // the only audited mutations that could not be undone.
  it('Brand.set pushes one undo snapshot capturing pre-change branding', async () => {
    const app = await bootEmpty();
    app.App.data.settings.branding = { 'Acme Industries': { primaryColor: '#111111' } };
    const depth = app.App.undoStack.length;
    app.Reports.Brand.set('Acme Industries', { primaryColor: '#facc15' });
    expect(app.App.undoStack.length).toBe(depth + 1);
    expect(app.App.data.settings.branding['Acme Industries'].primaryColor).toBe('#facc15');
    app.App.undo();
    expect(app.App.data.settings.branding['Acme Industries'].primaryColor).toBe('#111111');
    app.teardown();
  });

  it('setCustomerLogo is one undo step restoring BOTH the customer entity and settings.branding', async () => {
    const app = await bootEmpty();
    const depth = app.App.undoStack.length;
    app.App.setCustomerLogo('Acme Industries', 'data:image/png;base64,NEW');
    const c = app.App.data.customers.find(x => x.name === 'Acme Industries');
    expect(c.logo).toBe('data:image/png;base64,NEW');
    expect(app.App.data.settings.branding['Acme Industries'].logo).toBe('data:image/png;base64,NEW');
    // Exactly one snapshot — undoing must not leave a half-reverted state.
    expect(app.App.undoStack.length).toBe(depth + 1);
    app.App.undo();
    const reverted = app.App.data.customers.find(x => x.name === 'Acme Industries');
    expect(reverted.logo || '').toBe('');
    const branding = (app.App.data.settings.branding || {})['Acme Industries'] || {};
    expect(branding.logo || '').toBe('');
    app.teardown();
  });

  it('configureBranding via prompts is undoable in one step', async () => {
    const app = await bootEmpty();
    const answers = ['logo.png', '#123456', 'Acme Consulting Ltd', 'Strictly Confidential'];
    app.window.prompt = () => answers.shift();
    const depth = app.App.undoStack.length;
    app.Reports.configureBranding('Acme Industries');
    expect(app.App.data.settings.branding['Acme Industries'].primaryColor).toBe('#123456');
    expect(app.App.undoStack.length).toBe(depth + 1);
    app.App.undo();
    const branding = (app.App.data.settings.branding || {})['Acme Industries'] || {};
    expect(branding.primaryColor).toBeUndefined();
    app.teardown();
  });
});

describe('R1 hardening — legacy footerText migrates to footerNote (one persisted truth)', () => {
  // Regression: the legacy serializer rendered settings.branding[*].footerText on the
  // cover and every page footer; the unified engine reads ONLY brand.footerNote. Without
  // a migration, every existing session's configured footer/classification text silently
  // disappeared from all generated PDFs.
  it('migrateSchema lifts footerText onto footerNote, drops the legacy key, and the value reaches the rendered footer', async () => {
    const app = await bootEmpty();
    app.App.data.settings.branding = {
      portfolio_default: { footerText: 'Portfolio footer' },
      'Acme Industries': { companyName: 'Acme Consulting Ltd', footerText: 'Confidential — Internal Use Only' }
    };
    app.App.migrateSchema(app.App.data);
    const acme = app.App.data.settings.branding['Acme Industries'];
    expect(acme.footerNote).toBe('Confidential — Internal Use Only');
    expect('footerText' in acme).toBe(false);
    expect(app.App.data.settings.branding.portfolio_default.footerNote).toBe('Portfolio footer');
    // Brand.for resolves it and Doc.toHtml renders it on the footer.
    const brand = app.Reports.Brand.for('Acme Industries');
    expect(brand.footerNote).toBe('Confidential — Internal Use Only');
    const html = app.Reports.Doc.toHtml(app.Reports.Doc.buildDoc({
      reportType: 'sponsor_pack', title: 'Pack', customer: 'Acme Industries',
      sections: [{ id: 's1', title: 'Summary', html: '<p>ok</p>' }]
    }), brand);
    const dom = app.window.document.createElement('div');
    dom.innerHTML = html;
    expect(dom.querySelector('.rp-footer').textContent).toContain('Confidential — Internal Use Only');
    // The Settings white-labelling card shows the migrated footer, not '—'.
    expect(app.App._renderBrandingCard()).toContain('Confidential — Internal Use Only');
    app.teardown();
  });

  it('is idempotent and never clobbers an existing footerNote', async () => {
    const app = await bootEmpty();
    app.App.data.settings.branding = {
      'Acme Industries': { footerNote: 'New note', footerText: 'Old text' }
    };
    app.App.migrateSchema(app.App.data);
    app.App.migrateSchema(app.App.data);
    const b = app.App.data.settings.branding['Acme Industries'];
    expect(b.footerNote).toBe('New note');
    expect('footerText' in b).toBe(false);
    app.teardown();
  });

  it('configureBranding persists footerNote only — no dual-written footerText copy', async () => {
    const app = await bootEmpty();
    const answers = ['', '#123456', 'Acme Consulting Ltd', 'Strictly Confidential'];
    app.window.prompt = () => answers.shift();
    app.Reports.configureBranding('Acme Industries');
    const b = app.App.data.settings.branding['Acme Industries'];
    expect(b.footerNote).toBe('Strictly Confidential');
    expect('footerText' in b).toBe(false);
    app.teardown();
  });
});

describe('R1 / AC-R1.5 — Reports.Catalogue lists all reports (7 core + costs_report)', () => {
  it('catalogue has 8 entries with required metadata keys', async () => {
    const app = await bootEmpty();
    expect(app.Reports.Catalogue.length).toBe(8);
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
    expect(ids).toEqual(['business_case', 'costs_report', 'customer_pack', 'forum_agenda'.replace('forum_agenda', 'meeting_agenda'), 'portfolio_pack', 'sponsor_pack', 'sprint_brief', 'status_report'].sort());
    app.teardown();
  });
});

// Regression: costsReport built with reportType:'portfolio_pack' and no
// costs_report entry existed in _DEFAULTS_BY_TYPE — the internal-only
// margin/cost doc self-identified as a shareable pack, diverged from its
// 'costs_report' audit id, and silently inherited portfolio_pack defaults
// (tocPage:true, includeAppendix:true — the appendix channel is not
// audience-filtered).
describe('R1 hardening — costs report is typed costs_report with its own defaults', () => {
  it('costsReport stamps reportType costs_report, matching its Catalogue + audit id', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Builders.costsReport('Acme Industries');
    expect(doc.reportType).toBe('costs_report');
    expect(app.Reports.Catalogue.some(c => c.id === doc.reportType)).toBe(true);
    expect(doc.classification).toBe('Internal');
    expect(doc.audience).toBe('internal');
    app.teardown();
  });

  it('costs_report defaults never open the unfiltered appendix channel', async () => {
    const app = await bootEmpty();
    const defaults = app.Reports._DEFAULTS_BY_TYPE.costs_report;
    expect(defaults).toBeTruthy();
    expect(defaults.includeAppendix).toBe(false);
    expect(defaults.tocPage).toBe(false);
    expect(defaults.classification).toBe('Internal');
    // And the built doc actually carries them (not portfolio_pack's true/true).
    const doc = app.Reports.Builders.costsReport('Acme Industries');
    expect(doc.includeAppendix).toBe(false);
    expect(doc.tocPage).toBe(false);
    app.teardown();
  });
});

// ============================================================
// R2 + R3 — Customer Pack + Status Report through Reports.Doc
// ============================================================
describe('R2 / AC-R2.1 — Customer Pack contains all 6 blocks in order', () => {
  it('builders.customerPack returns health + lifecycle + Wins + Asks + Risks + Next', async () => {
    const app = await bootEmpty();
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    const titles = doc.sections.map(s => s.title);
    expect(titles).toEqual(['Portfolio health', 'Lifecycle headlines', 'Wins', 'We need from you', 'Customer-visible risks', "What's next"]);
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

// WS-E hardening — the catalogue declares status_report scope:'customer'
// (requiresScopeArg:'customer', audiences customer+internal), so the builder
// MUST honour the customer arg the hub passes. Before the fix the arg was
// silently dropped and the hub generated a cross-customer document containing
// every other customer's project names/statuses/managers/RAG, bypassing the
// legacy toolbar's explicit "covers all customers" confirm guard.
describe('R3 hardening — Builders.statusReport(customer) is customer-scoped', () => {
  async function bootTwoCustomers() {
    return await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1' },
        { name: 'Globex', color: '#0ea5e9' }
      ],
      projects: [
        makeProject({ id: 'A1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'At Risk', manager: 'Alice' }),
        makeProject({ id: 'G1', name: 'Globex Secret', customer: 'Globex', status: 'Blocked', manager: 'Bob' })
      ]
    }));
  }

  it('never embeds another customer\'s projects (the Documents-hub leak)', async () => {
    const app = await bootTwoCustomers();
    const doc = app.Reports.Builders.statusReport('Acme Industries');
    expect(doc.customer).toBe('Acme Industries');
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toContain('Acme Alpha');
    expect(html).not.toContain('Globex Secret');
    expect(html).not.toContain('Bob');
    app.teardown();
  });

  it('customer audience renders a non-empty body for the scoped report', async () => {
    const app = await bootTwoCustomers();
    const doc = app.Reports.Builders.statusReport('Acme Industries');
    const visible = app.Reports.Doc._filterSections(doc.sections, 'customer');
    expect(visible.length).toBeGreaterThan(0);
    app.teardown();
  });

  it('prefers the latest drafted status_report entity for the customer (skill-fed)', async () => {
    const app = await bootTwoCustomers();
    app.App.data.status_reports.push(
      { id: 'sr-old', customer: 'Acme Industries', period: 'May 2026', created_at: '2026-05-01T00:00:00Z', sections: [{ id: 'exec', title: 'Executive summary', content: 'Old draft.' }] },
      { id: 'sr-new', customer: 'Acme Industries', period: 'June 2026', created_at: '2026-06-01T00:00:00Z', sections: [{ id: 'exec', title: 'Executive summary', content: 'All on track.' }] },
      { id: 'sr-other', customer: 'Globex', period: 'June 2026', created_at: '2026-06-05T00:00:00Z', sections: [{ id: 'exec', title: 'Executive summary', content: 'Globex Secret narrative.' }] }
    );
    const doc = app.Reports.Builders.statusReport('Acme Industries');
    expect(doc.subtitle).toBe('June 2026');
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toContain('All on track.');
    expect(html).not.toContain('Old draft.');
    expect(html).not.toContain('Globex Secret');
    app.teardown();
  });

  it('without a customer the legacy guarded toolbar path stays cross-customer and internal-only', async () => {
    const app = await bootTwoCustomers();
    const doc = app.Reports.Builders.statusReport();
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toContain('Acme Alpha');
    expect(html).toContain('Globex Secret');
    // Strictly internal: nothing may render for the customer audience.
    expect(app.Reports.Doc._filterSections(doc.sections, 'customer').length).toBe(0);
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
// R7 — Walkthrough Minutes (WS-E Task 13: the legacy Report engine is deleted,
// so minutes now render through the unified engine's builder — the single
// document path replaces the old "no duplicate builder" guarantee).
// ============================================================
describe('R7 / AC-R7.4 — Walkthrough Minutes renders through the unified engine', () => {
  it('Reports.Builders.walkthroughMinutes is the engine builder (no legacy duplicate)', async () => {
    const app = await bootEmpty();
    expect(typeof app.Reports.Builders.walkthroughMinutes).toBe('function');
    // Unknown walkthroughs build nothing (generate() will toast, not throw).
    expect(app.Reports._build('walkthrough_minutes', { walkthroughId: 'nope' })).toBeNull();
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
// R11 hardening — pop-up blocked means no export happened, so the
// skill/document surfaces must not write a report_generated entry.
// (Reports.open returns null when window.open is blocked; the gated
// pattern in Reports.generate must hold on every rewired surface.)
// ============================================================
describe('R11 hardening — blocked pop-up writes no report_generated audit entry', () => {
  const noReportEntries = (app) =>
    (app.App.data.audit_log || []).filter(e => e.event_type === 'report_generated');

  it('Billing.exportReport: blocked open is not audited; successful open is', async () => {
    const app = await bootEmpty();
    app.App.activeCustomer = 'Acme Industries';
    app.App.data.audit_log = [];
    app.Reports.open = () => null; // pop-up blocked
    app.Billing.exportReport('Acme Industries');
    expect(noReportEntries(app)).toEqual([]);
    app.Reports.open = () => ({}); // pop-up allowed
    app.Billing.exportReport('Acme Industries');
    expect(noReportEntries(app).map(e => e.meta.report_type)).toEqual(['costs_report']);
    app.teardown();
  });

  it('SowSkill.exportPrint: blocked open is not audited', async () => {
    const app = await bootEmpty();
    app.App.activeCustomer = 'Acme Industries';
    const sow = app.Sow.create({
      customer: 'Acme Industries',
      definition: { id: 'mini-sow', name: 'Mini SOW', sections: [{ id: 'exec', title: 'Executive summary', order: 1, required: true }] },
      generatedSections: [{ id: 'exec', content: 'Deliver the churn dashboard.' }],
      name: 'Statement of Work — Blocked Popup'
    });
    app.SowSkill._sowId = sow.id;
    app.App.data.audit_log = [];
    app.Reports.open = () => null;
    app.SowSkill.exportPrint();
    expect(noReportEntries(app)).toEqual([]);
    app.teardown();
  });

  it('StatusReportSkill.exportPrint: blocked open is not audited', async () => {
    const app = await bootEmpty();
    app.App.activeCustomer = 'Acme Industries';
    const r = app.StatusReport.create({
      customer: 'Acme Industries',
      period: 'June 2026',
      definition: { sections: [{ id: 'exec', title: 'Executive summary', order: 1, required: true }] },
      generatedSections: [{ id: 'exec', content: 'On track.' }]
    });
    app.StatusReportSkill._id = r.id;
    app.App.data.audit_log = [];
    app.Reports.open = () => null;
    app.StatusReportSkill.exportPrint();
    expect(noReportEntries(app)).toEqual([]);
    app.teardown();
  });
});

// ============================================================
// R11 hardening — missing-entity handling in Reports.generate.
// Legacy exportProjectPack/exportBusinessCase toasted 'Project not found',
// exportForumAgenda 'Meeting not found', exportWalkthroughMinutes
// 'Walkthrough not found' — and never opened a window or audited. After the
// move to Reports.generate, sponsorPack/businessCase/forumAgenda returned an
// empty-section doc for a stale id (silent blank PDF + bogus report_generated
// audit entry) and walkthroughMinutes hit the misleading
// 'Unknown report: walkthrough_minutes' toast.
// ============================================================
describe('R11 hardening — generate() with a stale entity id: legacy toast, no export, no audit', () => {
  function instrument(app) {
    const calls = { opened: 0, toasts: [] };
    app.Reports.open = () => { calls.opened++; return {}; };
    app.App.toast = (msg, kind) => { calls.toasts.push({ msg, kind }); };
    app.App.data.audit_log = [];
    return calls;
  }
  const reportEntries = (app) =>
    (app.App.data.audit_log || []).filter(e => e.event_type === 'report_generated');

  const cases = [
    ['sponsor_pack', { projectId: 'nope' }, 'Project not found'],
    ['project_report', { projectId: 'nope' }, 'Project not found'],
    ['business_case', { projectId: 'nope' }, 'Project not found'],
    ['meeting_agenda', { forumId: 'nope' }, 'Meeting not found'],
    ['walkthrough_minutes', { walkthroughId: 'nope' }, 'Walkthrough not found']
  ];

  for (const [reportId, args, expected] of cases) {
    it(reportId + ': toasts "' + expected + '", opens nothing, audits nothing', async () => {
      const app = await bootEmpty();
      const calls = instrument(app);
      app.Reports.generate(reportId, args);
      expect(calls.toasts.map(t => t.msg)).toEqual([expected]);
      expect(calls.toasts[0].kind).toBe('error');
      expect(calls.opened).toBe(0);
      expect(reportEntries(app)).toEqual([]);
      app.teardown();
    });
  }

  it('builders return null (not an empty-section doc) for missing entities', async () => {
    const app = await bootEmpty();
    expect(app.Reports.Builders.sponsorPack('nope')).toBeNull();
    expect(app.Reports.Builders.businessCase('nope')).toBeNull();
    expect(app.Reports.Builders.forumAgenda('nope')).toBeNull();
    expect(app.Reports.Builders.walkthroughMinutes('nope')).toBeNull();
    app.teardown();
  });

  it('a genuinely unknown report id still toasts "Unknown report"', async () => {
    const app = await bootEmpty();
    const calls = instrument(app);
    app.Reports.generate('bogus_report', {});
    expect(calls.toasts.map(t => t.msg)).toEqual(['Unknown report: bogus_report']);
    expect(calls.opened).toBe(0);
    expect(reportEntries(app)).toEqual([]);
    app.teardown();
  });

  it('a valid entity still exports and audits (control)', async () => {
    const app = await bootEmpty();
    const p = makeProject({ id: 'OKP', name: 'OK Project', customer: 'Acme Industries' });
    app.App.data.projects.push(p);
    const calls = instrument(app);
    app.Reports.generate('sponsor_pack', { projectId: 'OKP', audience: 'internal' });
    expect(calls.toasts).toEqual([]);
    expect(calls.opened).toBe(1);
    expect(reportEntries(app).map(e => e.meta.report_type)).toEqual(['sponsor_pack']);
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
