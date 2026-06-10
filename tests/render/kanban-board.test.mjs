// WS7 — render snapshot for the Kanban board (pinned HTML; regenerate with
// npm run test:update-snapshots and review the diff like code).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Kanban board render', () => {
  it('board with cards, WIP limit and an empty column matches the snapshot', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [
        makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'In Progress', manager: 'Dana', priority: 1, hard_deadline: '2099-06-01' }),
        makeProject({ id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries', status: 'Blocked', priority: 2 })
      ]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Kanban.setWipLimit('In Progress', 1);
    app.App.navigate('board');
    const html = app.document.getElementById('kbBoard').innerHTML;
    await expect(html).toMatchFileSnapshot('./__snapshots__/kanban-board.html');
    app.App.uiStateSet('board.wip', null);
    app.teardown();
  });
});
