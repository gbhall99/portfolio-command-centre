// The Gantt dependency arrow used to route around the rightmost bar in the span and then
// backtrack horizontally to the target — that's the visual jank the senior manager + UX
// designer flagged. Redesign goal: the arrow always flows left → right and approaches its
// target's left edge from the LEFT so the arrowhead points forward, even if the path
// overlaps another bar.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

function lastSegmentOfPath(d) {
  // SVG path commands we use: M, H, V, Q, C, L. Return [cmd, args] of the last segment.
  // The last command in our routing is always an `H <x>` — that's the segment that lands at the
  // target. Parse from the right.
  const m = String(d).match(/([MLHVCQ][\d\s\-\.]+)\s*$/);
  return m ? m[1].trim() : null;
}

function targetStartX(d) {
  // The path ends with `H <toX>` — return that final x as a number.
  const m = String(d).match(/H\s*(-?[\d\.]+)\s*$/);
  return m ? parseFloat(m[1]) : null;
}

function previousXBeforeFinalH(d) {
  // The segment before `H toX` is a Q corner, ending at "(midX + r) toY". Capture that x.
  const m = String(d).match(/Q\s*(-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)\s+H\s*(-?[\d\.]+)\s*$/);
  return m ? parseFloat(m[3]) : null;
}

describe('Gantt dependency arrows — clean L→R routing', () => {
  it('forward dependency: final segment moves left → right (arrowhead points forward)', async () => {
    resetIdSeq();
    const today = new Date();
    const fmt = ms => new Date(ms).toISOString().slice(0, 10);
    const sprints = [{ sprint_id: 'CY99-S1', start_date: fmt(today.getTime() - 30 * 86400000), hardening_start: fmt(today.getTime() + 1 * 86400000), end_date: fmt(today.getTime() + 8 * 86400000) }];
    // A finishes earlier than B starts (classic finish-to-start).
    const a = makeProject({ id: 'GCC-A', name: 'A', start_date: fmt(today.getTime() - 30 * 86400000), target_date: fmt(today.getTime() - 5 * 86400000) });
    const b = makeProject({ id: 'GCC-B', name: 'B', start_date: fmt(today.getTime() + 5 * 86400000), target_date: fmt(today.getTime() + 30 * 86400000) });
    b.dependencies = [{ type: 'project', kind: 'blocked_by', target_id: 'GCC-A' }];
    const app = await loadApp(makeDataset({ projects: [a, b], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.App.navigate('roadmap');
    if (typeof app.Gantt.render === 'function') app.Gantt.render();
    const path = app.window.document.querySelector('.gantt-dep-path[data-from="GCC-A"][data-to="GCC-B"]');
    expect(path).not.toBeNull();
    const d = path.getAttribute('d');
    const finalX = targetStartX(d);
    const beforeX = previousXBeforeFinalH(d);
    expect(finalX).not.toBeNull();
    expect(beforeX).not.toBeNull();
    // Final H must move strictly to the right (final-segment direction = arrowhead direction).
    expect(finalX).toBeGreaterThan(beforeX);
    app.teardown();
  });

  it('long-span forward dependency does not backtrack horizontally', async () => {
    resetIdSeq();
    const today = new Date();
    const fmt = ms => new Date(ms).toISOString().slice(0, 10);
    const sprints = [{ sprint_id: 'CY99-S1', start_date: fmt(today.getTime() - 30 * 86400000), hardening_start: fmt(today.getTime() + 1 * 86400000), end_date: fmt(today.getTime() + 8 * 86400000) }];
    // Five rows; row 0 finishes at -25d, row 4 starts at +5d. In between are bars whose right
    // edges extend past row 0's end. Old routing would shoot past all of them then backtrack.
    const projs = [];
    for (let i = 0; i < 5; i++) {
      projs.push(makeProject({
        id: 'GCC-' + i,
        name: 'P' + i,
        start_date: fmt(today.getTime() + (-25 + i * 5) * 86400000),
        target_date: fmt(today.getTime() + (-15 + i * 8) * 86400000)
      }));
    }
    projs[4].dependencies = [{ type: 'project', kind: 'blocked_by', target_id: 'GCC-0' }];
    const app = await loadApp(makeDataset({ projects: projs, sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.App.navigate('roadmap');
    if (typeof app.Gantt.render === 'function') app.Gantt.render();
    const path = app.window.document.querySelector('.gantt-dep-path[data-from="GCC-0"][data-to="GCC-4"]');
    expect(path).not.toBeNull();
    const d = path.getAttribute('d');
    // The path's H positions trace the corridor. None of the H targets should exceed the
    // target bar's right edge (i.e., we don't shoot past target and come back).
    const harvested = [];
    String(d).replace(/[MQH]\s*(-?[\d\.]+)/g, (_, x) => { harvested.push(parseFloat(x)); return _; });
    const targetStart = targetStartX(d);
    expect(targetStart).not.toBeNull();
    // Every H/M/Q x in the path should be <= target start + small tolerance for corner radius.
    harvested.forEach(x => {
      expect(x).toBeLessThanOrEqual(targetStart + 1);
    });
    app.teardown();
  });
});
