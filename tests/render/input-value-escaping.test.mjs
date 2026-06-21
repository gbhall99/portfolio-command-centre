// Hardening L1 (escaping/XSS) — free-text input value="…" sinks (H-003).
// value="…" is double-quoted, so an apostrophe is harmless, but a literal
// double-quote in a persisted free-text field (member name/role, customer,
// product, persona/person/objective fields, holiday name) lets esc()-encoded
// output break out of the attribute and inject e.g. onfocus= (stored XSS via
// pasted/imported data). escAttr encodes the quote; the input value must still
// round-trip intact (the browser decodes the entity back into .value).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

// Contains a double-quote (breakout char for a double-quoted attribute) plus an
// angle bracket; an apostrophe too, to prove benign chars survive the round-trip.
const HOSTILE = 'O\'Br"ien" onfocus="window.__xss=1 <x>';

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ team_members: [makeMember({ name: HOSTILE, role: 'Eng' })] }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('Member edit modal — input value escaping (L1/H-003)', () => {
  it('a double-quote in a member name cannot break out, and the value round-trips', () => {
    const { Capacity, document } = app;
    // showEditModal writes into fixed container ids that live in the full app.
    for (const id of ['teamEditTitle', 'teamEditFields', 'teamEditModal', 'teamEditOverlay']) {
      if (!document.getElementById(id)) {
        const el = document.createElement('div'); el.id = id; document.body.appendChild(el);
      }
    }

    Capacity.editMember(0);

    const input = document.getElementById('tmName');
    expect(input).toBeTruthy();
    // No injected handler became a real attribute…
    expect(input.getAttribute('onfocus')).toBe(null);
    // …and the value survived the escAttr round-trip byte-for-byte.
    expect(input.value).toBe(HOSTILE);
  });
});
