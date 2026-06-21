// Hardening L1 (escaping/XSS) — inline-handler args (H-005). esc() does not
// encode quotes, so a team-member name carrying a quote/apostrophe (e.g.
// O'Brien) interpolated into an onclick="…('name')" handler breaks the JS
// string — a functional break for ordinary names and an injection vector for
// hostile imported data. The member-impact button is now index-based (matching
// the grid's edit/delete buttons) and the in-modal Simulate button is wired via
// addEventListener over a closure, so no name reaches an inline handler.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeSprint, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const HOSTILE = "O'Brien\" onmouseover=\"window.__xss=1";

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    team_members: [makeMember({ name: HOSTILE })],
    sprints: [makeSprint({ sprint_id: 'CY26-S1', start_date: '2026-01-05' })],
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('Capacity member-impact — handler escaping (L1/H-005)', () => {
  it('the grid impact button is index-based, never interpolating the member name', () => {
    const { Capacity, document } = app;
    // renderTeamGrid() writes into #teamGrid rather than returning a string.
    let host = document.getElementById('teamGrid');
    if (!host) { host = document.createElement('div'); host.id = 'teamGrid'; document.body.appendChild(host); }
    Capacity.renderTeamGrid();

    const btn = [...host.querySelectorAll('button[title="Simulate dropping this member"]')][0];
    expect(btn).toBeTruthy();
    const onclick = btn.getAttribute('onclick') || '';
    // index-based call, and the raw name never appears in the handler string.
    expect(onclick).toMatch(/openMemberImpactModal\(\d+\)/);
    expect(onclick).not.toContain("O'Brien");
    expect(onclick).not.toContain('onmouseover');
  });

  it('the modal accepts a name too (programmatic/back-compat callers)', () => {
    const { Capacity, document } = app;
    Capacity.openMemberImpactModal(HOSTILE); // by name
    expect(document.getElementById('memberImpactOverlay')).toBeTruthy();
    document.getElementById('memberImpactOverlay').remove();
  });

  it('opening the modal by index renders without breaking out of any handler', () => {
    const { Capacity, document } = app;
    Capacity.openMemberImpactModal(0);

    const overlay = document.getElementById('memberImpactOverlay');
    expect(overlay).toBeTruthy();
    // The hostile name is shown as text (escaped), not as live markup.
    expect(overlay.querySelector('h3').textContent).toContain("O'Brien");

    const run = overlay.querySelector('#miRunImpact');
    expect(run).toBeTruthy();
    // Simulate is wired via addEventListener — no inline onclick to break out of.
    expect(run.getAttribute('onclick')).toBe(null);
    // No injected handler leaked onto the button.
    expect(run.getAttribute('onmouseover')).toBe(null);
    overlay.remove();
  });
});
