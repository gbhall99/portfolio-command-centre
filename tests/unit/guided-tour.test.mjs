// Guided tour (Tour module) — spotlight walkthrough of the main views.
// Covers: step definitions stay anchored to real DOM/views, the
// start → next/prev → finish lifecycle (including view navigation),
// skip/Escape teardown, uiState persistence, the post-demo-load offer,
// and the command palette entry.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('Tour step definitions', () => {
  it('every step is well-formed and anchored to a real view/target', async () => {
    const app = await loadApp();
    const { Tour, document } = app;
    expect(Tour.STEPS.length).toBeGreaterThanOrEqual(8);
    const ids = new Set();
    Tour.STEPS.forEach(step => {
      expect(step.id, 'step id').toBeTruthy();
      expect(ids.has(step.id), 'duplicate step id: ' + step.id).toBe(false);
      ids.add(step.id);
      expect(step.title, step.id + ' title').toBeTruthy();
      expect(step.body, step.id + ' body').toBeTruthy();
      // A step either spotlights a target or is explicitly centered.
      expect(!!step.target || step.center === true, step.id + ' needs target or center').toBe(true);
      if (step.view) {
        const panelId = step.view === 'dashboard' || step.view === 'projects'
          ? 'viewDashboard'
          : 'view' + step.view.charAt(0).toUpperCase() + step.view.slice(1);
        expect(document.getElementById(panelId), step.id + ' view panel #' + panelId).toBeTruthy();
      }
      if (step.target) {
        expect(document.querySelector(step.target), step.id + ' target ' + step.target).toBeTruthy();
      }
    });
    // First and last steps are the centered welcome/finish bookends.
    expect(Tour.STEPS[0].center).toBe(true);
    expect(Tour.STEPS[Tour.STEPS.length - 1].center).toBe(true);
    app.teardown();
  });

  it('step copy carries no emojis (SVG-only iconography rule)', async () => {
    const app = await loadApp();
    const { Tour } = app;
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    Tour.STEPS.forEach(step => {
      expect(emoji.test(step.title + ' ' + step.body), step.id + ' contains emoji').toBe(false);
    });
    app.teardown();
  });
});

describe('Tour lifecycle', () => {
  it('start renders the layer, next/prev walk steps and navigate views, finish persists done', async () => {
    const app = await loadApp();
    const { Tour, App, document } = app;
    App.uiStateSet(Tour.DONE_KEY, null);

    Tour.start();
    expect(Tour._active).toBe(true);
    expect(document.getElementById('tourLayer')).toBeTruthy();
    expect(document.getElementById('tourCard').textContent).toContain('Welcome to Velocity');
    // jsdom rects are zero-sized, so every step degrades to the centered layout.
    expect(document.getElementById('tourLayer').classList.contains('tour-centered')).toBe(true);

    // Walk forward to the board step — the tour must navigate the app with it.
    // (guarded: a renamed step id must fail the assertion, not hang the suite)
    let hops = 0;
    while (Tour.STEPS[Tour._idx].id !== 'board' && Tour._active && hops++ < 30) Tour.next();
    expect(Tour.STEPS[Tour._idx].id).toBe('board');
    expect(App.currentView).toBe('board');
    expect(document.getElementById('tourCard').textContent).toContain('Board');

    // Back goes to the projects step (and its view).
    Tour.prev();
    expect(Tour.STEPS[Tour._idx].id).toBe('projects');
    expect(App.currentView).toBe('dashboard');

    // Drive to the end; the final next() finishes, tears down and persists.
    hops = 0;
    while (Tour._active && Tour._idx < Tour.STEPS.length - 1 && hops++ < 30) Tour.next();
    expect(Tour.STEPS[Tour._idx].id).toBe('finish');
    Tour.next();
    expect(Tour._active).toBe(false);
    expect(document.getElementById('tourLayer')).toBeFalsy();
    expect(App.uiStateGet(Tour.DONE_KEY)).toBe(true);
    expect(Tour.isDone()).toBe(true);
    app.teardown();
  });

  it('skip tears down and marks done; Escape key skips', async () => {
    const app = await loadApp();
    const { Tour, App, document, window } = app;

    App.uiStateSet(Tour.DONE_KEY, null);
    Tour.start();
    Tour.skip();
    expect(Tour._active).toBe(false);
    expect(document.getElementById('tourLayer')).toBeFalsy();
    expect(App.uiStateGet(Tour.DONE_KEY)).toBe(true);

    // Escape via the capture-phase key handler.
    App.uiStateSet(Tour.DONE_KEY, null);
    Tour.start();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(Tour._active).toBe(false);
    expect(App.uiStateGet(Tour.DONE_KEY)).toBe(true);
    app.teardown();
  });

  it('arrow keys advance and rewind while active', async () => {
    const app = await loadApp();
    const { Tour, App, document, window } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    Tour.start();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(Tour._idx).toBe(1);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(Tour._idx).toBe(0);
    Tour.skip();
    app.teardown();
  });

  it('start without data is a guarded no-op', async () => {
    const app = await loadApp(null); // file-loader state, no dataset
    const { Tour, document } = app;
    Tour.start();
    expect(Tour._active).toBe(false);
    expect(document.getElementById('tourLayer')).toBeFalsy();
    app.teardown();
  });
});

