import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePerson, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Person — detail modal body', () => {
  it('renders Identity / Inherited / Held metrics / RACI / Notes sections', async () => {
    resetIdSeq();
    const persona = makePersona({
      id: 'P1', name: 'CFO Persona',
      definition: 'Owns finance for the group.',
      goals: 'Drive margin.',
      pain_points: 'Slow close.',
      information_needs: 'Daily cash.',
      stakeholders: 'CEO',
      business_questions: ['Cash runway?'],
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 100, period_type: 'annual' }] }],
    });
    const sarah = makePerson({
      id: 'PRSN-1', name: 'Sarah Chen', email: 'sc@ex.com',
      role_title: 'CFO', department: 'Finance', region: 'North',
      persona_id: 'P1', notes: 'Prefers data over narrative.',
      communication_prefs: 'Slack mornings, email afternoons',
      target_overrides: [{ metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 220, period_type: 'annual' }] }],
    });
    const m = makeMetric({
      id: 'M1', name: 'Revenue', dimensions: ['region'],
      raci: { accountable: ['PRSN-1'], responsible: [], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Person.renderDetailBody('PRSN-1');

    [
      'Identity',
      'Communication preferences',  // Section restored on Person 2026-05.
      'Inherited from persona',
      'Held metrics',
      'RACI assignments',
      'Individual notes',           // Renamed from "Notes" to disambiguate from Persona.notes.
    ].forEach(label => expect(out).toContain(label));

    // Identity values
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('sc@ex.com');
    expect(out).toContain('CFO');
    expect(out).toContain('Finance');
    // Communication preferences — now editable on the Person, not inherited.
    expect(out).toMatch(/data-person-field="communication_prefs"/);
    expect(out).toContain('Slack mornings, email afternoons');
    // From-persona attribution
    expect(out).toContain('CFO Persona');
    expect(out).toContain('Owns finance for the group.');
    expect(out).toContain('Drive margin.');
    expect(out).toContain('Cash runway?');
    // Held metric with override badge
    expect(out).toContain('Revenue');
    expect(out).toContain('220');           // override target value
    expect(out.toLowerCase()).toContain('override');
    // RACI assignment — A letter in the RACI section + clickable metric chip.
    expect(out).toMatch(/raci-letter raci-A/);
    expect(out).toContain('Metrics._jumpToLibrary');

    await expect(out).toMatchFileSnapshot('./__snapshots__/person-detail-modal.html');
    app.teardown();
  });
});
