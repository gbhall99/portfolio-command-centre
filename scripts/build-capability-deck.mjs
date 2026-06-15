// One-off generator for the Velocity capabilities deck (6 slides, 16:9).
// Leads with the CORE platform; AI is shown as the complement. Framed for six
// roles: Product Owner, Scrum Master, Developer, Senior Manager, Director, Customer.
// Not part of the app build — run with: node scripts/build-capability-deck.mjs
// Requires pptxgenjs (installed --no-save). Output: dist/velocity-capabilities.pptx
import PptxGenJSImport from 'pptxgenjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PptxGenJS = PptxGenJSImport.default || PptxGenJSImport;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'velocity-capabilities.pptx');

// --- palette (matches the app) ---
const INK = '1F2937', MUTED = '64748B';
const INDIGO = '4F46E5', INDIGO_D = '3730A3', TEAL = '0F766E', CYAN = '0E7490';
const BG = 'FFFFFF', PANEL = 'F1F5F9', PANEL_LINE = 'E2E8F0', DARK = '1E293B';
const ACCENTS = [INDIGO, TEAL, INDIGO_D, CYAN];

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.author = 'Velocity'; pptx.company = 'Velocity'; pptx.title = 'Velocity — Capabilities';

const W = 13.333, H = 7.5, MX = 0.62;

function chrome(slide, kicker, title) {
  slide.background = { color: BG };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: INDIGO } });
  if (kicker) slide.addText(kicker.toUpperCase(), { x: MX, y: 0.4, w: W - 2 * MX, h: 0.3, fontFace: 'Arial', fontSize: 12, color: TEAL, bold: true, charSpacing: 2 });
  slide.addText(title, { x: MX, y: 0.63, w: W - 2 * MX, h: 0.6, fontFace: 'Arial', fontSize: 25, color: INK, bold: true });
  slide.addShape(pptx.ShapeType.line, { x: MX, y: 1.4, w: W - 2 * MX, h: 0, line: { color: PANEL_LINE, width: 1.25 } });
  slide.addText('Velocity — command centre for multi-customer delivery', { x: MX, y: H - 0.4, w: 9, h: 0.3, fontFace: 'Arial', fontSize: 9, color: MUTED });
  slide.addText('Core platform + complementary AI · client-only · any LLM', { x: W - MX - 5, y: H - 0.4, w: 5, h: 0.3, align: 'right', fontFace: 'Arial', fontSize: 9, color: MUTED });
  return 1.6;
}

// Tile: accent top-bar, heading, optional sub, bullets.
function tile(slide, x, y, w, h, accent, heading, sub, bullets, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.07, fill: { color: opts.fill || PANEL }, line: { color: PANEL_LINE, width: 1 } });
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.06, rectRadius: 0.03, fill: { color: accent }, line: { type: 'none' } });
  let ty = y + 0.15;
  slide.addText(heading, { x: x + 0.18, y: ty, w: w - 0.36, h: 0.3, fontFace: 'Arial', fontSize: opts.headSize || 13.5, color: INK, bold: true });
  ty += 0.31;
  if (sub) { slide.addText(sub, { x: x + 0.18, y: ty, w: w - 0.36, h: 0.26, fontFace: 'Arial', fontSize: 9.5, color: TEAL, italic: true }); ty += 0.26; }
  const items = bullets.map(b => ({ text: b, options: { bullet: { code: '2022', indent: 10 }, color: INK, fontSize: opts.bodySize || 10, paraSpaceAfter: opts.gap != null ? opts.gap : 3.5, breakLine: true } }));
  slide.addText(items, { x: x + 0.2, y: ty, w: w - 0.38, h: y + h - ty - 0.12, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 0.98 });
}

// A 2x2 grid of tiles within the body.
function grid2x2(slide, y0, defs) {
  const colW = (W - 2 * MX - 0.28) / 2;
  const rowH = (H - 0.62 - y0 - 0.24) / 2, gapY = 0.24;
  defs.forEach((d, i) => {
    const x = MX + (i % 2) * (colW + 0.28);
    const y = y0 + Math.floor(i / 2) * (rowH + gapY);
    tile(slide, x, y, colW, rowH, d.accent, d.head, d.sub, d.bullets, { headSize: 14, bodySize: 10.5, gap: 4 });
  });
}

