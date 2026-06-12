import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

describe('single document engine', () => {
  it('legacy Report serializer is gone', () => {
    expect(html).not.toContain('_baseStyles(');
    expect(html).not.toContain('Report.buildDoc(');
  });
  it('only Reports.open performs window.open for printing', () => {
    // every window.open(...) for a report must be inside Reports.open;
    // allow at most the single occurrence in Reports.open's body
    const count = (html.match(/window\.open\(''/g) || []).length;
    expect(count).toBeLessThanOrEqual(1);
  });
});
