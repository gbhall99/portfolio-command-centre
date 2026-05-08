import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('Gantt._formatSlip', () => {
  it('formats day slips for ±1 to ±6', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(0)).toBe('on plan');
    expect(app.Gantt._formatSlip(1)).toBe('+1d');
    expect(app.Gantt._formatSlip(6)).toBe('+6d');
    expect(app.Gantt._formatSlip(-1)).toBe('−1d');
    expect(app.Gantt._formatSlip(-6)).toBe('−6d');
    app.teardown();
  });

  it('formats whole weeks for multiples of 7', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(7)).toBe('+1w');
    expect(app.Gantt._formatSlip(14)).toBe('+2w');
    expect(app.Gantt._formatSlip(21)).toBe('+3w');
    expect(app.Gantt._formatSlip(-7)).toBe('−1w');
    expect(app.Gantt._formatSlip(-14)).toBe('−2w');
    app.teardown();
  });

  it('formats weeks-and-days for non-multiples ≥ 7', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(8)).toBe('+1w 1d');
    expect(app.Gantt._formatSlip(10)).toBe('+1w 3d');
    expect(app.Gantt._formatSlip(13)).toBe('+1w 6d');
    expect(app.Gantt._formatSlip(15)).toBe('+2w 1d');
    expect(app.Gantt._formatSlip(25)).toBe('+3w 4d');
    expect(app.Gantt._formatSlip(-10)).toBe('−1w 3d');
    app.teardown();
  });
});

describe('Gantt._humaniseField', () => {
  it('returns mapped labels for known fields', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('size_data_engineering')).toBe('Data Engineering scope');
    expect(app.Gantt._humaniseField('size_engineering')).toBe('Data Engineering scope');
    expect(app.Gantt._humaniseField('size_total')).toBe('Total scope');
    expect(app.Gantt._humaniseField('size_uat_adoption')).toBe('UAT scope');
    expect(app.Gantt._humaniseField('size_tableau')).toBe('Tableau scope');
    expect(app.Gantt._humaniseField('size_data_science')).toBe('Data Science scope');
    expect(app.Gantt._humaniseField('size_requirements')).toBe('Requirements scope');
    expect(app.Gantt._humaniseField('target_date')).toBe('Target date');
    expect(app.Gantt._humaniseField('start_date')).toBe('Start date');
    expect(app.Gantt._humaniseField('hard_deadline')).toBe('Hard deadline');
    expect(app.Gantt._humaniseField('rag_schedule')).toBe('Schedule RAG');
    expect(app.Gantt._humaniseField('rag_resourcing')).toBe('Resourcing RAG');
    expect(app.Gantt._humaniseField('rag_scope')).toBe('Scope RAG');
    expect(app.Gantt._humaniseField('moscow')).toBe('MoSCoW priority');
    expect(app.Gantt._humaniseField('skill_splits')).toBe('Sprint allocation');
    expect(app.Gantt._humaniseField('governance_forum')).toBe('Meeting');
    expect(app.Gantt._humaniseField('manager')).toBe('Manager');
    app.teardown();
  });

  it('falls back to title-case for unknown fields', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('phase_order')).toBe('Phase Order');
    expect(app.Gantt._humaniseField('made_up_field')).toBe('Made Up Field');
    app.teardown();
  });

  it('returns the input unchanged for null / empty', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('')).toBe('');
    expect(app.Gantt._humaniseField(null)).toBe('');
    app.teardown();
  });
});
