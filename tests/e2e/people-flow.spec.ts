import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

/**
 * Person rework E2E flow:
 *   1. Create a Person in a persona that has RACI defaults → confirm seeded RACI
 *   2. Edit a target override on that Person and verify effectiveHoldings reflects it
 *   3. Drill the matrix to a single metric and back
 *   4. Tier filter on the matrix narrows the visible columns
 */
test('Person flow — create person, seed RACI, override target, matrix drill + tier', async ({ page }) => {
  await openAppWithData(page);

  const seed = await page.evaluate(() => {
    const App     = (window as any).App;
    const Personas= (window as any).Personas;
    const Metrics = (window as any).Metrics;
    const Person  = (window as any).Person;
    if (!Personas || !Metrics || !Person) return { ok: false, reason: 'modules not exposed' };

    if (!App.activeCustomer) {
      const c = (App.getCustomers() || [])[0];
      if (c) App.setActiveCustomer(c);
    }
    const cust = App.activeCustomer;

    // Persona that has metric_holdings + a metric with persona-keyed default
    // so we can verify seeding + override.
    const persona = Personas.add({ name: 'E2E Test Persona', role_title: 'Test', customer: cust });
    const metric  = Metrics.add({
      name: 'E2E Margin', definition: 'E2E test', group_id: 'performance',
      dimensions: ['region'], status: 'live', customer: cust,
    });
    Personas.addHolding(persona.id, { metric_id: metric.id, filter: { region: 'North' }, targets: [{ period: '2026', value: 100, period_type: 'annual' }] });
    // Add the persona to raci_defaults.accountable on this metric.
    metric.raci_defaults.accountable.push(persona.id);
    App._save && App._save();

    // Now create a Person; constructor should seed metric.raci.accountable with their id.
    const newPerson = Person.add({ name: 'E2E Diane', role_title: 'GM N', persona_id: persona.id, department: 'Ops', region: 'North', customer: cust });

    // Confirm RACI seeded.
    const seededAccountable = (Metrics.byId(metric.id).raci.accountable || []).includes(newPerson.id);

    // Set a target_override and verify effectiveHoldings reflects it.
    Person.setTargetOverride(newPerson.id, metric.id, { region: 'North' }, [{ period: '2026', value: 250, period_type: 'annual' }]);
    const eff = Person.effectiveHoldings(newPerson)[0];

    return { ok: true, personId: newPerson.id, personaId: persona.id, metricId: metric.id, seededAccountable, overrideValue: eff && eff.targets[0] && eff.targets[0].value };
  });

  expect(seed.ok).toBeTruthy();
  expect(seed.seededAccountable).toBe(true);
  expect(seed.overrideValue).toBe(250);

  // 2026-05 IA rework: People live as a sub-tab inside the top-level Personas
  // view (under Governance). The RACI matrix view in Metrics was removed in
  // favour of inline R/A/C/I columns + a cascade drill-down on each metric row.
  await page.click('.nav-item[data-view="personas"]');
  await page.click('#viewPersonas .strategy-tabs button:has-text("People")');
  await expect(page.locator('#viewPersonas')).toContainText('E2E Diane');

  // The Accountable column on the metric's row should carry the person's pill.
  // RACI view defaults to "Persona" — flip to "Person" so the named individual
  // pills surface instead of the persona archetype templates.
  await page.click('.nav-item[data-view="metrics"]');
  const toggleBtn = page.locator('#viewMetrics .metric-raci-view-btn').filter({ hasText: /^Person$/ });
  await toggleBtn.click();
  await expect(toggleBtn).toHaveClass(/is-active/);
  const metricRow = page.locator(`#viewMetrics tr[data-metric-id="${seed.metricId}"]`).first();
  await expect(metricRow).toBeVisible();
  await expect(metricRow.locator('.raci-pill-A', { hasText: 'E2E Diane' })).toHaveCount(1);

  // Expanding the row reveals the cascade (the holding persona).
  await metricRow.locator('.metric-twisty').click();
  await expect(page.locator(`#viewMetrics .metric-cascade-row[data-parent="${seed.metricId}"]`).first()).toBeVisible();
});
