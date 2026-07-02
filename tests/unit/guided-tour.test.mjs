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
    while (Tour.STEPS[Tour._idx].id !== 'board') Tour.next();
    expect(App.currentView).toBe('board');
    expect(document.getElementById('tourCard').textContent).toContain('Board');

    // Back goes to the projects step (and its view).
    Tour.prev();
    expect(Tour.STEPS[Tour._idx].id).toBe('projects');
    expect(App.currentView).toBe('dashboard');

    // Drive to the end; the final next() finishes, tears down and persists.
    while (Tour._active && Tour._idx < Tour.STEPS.length - 1) Tour.next();
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
