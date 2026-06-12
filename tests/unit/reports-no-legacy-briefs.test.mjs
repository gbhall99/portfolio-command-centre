import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

describe('legacy brief renderers removed', () => {
  for (const id of ['exportProjectPack', 'exportBusinessCase', 'exportCustomerPack', 'exportPortfolioPack', 'buildProjectPackDoc', 'buildCustomerPackDoc']) {
    it('Report.' + id + ' is gone', () => {
      expect(html).not.toContain(id + '(');
    });
  }
});
