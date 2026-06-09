import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const demo = JSON.parse(readFileSync(join(root, 'portfolio-data-demo.json'), 'utf8'));

describe('D1 demo RAID seed', () => {
  it('risks have varied impact/probability and at least some target_dates', () => {
    const risks = (demo.projects || []).flatMap(p => p.risks_register || []);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.every(r => Number.isInteger(r.impact) && r.impact >= 1 && r.impact <= 5)).toBe(true);
    expect(risks.every(r => Number.isInteger(r.probability) && r.probability >= 1 && r.probability <= 5)).toBe(true);
    expect(new Set(risks.map(r => r.impact * r.probability)).size).toBeGreaterThan(1);
    expect(risks.some(r => r.target_date)).toBe(true);
  });
  it('issues have opened_dates', () => {
    const issues = (demo.projects || []).flatMap(p => p.issues_register || []);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every(i => typeof i.opened_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.opened_date))).toBe(true);
  });
  it('inline #demoDataset deep-equals portfolio-data-demo.json (WS-H sync)', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const m = html.match(/<script type="application\/json" id="demoDataset">([\s\S]*?)<\/script>/);
    expect(m).toBeTruthy();
    expect(JSON.parse(m[1])).toEqual(demo);
  });
});
