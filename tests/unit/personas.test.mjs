import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Personas module', () => {
  it('list() returns personas filtered by active customer', async () => {
    resetIdSeq();
    const acme = [makePersona({ customer: 'Acme Industries', name: 'Sarah' })];
    const globex = [makePersona({ customer: 'Globex', name: 'Other' })];
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      personas: [...acme, ...globex],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const list = app.Personas.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Sarah');
    app.teardown();
  });

  it('descendants() walks parent_persona_id transitively', async () => {
    resetIdSeq();
    const ceo  = makePersona({ id: 'P1', name: 'CEO', parent_persona_id: null });
    const cfo  = makePersona({ id: 'P2', name: 'CFO', parent_persona_id: 'P1' });
    const finM = makePersona({ id: 'P3', name: 'Fin Mgr', parent_persona_id: 'P2' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [ceo, cfo, finM],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const desc = app.Personas.descendants('P1');
    expect(desc.map(p => p.id).sort()).toEqual(['P2', 'P3']);
    app.teardown();
  });

  it('cycleCheck() rejects self-parent and indirect cycles', async () => {
    resetIdSeq();
    const a = makePersona({ id: 'P1', parent_persona_id: null });
    const b = makePersona({ id: 'P2', parent_persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [a, b],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Personas.cycleCheck('P1', 'P1')).toBe(false);   // self-parent rejected
    expect(app.Personas.cycleCheck('P1', 'P2')).toBe(false);   // would create cycle (P1→P2→P1)
    expect(app.Personas.cycleCheck('P2', 'P1')).toBe(true);    // valid (P2's parent stays P1)
    app.teardown();
  });
});

describe('Personas hierarchy collapse', () => {
  // Helper: extract just the rendered persona row IDs (ignoring the toolbar
  // which always lists every persona in its filter <select>s).
  const extractRowIds = (html) => {
    const ids = [];
    const re = /<div class="strategy-row"[^>]*data-persona-id="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) ids.push(m[1]);
    return ids;
  };

  it('descendants of a collapsed ancestor are hidden in renderInventoryTab', async () => {
    resetIdSeq();
    const ceo = makePersona({ id: 'P1', name: 'CEO', parent_persona_id: null });
    const cfo = makePersona({ id: 'P2', name: 'CFO', parent_persona_id: 'P1' });
    const finM = makePersona({ id: 'P3', name: 'Fin Mgr', parent_persona_id: 'P2' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [ceo, cfo, finM],
    }));
    app.App.activeCustomer = 'Acme Industries';
    // Default: all expanded
    let html = app.Personas.renderInventoryTab();
    expect(extractRowIds(html)).toEqual(['P1', 'P2', 'P3']);
    // Collapse the CEO
    app.Personas._toggleCollapsed('P1');
    html = app.Personas.renderInventoryTab();
    expect(extractRowIds(html)).toEqual(['P1']);
    // Re-expand
    app.Personas._toggleCollapsed('P1');
    html = app.Personas.renderInventoryTab();
    expect(extractRowIds(html)).toEqual(['P1', 'P2', 'P3']);
    app.teardown();
  });

  it('_setAllCollapsed(true) hides every descendant of every parent', async () => {
    resetIdSeq();
    const ceo = makePersona({ id: 'P1', name: 'CEO' });
    const cfo = makePersona({ id: 'P2', name: 'CFO', parent_persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [ceo, cfo],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas._setAllCollapsed(true);
    expect(extractRowIds(app.Personas.renderInventoryTab())).toEqual(['P1']);
    app.Personas._setAllCollapsed(false);
    expect(extractRowIds(app.Personas.renderInventoryTab())).toEqual(['P1', 'P2']);
    app.teardown();
  });

  it('a search filter forces a flat render (collapse ignored)', async () => {
    resetIdSeq();
    const ceo = makePersona({ id: 'P1', name: 'CEO' });
    const cfo = makePersona({ id: 'P2', name: 'CFO', parent_persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [ceo, cfo],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas._toggleCollapsed('P1');  // collapsed
    // Sanity: without a filter, CFO is hidden by the collapse.
    expect(extractRowIds(app.Personas.renderInventoryTab())).toEqual(['P1']);
    // Apply a search filter — collapse is ignored, CEO doesn't match.
    app.App.uiStateSet('strategy.personas.filters', { search: 'CFO' });
    expect(extractRowIds(app.Personas.renderInventoryTab())).toEqual(['P2']);
    app.teardown();
  });

  it('persists the collapsed set to App.uiState', async () => {
    resetIdSeq();
    const ceo = makePersona({ id: 'P1', name: 'CEO' });
    const cfo = makePersona({ id: 'P2', name: 'CFO', parent_persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [ceo, cfo],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.App.uiStateGet('strategy.personas.collapsed')).toBeNull();
    app.Personas._toggleCollapsed('P1');
    expect(app.App.uiStateGet('strategy.personas.collapsed')).toEqual(['P1']);
    expect(app.Personas._isCollapsed('P1')).toBe(true);
    expect(app.Personas._isCollapsed('P2')).toBe(false);
    app.Personas._toggleCollapsed('P1');
    expect(app.App.uiStateGet('strategy.personas.collapsed')).toBeNull();
    app.teardown();
  });
});

describe('Personas rich definition fields', () => {
  const NEW_FIELDS_STR = ['goals', 'pain_points', 'decisions', 'information_needs', 'tools', 'stakeholders', 'communication_prefs'];

  it('migration seeds the new string fields and business_questions array on legacy personas', async () => {
    // Build a dataset with a persona that has none of the new fields.
    const legacy = {
      id: 'P-LEGACY', customer: 'Acme Industries', name: 'Old', role_title: '',
      definition: '', key_responsibilities: '', parent_persona_id: null,
      metric_holdings: [], notes: '',
      // Deliberately omit business_questions and all new fields.
    };
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [legacy],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const p = app.Personas.byId('P-LEGACY');
    NEW_FIELDS_STR.forEach(k => {
      expect(p[k]).toBe('');
    });
    expect(Array.isArray(p.business_questions)).toBe(true);
    expect(p.business_questions).toHaveLength(0);
    app.teardown();
  });

  it('migration is idempotent: re-running does not clobber populated fields', async () => {
    const populated = {
      id: 'P-POP', customer: 'Acme Industries', name: 'Pop',
      goals: 'Drive revenue', pain_points: 'Stale data', decisions: 'Pricing',
      information_needs: 'Daily ARR', tools: 'Salesforce', stakeholders: 'CEO',
      communication_prefs: 'Slack', business_questions: ['Q1?', 'Q2?'],
      metric_holdings: [], notes: '',
    };
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [populated],
    }));
    // Re-run migration; it should be a no-op for populated fields.
    app.App.migrateSchema(app.App.data);
    app.App.activeCustomer = 'Acme Industries';
    const p = app.Personas.byId('P-POP');
    expect(p.goals).toBe('Drive revenue');
    expect(p.business_questions).toEqual(['Q1?', 'Q2?']);
    app.teardown();
  });

  it('Personas.update persists a new string field across a fetch round-trip', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'CFO' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas.update('P1', { goals: 'Drive cost reduction' });
    expect(app.Personas.byId('P1').goals).toBe('Drive cost reduction');
    app.teardown();
  });

  it('Personas.update persists a business_questions array', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'CFO' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas.update('P1', { business_questions: ['Q1?', 'Q2?'] });
    expect(app.Personas.byId('P1').business_questions).toEqual(['Q1?', 'Q2?']);
    app.teardown();
  });
});
