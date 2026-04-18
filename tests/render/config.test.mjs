// Config view renders — lock down the Scheduling Engine card (optimisation summary, R1–R11 table,
// R8 grid, R11 knobs) and the Scoring card (expanded tooltips, worked-example preview).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('App.renderConfig output', () => {
  it('Scheduling Engine card exposes optimisation summary + new R8/R11 controls', async () => {
    const app = await loadApp();
    app.App.activeCustomer = 'GCC';
    app.App.renderConfig();
    const card = app.document.getElementById('schedulingEngineCard');
    expect(card).not.toBeNull();
    const html = card.outerHTML;
    expect(html).toContain('What the solver optimises for');
    // C3: rule header renamed from internal code to plain-English reference.
    expect(html).toContain('Solver rules');
    expect(html).toContain('plain-English reference');
    // Issue 7+14: section headings rewritten to outcome-based plain English.
    expect(html).toContain('Team members split across customers');
    expect(html).toContain('Sprint time-budget');
    expect(html).toContain('id="seDefaultDevDays"');
    expect(html).toContain('id="seDaysPerSPMult"');
    app.teardown();
  });

  it('Scoring card surfaces the worked-example table', async () => {
    const app = await loadApp();
    app.App.activeCustomer = 'GCC';
    app.App.renderConfig();
    const card = app.document.getElementById('scoringCard');
    expect(card).not.toBeNull();
    const html = card.outerHTML;
    expect(html).toContain('How are the status / RAG weights derived?');
    expect(html).toContain('Worked example');
    // New "Apply all recommendations" button shipped with the priority rework.
    expect(html).toContain('Apply all recommendations');
    expect(html).toContain('Recompute recommendations');
    app.teardown();
  });
});