describe('Tour offer (post-demo-load prompt)', () => {
  it('loadDemoData offers the tour; declining persists and suppresses future offers', async () => {
    const app = await loadApp(null);
    const { Tour, App, document } = app;
    App.loadDemoData(); // inline #demoDataset island — synchronous in the page
    expect(document.getElementById('tourOffer')).toBeTruthy();

    Tour.dismissOffer();
    expect(document.getElementById('tourOffer')).toBeFalsy();
    expect(App.uiStateGet(Tour.DONE_KEY)).toBe(true);

    Tour.offer();
    expect(document.getElementById('tourOffer')).toBeFalsy();
    app.teardown();
  });

  it('starting from the offer removes it, and the offer never doubles up', async () => {
    const app = await loadApp();
    const { Tour, App, document } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    Tour.offer();
    Tour.offer();
    expect(document.querySelectorAll('.tour-offer').length).toBe(1);
    Tour.start();
    expect(document.getElementById('tourOffer')).toBeFalsy();
    expect(Tour._active).toBe(true);
    Tour.skip();
    app.teardown();
  });

  it('offer is suppressed in customer (read-only) mode', async () => {
    const app = await loadApp();
    const { Tour, App, document } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    App.customerMode = true;
    Tour.offer();
    expect(document.getElementById('tourOffer')).toBeFalsy();
    App.customerMode = false;
    app.teardown();
  });
});

describe('Tour hardening (H-101..H-104)', () => {
  it('H-101: Enter on a focused card button is left to the button, not hijacked as next', async () => {
    const app = await loadApp();
    const { Tour, App, document, window } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    Tour.start();
    Tour.next(); // step 2 — Back button exists
    expect(Tour._idx).toBe(1);
    const back = Array.from(document.querySelectorAll('#tourCard button')).find(b => b.textContent === 'Back');
    expect(back).toBeTruthy();
    back.focus();
    back.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    // The capture handler must NOT advance; the button's own (native) click
    // handles Enter in a real browser.
    expect(Tour._idx).toBe(1);
    Tour.skip();
    app.teardown();
  });

  it('H-103: start is blocked in customer (read-only) mode', async () => {
    const app = await loadApp();
    const { Tour, App, document } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    App.customerMode = true;
    Tour.start();
    expect(Tour._active).toBe(false);
    expect(document.getElementById('tourLayer')).toBeFalsy();
    App.customerMode = false;
    app.teardown();
  });

  it('H-104: focus returns to the pre-tour element on teardown', async () => {
    const app = await loadApp();
    const { Tour, App, document } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    const btn = document.getElementById('btnAssistant');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    Tour.start();
    expect(document.activeElement).not.toBe(btn); // moved into the card
    Tour.skip();
    expect(document.activeElement).toBe(btn);
    app.teardown();
  });
});

describe('Tour under adversarial app states (H-110)', () => {
  it('walks every step to finish on an EMPTY portfolio (0 projects) with the detail panel pre-opened', async () => {
    const app = await loadApp({
      customers: [{ name: 'Solo Co' }],
      projects: [],
      team_members: [],
      sprint_config: { sprints: [] }
    });
    const { Tour, App, document } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    Tour.start();
    expect(Tour._active).toBe(true);
    let guard = 0;
    while (Tour._active && guard++ < 30) Tour.next();
    expect(Tour._active).toBe(false);
    expect(App.uiStateGet(Tour.DONE_KEY)).toBe(true);
    expect(document.getElementById('tourLayer')).toBeFalsy();
    app.teardown();
  });
});

describe('Tour spotlight geometry (H-111, stubbed rects)', () => {
  const rect = (left, top, width, height) => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top
  });

  it('an off-canvas target (non-zero rect, fully outside the viewport) degrades to centered', async () => {
    const app = await loadApp();
    const { Tour, App, document } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    const sidebar = document.querySelector('.sidebar');
    // Mobile drawer position: translated fully off-screen to the left.
    sidebar.getBoundingClientRect = () => rect(-220, 0, 220, 800);
    Tour.start();
    let hops = 0;
    while (Tour.STEPS[Tour._idx].id !== 'nav' && Tour._active && hops++ < 30) Tour.next();
    expect(Tour.STEPS[Tour._idx].id).toBe('nav');
    expect(Tour._targetEl(Tour.STEPS[Tour._idx])).toBeNull();
    expect(document.getElementById('tourLayer').classList.contains('tour-centered')).toBe(true);
    Tour.skip();
    app.teardown();
  });

  it('a visible target gets the spotlight box (padded rect) and leaves centered mode', async () => {
    const app = await loadApp();
    const { Tour, App, document, window } = app;
    App.uiStateSet(Tour.DONE_KEY, null);
    const header = document.getElementById('headerCustomer');
    header.getBoundingClientRect = () => rect(100, 10, 200, 30);
    // jsdom windows report innerWidth/innerHeight 1024x768 — the rect is inside.
    expect(window.innerWidth).toBeGreaterThan(0);
    Tour.start();
    Tour.next(); // customer step targets #headerCustomer
    expect(Tour.STEPS[Tour._idx].id).toBe('customer');
    const layer = document.getElementById('tourLayer');
    expect(layer.classList.contains('tour-centered')).toBe(false);
    const spot = document.getElementById('tourSpot');
    expect(spot.style.left).toBe('94px');  // 100 - 6px pad
    expect(spot.style.top).toBe('4px');    // 10 - 6px pad
    expect(spot.style.width).toBe('212px'); // 200 + 2*6
    expect(spot.style.height).toBe('42px'); // 30 + 2*6
    Tour.skip();
    app.teardown();
  });
});

describe('Tour entry points', () => {
  it('command palette carries a Guided tour action', async () => {
    const app = await loadApp();
    const { CommandPalette } = app;
    const items = CommandPalette._build();
    const entry = items.find(i => /guided tour/i.test(i.title));
    expect(entry).toBeTruthy();
    expect(entry.group).toBe('Actions');
    app.teardown();
  });
});
