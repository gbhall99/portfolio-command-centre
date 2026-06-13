// RAID "Actions" tab count.
//
// The former standalone Actions view is now a tab inside RAID, so its
// attention total surfaces on the Actions tab count (#raidCountActions)
// rather than a sidebar badge. This asserts that count matches
// MyActions.collect() once the RAID view renders.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('RAID Actions tab count', () => {
  it('#raidCountActions matches MyActions.collect() total after navigating to RAID', async () => {
    const app = await loadApp();
    app.App.navigate('raid');

    const countEl = app.document.getElementById('raidCountActions');
    expect(countEl).not.toBeNull();

    const { decisions, actions, blockers } = app.MyActions.collect();
    const expectedTotal = decisions.length + actions.length + (blockers ? blockers.length : 0);

    expect(countEl.textContent).toBe(String(expectedTotal));

    app.teardown();
  });
});
