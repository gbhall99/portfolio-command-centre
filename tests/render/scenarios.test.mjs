import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

describe('Scenario manager modal', () => {
  it('opens with Save / Load / list rendering', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'X' })], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.saveScenario('Plan A');
    app.App.openScenarioManager();
    const overlay = app.window.document.getElementById('scenarioManagerOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toMatch(/Plan A/);
    expect(overlay.innerHTML).toMatch(/Save current/);
    app.teardown();
  });
});
