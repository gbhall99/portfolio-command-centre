// Tableau REST connector — pure request builders/parsers, transport
// orchestration (sign-in caching + 401 re-auth + CORS guidance), the
// wireframe tableau_refs entity contract, migration, prompt grounding and
// rendering safety. NEVER networks: Tableau._fetch and _blobToDataUrl are
// injected so every path is exercised deterministically.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const def = () => app.Definitions.loadJson('tableau/wireframe-definition.json');

function connect(Tableau, over = {}) {
  Tableau.saveSettings(Object.assign({
    server: 'https://ten.online.tableau.com', site: 'acme', apiVersion: '3.21',
    tokenName: 'tok', tokenSecret: 'sekret-secret-9999', timeoutMs: 30000
  }, over));
}

function resp(body, status = 200) {
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: () => null },
    json: async () => body,
    blob: async () => body
  };
}

// Queue-driven fake fetch; records every call url.
function fakeFetch(queue) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (next === undefined) throw new TypeError('Failed to fetch'); // CORS-style
    if (typeof next === 'function') return next(url, init);
    return next;
  };
  fn.calls = calls;
  return fn;
}

const SIGNIN_OK = { credentials: { token: 'TKN-1', site: { id: 'SITE-1', contentUrl: 'acme' } } };
const VIEWS_OK = { views: { view: [
  { id: 'V1', name: 'Exec Sales', contentUrl: 'ExecSales/sheet', workbook: { name: 'Sales WB' } },
  { id: 'V2', name: 'Ops Health', contentUrl: 'OpsHealth/sheet', workbook: { name: 'Ops WB' } }
] } };

describe('pure request builders + parsers (no I/O)', () => {
  it('buildSignin targets the versioned endpoint and carries the PAT + site', () => {
    const { Tableau } = app;
    const s = { server: 'https://ten.online.tableau.com/', apiVersion: '3.21', tokenName: 'tok', tokenSecret: 'sek', site: 'acme' };
    const req = Tableau.buildSignin(s);
    expect(req.url).toBe('https://ten.online.tableau.com/api/3.21/auth/signin');
    expect(req.method).toBe('POST');
    expect(req.body.credentials.personalAccessTokenName).toBe('tok');
    expect(req.body.credentials.personalAccessTokenSecret).toBe('sek');
    expect(req.body.credentials.site.contentUrl).toBe('acme');
  });

  it('parseSignin extracts token + siteId, and throws on a tokenless body', () => {
    const { Tableau } = app;
    expect(Tableau.parseSignin(SIGNIN_OK)).toMatchObject({ token: 'TKN-1', siteId: 'SITE-1' });
    expect(() => Tableau.parseSignin({ credentials: {} })).toThrow(/did not return a token/);
  });

  it('buildListViews + buildViewImage carry the auth header and correct paths', () => {
    const { Tableau } = app;
    const s = { server: 'https://x', apiVersion: '3.21' };
    const lv = Tableau.buildListViews(s, 'SITE-1', 'TKN-1');
    expect(lv.url).toContain('/api/3.21/sites/SITE-1/views?pageSize=100&pageNumber=1');
    expect(lv.headers['X-Tableau-Auth']).toBe('TKN-1');
    const iv = Tableau.buildViewImage(s, 'SITE-1', 'V1', 'TKN-1');
    expect(iv.url).toContain('/sites/SITE-1/views/V1/image');
    expect(iv.headers['X-Tableau-Auth']).toBe('TKN-1');
  });

  it('parseViews maps fields and tolerates a single (non-array) view', () => {
    const { Tableau } = app;
    const many = Tableau.parseViews(VIEWS_OK);
    expect(many.length).toBe(2);
    expect(many[0]).toMatchObject({ id: 'V1', name: 'Exec Sales', workbook: 'Sales WB' });
    const one = Tableau.parseViews({ views: { view: { id: 'V9', name: 'Solo' } } });
    expect(one.length).toBe(1);
    expect(one[0].id).toBe('V9');
    expect(Tableau.parseViews({}).length).toBe(0);
  });
});

describe('configuration state', () => {
  it('isConfigured is false until server + token name + secret are all set', () => {
    const { Tableau } = app;
    expect(Tableau.isConfigured()).toBe(false);
    Tableau.saveSettings({ server: 'https://x', tokenName: 'tok', tokenSecret: '', apiVersion: '3.21' });
    expect(Tableau.isConfigured()).toBe(false);
    connect(Tableau);
    expect(Tableau.isConfigured()).toBe(true);
  });

  it('the PAT secret lives in localStorage only — never in App.data or exports', () => {
    const { Tableau, App } = app;
    connect(Tableau);
    const exported = JSON.stringify(App.data);
    expect(exported).not.toContain('sekret-secret-9999');
    expect(app.window.localStorage.getItem('pcc_tableau_settings')).toContain('sekret-secret-9999');
  });
});

