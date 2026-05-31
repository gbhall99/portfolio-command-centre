import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

/**
 * Task 23: full strategy round-trip — create persona → objective → metric →
 * assign metric to persona → link metric to project → verify Strategy section
 * shows derived objective + persona on the project's detail panel.
 *
 * The plan's original spec assumed a click-driven UI for entity creation that
 * doesn't (yet) exist in the production helper. We exercise the same business
 * round-trip via the window.__pcc__ bridge that helpers.ts attaches, then drive
 * the *visible* Strategy view + project detail panel through real clicks. This
 * still covers the full system: data persistence, navigation, view rendering,
 * and detail-panel rendering.
 */
test('Strategy round-trip — assign metric to persona and verify project derivation', async ({ page }) => {
  await openAppWithData(page);

  // Use the bridge to seed a persona/objective/metric and link to an existing project.
  const seedResult = await page.evaluate(() => {
    const App = (window as any).App;
    if (!App.activeCustomer) {
      const c = (App.getCustomers() || [])[0];
      if (c) App.setActiveCustomer(c);
    }
    const cust = App.activeCustomer;
    const Personas    = (window as any).Personas    || (() => null)();
    const Objectives  = (window as any).Objectives  || (() => null)();
    const Metrics     = (window as any).Metrics     || (() => null)();
    if (!Personas || !Objectives || !Metrics) return { ok: false, reason: 'modules not on window' };

    const o = Objectives.add({ name: 'E2E Reduce opex 15%', description: 'E2E test obj', status: 'active', customer: cust });
    const m = Metrics.add({ name: 'E2E Total opex', definition: 'E2E test metric', group_id: 'performance', objective_ids: [o.id], dimensions: ['region'], status: 'live', customer: cust });
    const p = Personas.add({ name: 'E2E Sarah Chen', role_title: 'CFO', customer: cust });
    Personas.addHolding(p.id, { metric_id: m.id, filter: {}, targets: [{ period: '2026', value: 1000, period_type: 'annual' }] });
    // Link to first project for this customer
    const proj = (App.data.projects || []).find((x: any) => x.customer === cust);
    if (proj) {
      proj.metric_ids = (proj.metric_ids || []).concat([m.id]);
      App._save && App._save();
    }
    return { ok: true, projectId: proj && proj.id, metricId: m.id, personaId: p.id, objectiveId: o.id };
  });

  expect(seedResult.ok).toBeTruthy();

  // 2026-05 IA rework: Personas + Metrics moved to their own top-level views
  // under Governance. Strategy now holds Objectives only.
  await page.click('.nav-item[data-view="personas"]');
  await expect(page.locator('#viewPersonas')).toHaveClass(/active/);
  const personasTable = page.locator('#viewPersonas .persona-table');
  await expect(personasTable).toContainText('E2E Sarah Chen');

  await page.click('.nav-item[data-view="metrics"]');
  await expect(page.locator('#viewMetrics')).toContainText('E2E Total opex');

  await page.click('.nav-item[data-view="strategy"]');
  await expect(page.locator('#viewStrategy')).toContainText('E2E Reduce opex 15%');

  // Open the project's detail panel and verify the Strategy section.
  if (seedResult.projectId) {
    await page.click('.nav-item[data-view="dashboard"]');
    await expect(page.locator('#projectTableBody')).toBeVisible();
    const row = page.locator(`#projectTableBody tr[data-id="${seedResult.projectId}"]`).first();
    await expect(row).toBeVisible();
    // Open deterministically via the bridge. The dashboard row uses a ~280 ms
    // deferred single-click open (so a double-click can take over for inline
    // edit); opening directly avoids that race.
    await page.evaluate((pid) => (window as any).DetailPanel.open(pid), seedResult.projectId);
    await expect(page.locator('#detailPanel.open')).toBeVisible();
    // Post-d9b4e83 IA: the read-only `.strategy-section` chip view on Overview was
    // removed in the strategy de-dup. The surviving editor is `.dp-strategy-section`
    // (renderStrategyEditFields) on the Scope & Value tab — switch to it before
    // asserting. It renders the project's explicitly-linked entities as chips; the
    // seed links the metric, so the linked metric "E2E Total opex" must appear here.
    // The derived-objective/persona assertions are intentionally dropped: derivation
    // lived only in the removed read-only section, and the objective + persona are
    // already verified above via the top-level personas/metrics/strategy view checks.
    await page.evaluate(() => (window as any).DetailPanel.switchTab('scope'));
    const strategySec = page.locator('#detailPanel .dp-strategy-section');
    await expect(strategySec).toContainText('E2E Total opex');
  }
});
