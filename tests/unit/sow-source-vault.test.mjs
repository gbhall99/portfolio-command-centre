// sow-source-vault — full-source vault with span-level citations.
// The complete uploaded source is chunked (size-capped) and stored on the SoW;
// section-level AI actions retrieve the most relevant chunks via a pure
// keyword/BM25 relevance score (no embeddings); each retrieved chunk is
// untrusted-wrapped before it grounds a prompt. Span citations returned by
// generation are verified deterministically against the stored source — an
// unverifiable citation is dropped and its section flagged. Legacy
// source_excerpt still works. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  });
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

// A multi-paragraph source: each paragraph is about a distinct topic so
// retrieval relevance can be asserted deterministically.
const SOURCE = [
  'The client is Acme Industries, a manufacturer of industrial widgets headquartered in Leeds. This engagement covers the finance analytics workstream.',
  'The data engineering team will build an ingestion pipeline from the SAP export files into a Snowflake warehouse, with incremental loads every night and validation checks.',
  'The Tableau dashboard must show a revenue trend by region, a gross-margin KPI, and a filterable order backlog table for the commercial directors.',
  'Governance: a fortnightly steering committee chaired by the sponsor will review progress. The client is responsible for granting VPN access before sprint one begins.'
].join('\n\n');

function def(a) { return a.Definitions.loadJson('sow/sow-definition.json'); }

describe('chunk storage + size cap', () => {
  it('stores the FULL source chunked (not just 4000 chars), capped at SOURCE_MAX_BYTES', () => {
    const { Sow } = app;
    // A source far bigger than the legacy 4000-char excerpt.
    const big = Array.from({ length: 400 }, (_, i) => 'Paragraph ' + i + ' discusses topic number ' + i + ' in some detail with enough words to be a real chunk.').join('\n\n');
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def(app),
      generatedSections: def(app).sections.map(s => ({ id: s.id, content: 'w '.repeat(30), supported_by_source: true })),
      name: 'Big', source_text: big
    });
    expect(Array.isArray(sow.source_chunks)).toBe(true);
    expect(sow.source_chunks.length).toBeGreaterThan(1);
    // The stored full source is longer than the legacy excerpt clip.
    const stored = sow.source_chunks.map(c => c.text).join(' ');
    expect(stored.length).toBeGreaterThan(4000);
    // Chunk indices are 1-based and sequential.
    expect(sow.source_chunks[0].i).toBe(1);
  });

  it('caps stored source bytes to ~SOURCE_MAX_BYTES', () => {
    const { Sow } = app;
    const huge = 'x'.repeat(Sow.SOURCE_MAX_BYTES + 50000);
    const chunks = Sow.chunkSource(huge);
    const total = chunks.map(c => c.text).join('').length;
    expect(total).toBeLessThanOrEqual(Sow.SOURCE_MAX_BYTES);
  });
});

describe('keyword relevance retrieval (pure, deterministic)', () => {
  it('returns the on-topic chunk for a query', () => {
    const { Sow } = app;
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def(app),
      generatedSections: def(app).sections.map(s => ({ id: s.id, content: 'w '.repeat(30), supported_by_source: true })),
      name: 'Topical', source_text: SOURCE
    });
    // A query about the dashboard should surface the Tableau paragraph first.
    const top = Sow.retrieveChunks(sow, 'tableau dashboard revenue margin backlog', 1);
    expect(top.length).toBe(1);
    expect(top[0].text).toContain('Tableau dashboard');
    // A query about ingestion should surface the engineering paragraph first.
    const top2 = Sow.retrieveChunks(sow, 'ingestion pipeline snowflake warehouse nightly loads', 1);
    expect(top2[0].text).toContain('ingestion pipeline');
    // Deterministic: identical query yields identical ranking.
    const again = Sow.retrieveChunks(sow, 'tableau dashboard revenue margin backlog', 1);
    expect(again[0].i).toBe(top[0].i);
  });

  it('retrievalBlock untrusted-wraps each retrieved chunk', () => {
    const { Sow } = app;
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def(app),
      generatedSections: def(app).sections.map(s => ({ id: s.id, content: 'w '.repeat(30), supported_by_source: true })),
      name: 'Wrapped', source_text: SOURCE
    });
    const block = Sow.retrievalBlock(sow, 'ingestion pipeline snowflake', 2);
    expect(block).toContain('<untrusted_document>');
    expect(block).toContain('¶');
    expect(Sow.retrievalBlock(sow, 'anything', 2)).not.toBe('');
    // No source → empty block.
    const empty = Sow.create({ customer: 'Acme Industries', definition: def(app), generatedSections: [], name: 'Empty', source_text: '' });
    expect(Sow.retrievalBlock(empty, 'anything')).toBe('');
  });
});