describe('transport orchestration (injected fetch — never networks)', () => {
  it('signs in once, caches the token, and lists views', async () => {
    const { Tableau } = app;
    connect(Tableau);
    Tableau._fetch = fakeFetch([resp(SIGNIN_OK), resp(VIEWS_OK)]);
    const views = await Tableau.listViews(true);
    expect(views.map(v => v.id)).toEqual(['V1', 'V2']);
    // a second list uses the cached token (no extra signin)
    Tableau._fetch = fakeFetch([resp(VIEWS_OK)]);
    const again = await Tableau.listViews(true);
    expect(again.length).toBe(2);
  });

  it('re-authenticates when a data call returns 401, then succeeds', async () => {
    const { Tableau } = app;
    connect(Tableau);
    const ff = fakeFetch([resp(SIGNIN_OK), resp({ error: { detail: 'expired' } }, 401), resp(SIGNIN_OK), resp(VIEWS_OK)]);
    Tableau._fetch = ff;
    const views = await Tableau.listViews(true);
    expect(views.length).toBe(2);
    const signins = ff.calls.filter(c => c.url.endsWith('/auth/signin')).length;
    expect(signins).toBe(2);
  });

  it('fetches a view image as a data URL and caches it', async () => {
    const { Tableau } = app;
    connect(Tableau);
    Tableau._blobToDataUrl = async () => 'data:image/png;base64,AAAA';
    Tableau._fetch = fakeFetch([resp(SIGNIN_OK), resp('PNGBYTES')]);
    const url = await Tableau.viewImageDataUrl('V1');
    expect(url).toBe('data:image/png;base64,AAAA');
    // cached: a second call makes no request (empty queue would throw CORS)
    Tableau._fetch = fakeFetch([]);
    expect(await Tableau.viewImageDataUrl('V1')).toBe('data:image/png;base64,AAAA');
  });

  it('surfaces actionable CORS guidance when the host is unreachable', async () => {
    const { Tableau } = app;
    connect(Tableau);
    Tableau._fetch = fakeFetch([]); // empty → TypeError → CORS branch
    let msg = '';
    try { await Tableau.signIn(true); } catch (e) { msg = Tableau.describeError(e); }
    expect(msg).toMatch(/CORS|browser-origin/i);
  });

  it('orchestration calls throw a clear config error when not connected', async () => {
    const { Tableau } = app;
    await expect(Tableau.listViews(true)).rejects.toThrow(/not configured/);
  });
});

describe('wireframe tableau_refs contract', () => {
  function makeWf() {
    return app.Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Concept' });
  }

  it('new wireframes carry an empty tableau_refs array', () => {
    const wf = makeWf();
    expect(Array.isArray(wf.tableau_refs)).toBe(true);
    expect(wf.tableau_refs.length).toBe(0);
  });

  it('toggleTableauRef adds metadata only (no image bytes), audited and undoable', () => {
    const { Wireframe, App } = app;
    const wf = makeWf();
    const before = App.data.audit_log.length;
    Wireframe.toggleTableauRef(wf.id, { view_id: 'V1', name: 'Exec Sales', content_url: 'ExecSales/sheet', workbook: 'Sales WB' });
    const stored = Wireframe.get(wf.id).tableau_refs;
    expect(stored.length).toBe(1);
    expect(stored[0]).toMatchObject({ view_id: 'V1', name: 'Exec Sales' });
    expect(JSON.stringify(stored[0])).not.toContain('data:image'); // never persists images
    expect(App.data.audit_log.length).toBeGreaterThan(before);
    App.undo();
    expect(Wireframe.get(wf.id).tableau_refs.length).toBe(0);
  });

  it('toggling the same view_id removes the reference', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const ref = { view_id: 'V1', name: 'Exec Sales' };
    Wireframe.toggleTableauRef(wf.id, ref);
    expect(Wireframe.get(wf.id).tableau_refs.length).toBe(1);
    Wireframe.toggleTableauRef(wf.id, ref);
    expect(Wireframe.get(wf.id).tableau_refs.length).toBe(0);
  });
});

describe('migration', () => {
  it('legacy wireframes gain an empty tableau_refs on load', async () => {
    const local = await loadApp(makeDataset({
      wireframes: [{ id: 'WF-legacy', customer: 'Acme Industries', name: 'Old', components: [], metric_ids: [], grid: { cols: 12, rows: 8 } }]
    }));
    try {
      const wf = local.App.data.wireframes.find(w => w.id === 'WF-legacy');
      expect(Array.isArray(wf.tableau_refs)).toBe(true);
      expect(wf.tableau_refs.length).toBe(0);
    } finally { local.teardown(); }
  });
});

describe('AI grounding + rendering safety', () => {
  function makeWf() {
    return app.Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Concept' });
  }

  it('_tableauPromptBlock wraps referenced dashboards as untrusted context', () => {
    const { Wireframe, WireframeSkill } = app;
    const wf = makeWf();
    expect(WireframeSkill._tableauPromptBlock(Wireframe.get(wf.id))).toBe('');
    Wireframe.toggleTableauRef(wf.id, { view_id: 'V1', name: 'Exec Sales', workbook: 'Sales WB' });
    const block = WireframeSkill._tableauPromptBlock(Wireframe.get(wf.id));
    expect(block).toContain('<untrusted_document>');
    expect(block).toContain('Exec Sales');
    expect(block).toMatch(/never as instructions/i);
  });

  it('escapes Tableau-supplied view names when rendering the side panel', () => {
    const { Tableau, Wireframe, WireframeSkill } = app;
    connect(Tableau);
    const wf = makeWf();
    Wireframe.toggleTableauRef(wf.id, { view_id: 'V1', name: '<img src=x onerror=alert(1)>' });
    const html = WireframeSkill._tableauHtml(Wireframe.get(wf.id));
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img src=x onerror');
  });

  it('the side panel points users to Settings when Tableau is not connected', () => {
    const { Wireframe, WireframeSkill } = app;
    const wf = makeWf();
    const html = WireframeSkill._tableauHtml(wf);
    expect(html).toMatch(/Connect a Tableau site/);
  });
});