/* ---------- Slide 1: Title + problem ---------- */
{
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: H, fill: { color: INDIGO } });
  s.addText('VELOCITY', { x: MX, y: 1.45, w: 11, h: 0.5, fontFace: 'Arial', fontSize: 15, color: TEAL, bold: true, charSpacing: 4 });
  s.addText('The command centre for multi-customer delivery', { x: MX, y: 1.9, w: 11.6, h: 1.2, fontFace: 'Arial', fontSize: 32, color: INK, bold: true, lineSpacingMultiple: 1.03 });
  s.addText('One browser-based app for the whole delivery lifecycle — backlog → plan → deliver → govern → report → bill — across every customer account. An optional AI layer complements the core; it never replaces it.',
    { x: MX, y: 3.15, w: 11.7, h: 0.8, fontFace: 'Arial', fontSize: 14, color: MUTED, lineSpacingMultiple: 1.05 });

  s.addShape(pptx.ShapeType.roundRect, { x: MX, y: 4.2, w: W - 2 * MX, h: 2.45, rectRadius: 0.08, fill: { color: PANEL }, line: { color: PANEL_LINE, width: 1 } });
  s.addText('THE PROBLEM IT ADDRESSES', { x: MX + 0.25, y: 4.38, w: 11, h: 0.3, fontFace: 'Arial', fontSize: 11.5, color: INDIGO_D, bold: true, charSpacing: 1.5 });
  s.addText([
    { text: 'Teams running many customer accounts juggle delivery, capacity, governance, commercials and customer reporting across spreadsheets, slides and disconnected tools — with no single, trustworthy source of truth.', options: { fontSize: 13.5, color: INK, paraSpaceAfter: 9, breakLine: true } },
    { text: 'Velocity unifies the lifecycle in one place: every figure traceable to live data, every change audited and reversible, and the whole app offline-capable and private — it works with any LLM, cloud or local.', options: { fontSize: 13.5, color: INK, breakLine: true } }
  ], { x: MX + 0.25, y: 4.7, w: W - 2 * MX - 0.5, h: 1.8, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 1.05 });
  s.addText('Capabilities for six roles — Product Owner · Scrum Master · Developer · Senior Manager · Director · Customer', { x: MX, y: H - 0.48, w: 12, h: 0.3, fontFace: 'Arial', fontSize: 10, color: MUTED });
}