describe('span citation verification', () => {
  it('records a verified span as a source-span provenance chip', () => {
    const { Sow } = app;
    const verbatim = 'gross-margin KPI, and a filterable order backlog table';
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def(app),
      generatedSections: def(app).sections.map(s => ({
        id: s.id, content: 'w '.repeat(30), supported_by_source: true,
        source_spans: s.id === 'scope' ? [verbatim] : []
      })),
      name: 'Cited', source_text: SOURCE
    });
    const scope = sow.sections.find(s => s.id === 'scope');
    const span = (scope.sources || []).find(x => x.kind === 'source-span');
    expect(span).toBeTruthy();
    expect(span.text).toContain('gross-margin KPI');
    // The ref is the ¶ number of the chunk that contains it.
    expect(typeof span.ref).toBe('number');
    expect(Sow.verifySpan(sow, verbatim)).toBe(span.ref);
  });

  it('drops a fabricated span not present in the source AND flags the section', () => {
    const { Sow } = app;
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def(app),
      generatedSections: def(app).sections.map(s => ({
        id: s.id, content: 'w '.repeat(30), supported_by_source: true,
        source_spans: s.id === 'scope' ? ['a machine-learning fraud-detection model with real-time scoring'] : []
      })),
      name: 'Fabricated', source_text: SOURCE
    });
    const scope = sow.sections.find(s => s.id === 'scope');
    // No source-span chip recorded (the citation was unverifiable).
    expect((scope.sources || []).some(x => x.kind === 'source-span')).toBe(false);
    // The section is flagged, calling out the missing citation.
    expect(scope.flagged).toBe(true);
    expect(scope.flag_reason.toLowerCase()).toContain('could not be found');
    expect(Sow.verifySpan(sow, 'a machine-learning fraud-detection model')).toBe(null);
  });
});

describe('legacy source_excerpt still works', () => {
  it('a SoW with only source_excerpt (no chunks) still retrieves and verifies', () => {
    const { Sow } = app;
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def(app),
      generatedSections: def(app).sections.map(s => ({ id: s.id, content: 'w '.repeat(30), supported_by_source: true })),
      name: 'Legacy', source_text: SOURCE
    });
    // Simulate a pre-vault record: drop the chunks, keep the excerpt.
    sow.source_chunks = [];
    expect(Sow.sourceChunks(sow).length).toBeGreaterThan(0);        // chunked on the fly
    const top = Sow.retrieveChunks(sow, 'ingestion pipeline snowflake', 1);
    expect(top[0].text).toContain('ingestion pipeline');
    expect(Sow.hasSource(sow)).toBe(true);
  });
});

describe('per-section AI action grounds in retrieved chunks (untrusted-wrapped)', () => {
  it('uiDraftSection sends the retrieved, untrusted-wrapped source — not a blind slice', async () => {
    const { Sow, SowSkill, AI } = app;
    AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    AI.setDefaultProfile('mp');
    // The Tableau/dashboard paragraph is the on-topic one for a Scope draft.
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def(app),
      generatedSections: def(app).sections.map(s => ({ id: s.id, content: s.id === 'scope' ? '' : ('w '.repeat(30)), supported_by_source: true })),
      name: 'Draft', source_text: SOURCE
    });
    SowSkill._sowId = sow.id;
    SowSkill._mode = 'edit';
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ content: 'Drafted scope text.' }) },   // draft
      { text: JSON.stringify({ content: 'Drafted scope text.' }) }    // self-critique
    ]);
    await SowSkill.uiDraftSection('scope');
    const userMsg = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('<untrusted_document>');
    // The retrieved passage is real source text, not an arbitrary 4000-char head.
    expect(userMsg.content).toContain('¶');
    expect(SowSkill._redraft).toBeTruthy();
  });
});
