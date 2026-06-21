// Hardening L4 (schema & migrations) — full-object migrate idempotency +
// export->import round-trip. The existing idempotency test only compares
// data.projects; this guards the WHOLE data object (every collection: sows,
// wireframes, metrics, personas, people, products, billing_arrangements,
// status_reports, plan_scenarios, governance, …) so a non-idempotent migration
// step on any sub-collection is caught, and proves export->reimport is lossless.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

// meta.exported_at is intentionally re-stamped on every export — exclude only
// that volatile field from the comparison (everything else must be stable).
function stable(data) {
  const clone = JSON.parse(JSON.stringify(data));
  if (clone.meta) { delete clone.meta.exported_at; }
  return JSON.stringify(clone);
}

describe('migrate idempotency + export round-trip (L4)', () => {
  it('migrateSchema is idempotent across the ENTIRE data object (not just projects)', async () => {
    const app = await loadApp(); // bundled portfolio-data.json, already migrated on load
    const before = stable(app.App.data);
    app.App.migrateSchema(app.App.data);
    const after = stable(app.App.data);
    expect(after).toBe(before);
    app.teardown();
  });

  it('export -> re-import is lossless (JSON round-trip through validateAndLoad)', async () => {
    const app = await loadApp();
    const before = stable(app.App.data);
    // Simulate exportJSON (serialise) then importing that file (validateAndLoad).
    const exported = JSON.parse(JSON.stringify(app.App.data));
    app.App.validateAndLoad(exported);
    const after = stable(app.App.data);
    expect(after).toBe(before);
    app.teardown();
  });
});
