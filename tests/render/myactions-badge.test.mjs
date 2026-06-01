// My Actions nav badge — load-time desync guard.
//
// Regression for a badge that lagged behind MyActions.collect() until the user
// first navigated into the My Actions view. The badge must be correct at load
// time (it is updated by onDataLoaded), so we assert WITHOUT ever calling
// App.navigate('myactions') or MyActions.render().

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('My Actions nav badge (load time)', () => {
  it('#navBadgeMyActions matches MyActions.collect() total without visiting the view', async () => {
    // loadApp() hydrates portfolio-data.json via validateAndLoad -> onDataLoaded,
    // which sets the active customer and refreshes the nav badges. No navigation.
    const app = await loadApp();

    const badge = app.document.getElementById('navBadgeMyActions');
    expect(badge).not.toBeNull();

    const { decisions, actions, blockers } = app.MyActions.collect();
    const expectedTotal = decisions.length + actions.length + (blockers ? blockers.length : 0);

    // The badge must already reflect the full count at load — not the seeded "0".
    expect(badge.textContent).toBe(String(expectedTotal));

    app.teardown();
  });
});
