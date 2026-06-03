// Sample data must be fully prioritised so the detail/backlog surfaces never flag a
// shipped sample project as "MoSCoW not set" / "no WSJF inputs", and every project
// keeps at least one linked metric.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['portfolio-data.json', 'portfolio-data-demo.json'];
const MOSCOW = ['Must', 'Should', 'Could', "Won't"];

describe.each(FILES)('sample data %s — fully prioritised', (file) => {
  const data = JSON.parse(readFileSync(join(root, file), 'utf8'));
  const projects = data.projects || [];

  it('has projects', () => { expect(projects.length).toBeGreaterThan(0); });

  it('every project has complete WSJF + MoSCoW + a linked metric', () => {
    const bad = [];
    projects.forEach(p => {
      const wsjfOk = ['business_value', 'time_criticality', 'risk_reduction_opportunity']
        .every(k => Number.isInteger(p[k]) && p[k] >= 1 && p[k] <= 10);
      const moscowOk = MOSCOW.includes(p.moscow);
      const metricOk = Array.isArray(p.metric_ids) && p.metric_ids.length > 0;
      if (!wsjfOk || !moscowOk || !metricOk) bad.push(p.id + (wsjfOk ? '' : ' wsjf') + (moscowOk ? '' : ' moscow') + (metricOk ? '' : ' metric'));
    });
    expect(bad).toEqual([]);
  });
});