/* ---------- Slide 2: Six personas ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'Who it is for', 'Built for the people who run a multi-customer portfolio');
  const personas = [
    ['Product Owner', 'Backlog · Strategy', ['Backlog Health & 3-stage readiness gates', 'WSJF + MoSCoW prioritisation', 'Scope, sizing, outcomes & metrics'], 'AI: tidy the backlog · edit by sentence · success stories'],
    ['Scrum Master', 'Sprint Planning · Board · Governance', ['Auto-Allocate solver (capacity + rules)', 'Board: WIP limits & swimlanes', 'RAID impediments · ceremonies & minutes'], 'AI: explain the plan · drift check · what-ifs'],
    ['Developer', 'Board · Capacity · Documents', ['My work & team schedule (assignments)', 'Skill allocations across sprints', 'Tableau wireframe builder + build spec'], 'AI: draft wireframes · compare-to-built · SOW sections'],
    ['Senior Manager', 'Dashboard · Capacity · Forecast', ['Portfolio RAG health & RAID rollups', 'Capacity vs demand & resourcing gaps', 'Forecast: velocity, P50/P80, EVM (SPI/CPI)'], 'AI: health check · status reports · portfolio Q&A'],
    ['Director', 'Portfolio · Commercials · Strategy', ['All-customers portfolio overview', 'Cost vs sell, margin, prepaid, quotes', 'Strategy cascade: objectives → metrics → RACI'], 'AI: commercial forecast · quote advisor · scenario economics'],
    ['Customer', 'Customer mode · Documents', ['Curated, read-only portfolio view', 'Branded packs & status reports', 'Milestones · headline / wins / asks'], 'AI: governed, grounded, always-current documents']
  ];
  const cols = 3, gap = 0.28;
  const cw = (W - 2 * MX - (cols - 1) * gap) / cols;
  const rh = 2.42, gy = 0.22;
  personas.forEach((p, i) => {
    const x = MX + (i % cols) * (cw + gap);
    const y = y0 + Math.floor(i / cols) * (rh + gy);
    const accent = ACCENTS[i % ACCENTS.length];
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: rh, rectRadius: 0.07, fill: { color: PANEL }, line: { color: PANEL_LINE, width: 1 } });
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 0.07, h: rh, rectRadius: 0.03, fill: { color: accent }, line: { type: 'none' } });
    s.addText(p[0], { x: x + 0.2, y: y + 0.13, w: cw - 0.35, h: 0.3, fontFace: 'Arial', fontSize: 14, color: INK, bold: true });
    s.addText(p[1], { x: x + 0.2, y: y + 0.45, w: cw - 0.35, h: 0.24, fontFace: 'Arial', fontSize: 9.5, color: TEAL, italic: true });
    s.addText(p[2].map(b => ({ text: b, options: { bullet: { code: '2022', indent: 9 }, color: INK, fontSize: 9.8, paraSpaceAfter: 3, breakLine: true } })),
      { x: x + 0.22, y: y + 0.74, w: cw - 0.4, h: 1.05, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 0.96 });
    s.addText(p[3], { x: x + 0.2, y: y + rh - 0.5, w: cw - 0.36, h: 0.46, fontFace: 'Arial', fontSize: 8.8, color: INDIGO_D, italic: true, valign: 'top', lineSpacingMultiple: 0.95 });
  });
  s.addText([{ text: 'Strategy model — Persona vs Person:  ', options: { bold: true, color: INK } }, { text: 'Persona is the role/seat; Person is the human filling it — with a RACI cascade from objectives → metrics → the people accountable.', options: { color: MUTED } }],
    { x: MX, y: y0 + 2 * rh + gy + 0.04, w: W - 2 * MX, h: 0.4, fontFace: 'Arial', fontSize: 10.5, valign: 'top' });
}

/* ---------- Slide 3: Core platform — Plan & Deliver ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'Core platform · 1 of 2', 'Plan & deliver — the delivery engine');
  grid2x2(s, y0, [
    { accent: INDIGO, head: 'Backlog & prioritisation', sub: 'Decide what matters, defensibly', bullets: ['Backlog Health (unrefined / refined / parked) + readiness gates', 'WSJF (value · urgency · risk ÷ size) and MoSCoW', 'Auto-prioritise with dry-run + “why this rank?”', 'Hard-deadline urgency + dependency leverage'] },
    { accent: TEAL, head: 'Capacity-aware planning — the solver', sub: 'One click, realistic plans', bullets: ['Auto-Allocate work across the sprint calendar', 'Rules R1–R12: per-person caps, phase buffers, day-budget', 'Dependency-aware ordering + critical path', 'Allocation results: utilisation, warnings, reasons'] },
    { accent: INDIGO_D, head: 'Execute — Board & Roadmap', sub: 'See and move the work', bullets: ['Kanban: 7 statuses, WIP limits, swimlanes, drag-to-move', 'Roadmap / Gantt with baselines & variance', 'Milestones (deadline / launch / UAT / customer)', 'Dependency arrows + critical-path overlay'] },
    { accent: CYAN, head: 'Capacity & workload', sub: 'Balance one shared team', bullets: ['Members: skills, ramp, holidays, contract-end, overrides', 'Holiday-aware capacity per member, per sprint', 'Capacity vs demand + resourcing-gap analysis', 'Member-impact simulator + per-person schedule'] }
  ]);
}

/* ---------- Slide 4: Core platform — Run the business ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'Core platform · 2 of 2', 'Govern, forecast, bill & report');
  grid2x2(s, y0, [
    { accent: INDIGO, head: 'RAID & governance', sub: 'Surface and resolve', bullets: ['Risks · Assumptions · Issues · Decisions · Actions registers', 'Severity = impact × probability, with escalation', 'Forums: cadence, roster, decision state machine', 'Walkthrough ceremony → minutes, agenda & packs'] },
    { accent: TEAL, head: 'Forecast & earned value', sub: 'Know where it lands', bullets: ['Velocity history per sprint', 'Monte-Carlo completion bands (P50 / P80 / P95)', 'Earned value: BAC / EV / AC, SPI / CPI', 'Capacity-vs-demand outlook'] },
    { accent: INDIGO_D, head: 'Commercials & billing', sub: 'Money tied to the plan', bullets: ['Cost (rate card) vs sell (rates by country × level)', 'Prepaid pools with deterministic drawdown', 'Quotes from the plan (planned points, prepaid netted)', 'Per-project margin + a costs report'] },
    { accent: CYAN, head: 'Strategy, documents & reports', sub: 'Outcomes and the paper trail', bullets: ['Objectives → metrics (actuals/targets) → RACI · persona vs person', 'Governed SOWs (clauses, quote, review redline)', 'Tableau wireframes (governed vocabulary + build spec)', '11-report catalogue — packs, status, costs — branded, print-to-PDF'] }
  ]);
}

/* ---------- Slide 5: AI complements the core ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'AI complements the core', 'A governed AI layer on top — grounded, gated, reversible');
  const colW = (W - 2 * MX - 0.28) / 2;
  const rowH = 1.72, gapY = 0.2;
  const tiles = [
    { accent: INDIGO, head: 'Assistant', sub: 'Ask anything; do anything', bullets: ['Grounded answers with deep-link citations', 'NL-to-action: edit projects & the plan by sentence', 'Job Runner: a whole job as one confirm + one undo', '⌘K command bridge · durable memory'] },
    { accent: TEAL, head: 'Plan intelligence', sub: 'Understand & stress-test', bullets: ['Explain the plan: binding constraints + levers', 'On-demand drift check vs the last solve', 'Scenario Lab: saved, comparable what-ifs', '£ scenario economics + quote advisor'] },
    { accent: INDIGO_D, head: 'Governed generation', sub: 'Documents that draft & stay current', bullets: ['Draft SOWs, wireframes & status reports', 'Living docs: detect drift → one-click refresh', 'Metric-movement narration · success stories', 'Every figure grounded — never invented'] },
    { accent: CYAN, head: 'Foresight & hygiene', sub: 'On demand, never on its own', bullets: ['Commercial forecast (revenue / margin / completion)', '“Needs your attention” health check', 'Tidy the portfolio (dedupe RAID, normalise priorities)', 'Review-driven “suggest edit” redlines'] }
  ];
  tiles.forEach((d, i) => {
    const x = MX + (i % 2) * (colW + 0.28);
    const y = y0 + Math.floor(i / 2) * (rowH + gapY);
    tile(s, x, y, colW, rowH, d.accent, d.head, d.sub, d.bullets, { headSize: 13.5, bodySize: 10, gap: 3 });
  });
  const spineY = y0 + 2 * rowH + gapY + 0.06;
  s.addShape(pptx.ShapeType.roundRect, { x: MX, y: spineY, w: W - 2 * MX, h: 0.66, rectRadius: 0.08, fill: { color: DARK }, line: { type: 'none' } });
  s.addText([{ text: 'Trust by design:  ', options: { bold: true, color: 'FFFFFF' } }, { text: 'every AI write is proposal → confirm → audited (source ai) → one-click undo.  Works with any LLM — cloud or local; provider keys never leave the browser.', options: { color: 'E2E8F0' } }],
    { x: MX + 0.25, y: spineY, w: W - 2 * MX - 0.5, h: 0.66, fontFace: 'Arial', fontSize: 11.5, valign: 'middle' });
}

/* ---------- Slide 6: What it addresses / why different ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'What it addresses', 'Why Velocity is different');
  const items = [
    ['One source of truth, whole lifecycle', 'Backlog, plan, delivery, governance, commercials and customer reporting — one consistent place, per customer, not five spreadsheets and a deck.'],
    ['AI that complements the core', 'Grounded in live data, confirmation-gated, fully audited and one-click reversible — safe to point at client deliverables; the core works fully without it.'],
    ['Foresight, not just tracking', 'Dependency-aware plans, critical path, earned value, completion bands and £ scenario economics — see the consequence before you commit.'],
    ['Documents that stay true', 'SOWs, quotes and reports are grounded in live figures, detect when the data drifts, and refresh with a redline — no stale numbers in front of a client.'],
    ['Zero-infra & private', 'Runs in the browser, offline-capable, local-LLM friendly, no login or server; customer data and provider keys never leave the machine.']
  ];
  const colW = (W - 2 * MX - 0.3) / 2;
  const cardH = 1.02, stepY = 1.14, leftN = 3;
  items.forEach((it, i) => {
    const col = i < leftN ? 0 : 1, idx = i < leftN ? i : i - leftN;
    const x = MX + col * (colW + 0.3), y = y0 + idx * stepY;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: colW, h: cardH, rectRadius: 0.07, fill: { color: PANEL }, line: { color: PANEL_LINE, width: 1 } });
    s.addShape(pptx.ShapeType.roundRect, { x: x + 0.14, y: y + 0.16, w: 0.12, h: cardH - 0.32, rectRadius: 0.04, fill: { color: i % 2 ? TEAL : INDIGO }, line: { type: 'none' } });
    s.addText(it[0], { x: x + 0.38, y: y + 0.12, w: colW - 0.55, h: 0.3, fontFace: 'Arial', fontSize: 13.5, color: INK, bold: true });
    s.addText(it[1], { x: x + 0.38, y: y + 0.42, w: colW - 0.55, h: 0.56, fontFace: 'Arial', fontSize: 10.5, color: MUTED, valign: 'top', lineSpacingMultiple: 0.98 });
  });
  const oy = y0 + 2 * stepY, ox = MX + (colW + 0.3);
  s.addShape(pptx.ShapeType.roundRect, { x: ox, y: oy, w: colW, h: cardH, rectRadius: 0.07, fill: { color: DARK }, line: { type: 'none' } });
  s.addText([{ text: 'The outcome\n', options: { bold: true, color: 'FFFFFF', fontSize: 13.5 } }, { text: 'Faster, more realistic plans · defensible commercials · documents that stay true · AI you can trust on customer-facing work.', options: { color: 'E2E8F0', fontSize: 10.5 } }],
    { x: ox + 0.22, y: oy + 0.12, w: colW - 0.4, h: cardH - 0.2, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 0.98 });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
await pptx.writeFile({ fileName: OUT });
console.log('Wrote', OUT);
