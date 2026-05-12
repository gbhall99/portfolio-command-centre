import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Personas — detail modal body', () => {
  // After the 2026-05 Person rework: tools, decisions, the held-metrics
  // display section, and communication_prefs have moved off the persona modal.
  // Holdings still live on the persona; viewing per-Person targets is now via
  // Person modals reached from the Assigned-people list.
  it('renders every documented section heading and the existing field values', async () => {
    resetIdSeq();
    const sarah = makePersona({
      id: 'P1', name: 'Sarah Chen', role_title: 'CFO',
      definition: 'Owns finance for the group.',
      key_responsibilities: 'Quarterly close; FP&A; Treasury.',
      goals: 'Improve gross margin by 200bps.',
      pain_points: 'Reports take 3 days to refresh.',
      information_needs: 'Daily cash position.',
      stakeholders: 'CEO; Audit committee.',
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

    // Section headings present (case-insensitive contains).
    [
      'Identity',
      'Responsibilities',
      'Goals',
      'pain points',
      'Information needs',
      'business questions',
      'Assigned people',
      'RACI defaults',
      'Notes',
    ].forEach(label => {
      expect(out.toLowerCase()).toContain(label.toLowerCase());
    });

    // Sections explicitly removed in the rework — must NOT appear.
    expect(out.toLowerCase()).not.toContain('decisions owned');
    expect(out.toLowerCase()).not.toContain('held metrics');
    // communication_prefs moved to Person; the persona modal no longer surfaces it.
    expect(out).not.toMatch(/data-persona-field="communication_prefs"/);
    // Tools field was removed; "Tools & communication" heading should be gone.
    expect(out).not.toMatch(/data-persona-field="tools"/);
    expect(out).not.toMatch(/data-persona-field="decisions"/);

    // Existing values are rendered into the form.
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('CFO');
    expect(out).toContain('Owns finance for the group.');
    expect(out).toContain('Improve gross margin by 200bps.');
    expect(out).toContain('Reports take 3 days to refresh.');
    expect(out).toContain('Daily cash position.');
    expect(out).toContain('What is our cash runway?');
    expect(out).toContain('Which products lose money?');
    expect(out).toContain('Prefers data over narrative.');

    await expect(out).toMatchFileSnapshot('./__snapshots__/persona-detail-modal.html');
    app.teardown();
  });
});
