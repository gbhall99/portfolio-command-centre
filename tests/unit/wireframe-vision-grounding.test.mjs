// W1a — wireframe visual grounding. When the design model is vision-capable,
// AI draft/refine attaches reference images (a pasted/uploaded screenshot and
// any referenced Tableau dashboards). Images travel only in the request and
// never land in data.wireframes. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const PNG = 'iVBORw0KGgoAAAANSUhEUg';
const DATA_URL = 'data:image/png;base64,' + PNG;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function configureMock(vision) {
  const id = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock', vision: !!vision });
  app.AI.setDefaultProfile(id);
}
function programLayout() {
  app.AI.ADAPTERS.mock.program([{ text: JSON.stringify({ name: 'Exec', components: [{ type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'Exec' }] }) }]);
}

describe('WireframeSkill.visionReady', () => {
  it('reflects the design model capability', () => {
    configureMock(false);
    expect(app.WireframeSkill.visionReady()).toBe(false);
    configureMock(true);
    expect(app.WireframeSkill.visionReady()).toBe(true);
  });
});

describe('_groundingImages', () => {
  it('gathers the pasted reference image and referenced Tableau thumbnails', async () => {
    const { WireframeSkill, Wireframe, Tableau } = app;
    WireframeSkill._refImage = app.AI._normImage(DATA_URL);
    Tableau._imgCache = Tableau._imgCache || {};
    Tableau._imgCache['V1'] = 'data:image/png;base64,QUJD';
    const wf = Wireframe.create({ customer: 'Acme Industries', definition: app.Definitions.loadJson('tableau/wireframe-definition.json'), name: 'WF' });
    wf.tableau_refs = [{ view_id: 'V1', name: 'Live' }];
    const imgs = await WireframeSkill._groundingImages(wf);
    expect(imgs.length).toBe(2);
    expect(imgs[0]).toEqual({ mime: 'image/png', data: PNG });
    expect(imgs[1].data).toBe('QUJD');
    WireframeSkill._refImage = null;
  });
});

describe('aiDraft visual grounding', () => {
  it('attaches the reference image to the request when the model is vision-capable', async () => {
    const { WireframeSkill, AI } = app;
    configureMock(true);
    programLayout();
    WireframeSkill.open({ customer: 'Acme Industries' });
    WireframeSkill._refImage = AI._normImage(DATA_URL);
    await WireframeSkill.aiDraft('exec dashboard');
    const call = AI.ADAPTERS.mock._calls[0];
    const userMsg = call.messages.find(m => m.images && m.images.length);
    expect(userMsg).toBeTruthy();
    expect(userMsg.images[0]).toEqual({ mime: 'image/png', data: PNG });
    WireframeSkill._refImage = null;
  });

  it('does NOT attach images when the model is text-only', async () => {
    const { WireframeSkill, AI } = app;
    configureMock(false);
    programLayout();
    WireframeSkill.open({ customer: 'Acme Industries' });
    WireframeSkill._refImage = AI._normImage(DATA_URL);
    await WireframeSkill.aiDraft('exec dashboard');
    const call = AI.ADAPTERS.mock._calls[0];
    expect(call.messages.some(m => m.images && m.images.length)).toBe(false);
    WireframeSkill._refImage = null;
  });

  it('never persists image bytes into data.wireframes', async () => {
    const { WireframeSkill, AI, App } = app;
    configureMock(true);
    programLayout();
    WireframeSkill.open({ customer: 'Acme Industries' });
    WireframeSkill._refImage = AI._normImage(DATA_URL);
    await WireframeSkill.aiDraft('exec dashboard');
    expect(JSON.stringify(App.data.wireframes)).not.toContain(PNG);
    WireframeSkill._refImage = null;
  });
});
