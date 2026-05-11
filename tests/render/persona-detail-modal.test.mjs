import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Personas — detail modal body', () => {
  it('renders every documented section heading and the existing field values', async () => {
    resetIdSeq();
    const sarah = makePersona({
      id: 'P1', name: 'Sarah Chen', role_title: 'CFO',
      definition: 'Owns finance for the group.',
      key_responsibilities: 'Quarterly close; FP&A; Treasury.',
      goals: 'Improve gross margin by 200bps.',
      pain_points: 'Reports take 3 days to refresh.',
      decisions: 'Capex prioritisation.',
      information_needs: 'Daily cash position.',
      tools: 'NetSuite; Tableau.',
      stakeholders: 'CEO; Audit committee.',
      communication_prefs: 'Email + weekly steering meeting.',
      business_questions: ['What is our cash runway?', 'Which products lose money?'],
      notes: 'Prefers data over narrative.',
    });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah],
      metrics: [makeMetric({ id: 'M1', name: 'Revenue', group_id: 'performance' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderDetailBody('P1');

    // Section headings (case-insensitive contains)
    [
      'Identity',
      'Responsibilities',
      'Goals',
      'pain points',
      'Information needs',
      'business questions',
      'Tools',
      'communication',
      'Held metrics',
      'Derived',
      'Notes',
    ].forEach(label => {
      expect(out.toLowerCase()).toContain(label.toLowerCase());
    });

    // Existing values are rendered into the form.
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('CFO');
    expect(out).toContain('Owns finance for the group.');
    expect(out).toContain('Improve gross margin by 200bps.');
    expect(out).toContain('Reports take 3 days to refresh.');
    expect(out).toContain('Capex prioritisation.');
    expect(out).toContain('Daily cash position.');
    expect(out).toContain('NetSuite');
    expect(out).toContain('Email + weekly steering meeting.');
    expect(out).toContain('What is our cash runway?');
    expect(out).toContain('Which products lose money?');
    expect(out).toContain('Prefers data over narrative.');
    expect(out).toContain('Revenue'); // held-metric

    await expect(out).toMatchFileSnapshot('./__snapshots__/persona-detail-modal.html');
    app.teardown();
  });
});
