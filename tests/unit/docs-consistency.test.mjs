// L20 docs-vs-behaviour guards: pin the authoritative docs to what the code
// actually does, so a doc claim can't silently drift from the implementation.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const solver = readFileSync(join(root, 'SOLVER.md'), 'utf8');

describe('SOLVER.md matches the solver (H-025)', () => {
  it('documents R12 because the code enforces the concurrent single-person guard', () => {
    // The rule IS in the code…
    expect(html).toContain('enforceConcurrentSinglePerson');
    expect(html).toContain('concurrentOverlapAllowedSkills');
    // …so the authoritative doc must document R12 (it previously stopped at R11).
    expect(solver).toMatch(/Rules \(R1[–-]R12\)/);
    expect(solver).toMatch(/\*\*R12\*\*/);
  });

  it('no longer points contributors at the non-existent /tmp solver test', () => {
    expect(solver).not.toContain('/tmp/pcc-solver-test');
    // …and names the real suites that exist.
    expect(solver).toContain('tests/unit/solver-r12.test.mjs');
  });
});
