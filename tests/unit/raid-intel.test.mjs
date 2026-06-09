import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

const TODAY = '2026-06-09';
async function intel() { const app = await loadApp(makeDataset({})); return { R: app.RaidIntel, teardown: app.teardown }; }

describe('RaidIntel', () => {
  it('severity = impact*probability with bands', async () => {
    const { R, teardown } = await intel();
    expect(R.riskSeverity({ impact: 5, probability: 5 })).toBe(25);
    expect(R.riskSeverity({ impact: 0, probability: 5 })).toBe(0);
    expect(R.severityBand(15)).toBe('high');
    expect(R.severityBand(8)).toBe('medium');
    expect(R.severityBand(7)).toBe('low');
    teardown();
  });
  it('riskNearTarget: overdue or within 30 days', async () => {
    const { R, teardown } = await intel();
    expect(R.riskNearTarget({ target_date: '2026-05-01' }, TODAY)).toBe(true);
    expect(R.riskNearTarget({ target_date: '2026-06-25' }, TODAY)).toBe(true);
    expect(R.riskNearTarget({ target_date: '2026-09-30' }, TODAY)).toBe(false);
    expect(R.riskNearTarget({ target_date: null }, TODAY)).toBe(false);
    teardown();
  });
  it('riskUrgency escalates near-target risks above equal-severity far ones', async () => {
    const { R, teardown } = await intel();
    const near = R.riskUrgency({ impact: 3, probability: 3, target_date: '2026-06-15' }, TODAY);
    const far = R.riskUrgency({ impact: 3, probability: 3, target_date: '2026-12-01' }, TODAY);
    expect(near).toBeGreaterThan(far);
    teardown();
  });
  it('issueAgeDays + aging bands', async () => {
    const { R, teardown } = await intel();
    expect(R.issueAgeDays({ opened_date: '2026-05-10' }, TODAY)).toBe(30);
    expect(R.issueAgeDays({ opened_date: null }, TODAY)).toBe(null);
    expect(R.issueAging({ opened_date: '2026-05-10' }, TODAY)).toBe('amber');
    expect(R.issueAging({ opened_date: '2026-04-09' }, TODAY)).toBe('red');
    expect(R.issueAging({ opened_date: '2026-06-01' }, TODAY)).toBe(null);
    teardown();
  });
  it('decisionAgeDays + aging at 21d', async () => {
    const { R, teardown } = await intel();
    expect(R.decisionAgeDays({ date: '2026-05-19' }, TODAY)).toBe(21);
    expect(R.decisionAging({ date: '2026-05-19' }, TODAY)).toBe(true);
    expect(R.decisionAging({ date: '2026-06-01' }, TODAY)).toBe(false);
    teardown();
  });
});
