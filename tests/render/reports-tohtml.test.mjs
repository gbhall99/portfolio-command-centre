import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

const SECTIONS = [
  { id: 'narrative', title: 'Narrative', html: '<p>All good</p>', audiences: ['customer', 'internal'] },
  { id: 'evm', title: 'EVM & cost', html: '<p>SPI 0.9</p>', audiences: ['internal'] }
];

describe('Reports.Doc.toHtml', () => {
  it('serializes a doc to a full HTML document with cover + sections', async () => {
    const app = await loadApp(makeDataset({}));
    const doc = app.Reports.Doc.buildDoc({ reportType: 'portfolio_pack', title: 'Portfolio', customer: 'Acme', sections: SECTIONS, audience: 'internal' });
    const html = app.Reports.Doc.toHtml(doc, { primaryColor: '#3b82f6' });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('rp-table'.slice(0, 2) === 'rp' ? '<style>' : '<style>'); // tokens injected
    expect(html).toContain('Portfolio');
    expect(html).toContain('Narrative');
    expect(html).toContain('EVM &amp; cost'); // internal section shown for internal audience
    expect(html).toContain('SPI 0.9');
    app.teardown();
  });
  it('redacts internal-only sections for a customer audience', async () => {
    const app = await loadApp(makeDataset({}));
    const doc = app.Reports.Doc.buildDoc({ reportType: 'portfolio_pack', title: 'Portfolio', customer: 'Acme', sections: SECTIONS, audience: 'customer' });
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toContain('Narrative');
    expect(html).not.toContain('SPI 0.9'); // EVM hidden from customers
    app.teardown();
  });
  it('classification band reflects the doc classification', async () => {
    const app = await loadApp(makeDataset({}));
    const doc = app.Reports.Doc.buildDoc({ reportType: 'portfolio_pack', classification: 'Confidential', sections: SECTIONS });
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html.toLowerCase()).toContain('confidential');
    app.teardown();
  });
});
