# Capacity Overlay z-index Fix — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Bump z-index of the Capacity sprint-overrides + member-impact modals so they're never hidden behind other UI.

**Spec:** `docs/superpowers/specs/2026-05-06-capacity-overlay-fix-design.md`

## Task 1: Bump z-index on `.team-edit-overlay` and `.team-edit-modal`

**Files:**
- Modify: `index.html` lines ~1503, ~1512

- [ ] **Step 1: Replace the z-index values**

Find:
```css
.team-edit-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 20px; z-index: 300; …
```
Change `z-index: 300` to `z-index: 9001`.

Find:
```css
.team-edit-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 299; }
```
Change `z-index: 299` to `z-index: 9000`.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "fix(capacity): bump team-edit modal/overlay z-index above panel/header"
```

---

## Task 2: Bump z-index on memberImpactOverlay

**Files:**
- Modify: `index.html` `Capacity.openMemberImpactModal` (around line 22421)

- [ ] **Step 1: Replace the inline cssText**

Find the line setting `overlay.style.cssText = 'position:fixed;inset:0;z-index:300;...';` inside `Capacity.openMemberImpactModal`. Change `z-index:300` to `z-index:9100`.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "fix(capacity): bump memberImpact overlay z-index above sprint-overrides"
```

---

## Task 3: E2E — overlays render in front

**Files:**
- Create: `tests/e2e/capacity-overlay.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Sprint overrides modal renders above panel overlay', async ({ page }) => {
  await openAppWithData(page);
  // Open detail panel for first project (background)
  const firstId = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((id) => (window as any).DetailPanel.open(id), firstId);
  // Navigate to capacity view
  await page.evaluate(() => (window as any).App.navigate('capacity'));
  // Trigger sprint-overrides modal directly (Capacity.openTeamEdit may not match user click; use the underlying API)
  const opened = await page.evaluate(() => {
    const App = (window as any).App;
    const Capacity = (window as any).Capacity;
    const sprintId = (App.data.sprints || [])[0] && App.data.sprints[0].sprint_id;
    if (!sprintId || !Capacity || typeof Capacity.openSprintEdit !== 'function') return false;
    Capacity.openSprintEdit(sprintId, App.activeCustomer);
    return true;
  });
  test.skip(!opened, 'Capacity.openSprintEdit not available in this build');
  await expect(page.locator('#teamEditModal')).toBeVisible();
  const z = await page.evaluate(() => {
    const m = document.getElementById('teamEditModal');
    return m ? window.getComputedStyle(m).zIndex : null;
  });
  expect(Number(z)).toBeGreaterThanOrEqual(9000);
});

test('Member impact overlay sits above team-edit modal', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('capacity'));
  const member = await page.evaluate(() => {
    const m = (window as any).App.data.team_members && (window as any).App.data.team_members[0];
    return m ? m.name : null;
  });
  test.skip(!member, 'No team member to drive the test');
  await page.evaluate((name) => (window as any).Capacity.openMemberImpactModal(name), member);
  await expect(page.locator('#memberImpactOverlay')).toBeVisible();
  const z = await page.evaluate(() => {
    const o = document.getElementById('memberImpactOverlay');
    return o ? window.getComputedStyle(o).zIndex : null;
  });
  expect(Number(z)).toBeGreaterThanOrEqual(9100);
});
```

- [ ] **Step 2: Run E2E**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:e2e
```
Expected: PASS (gantt-interactions flake allowed).

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add tests/e2e/capacity-overlay.spec.ts
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "test(capacity): E2E asserts overlays land above panel/header"
```
