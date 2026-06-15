// One-off generator for the Velocity capabilities deck (5 slides, 16:9).
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
const INK = '1F2937';        // slate-800 text
const MUTED = '64748B';      // slate-500
const INDIGO = '4F46E5';
const INDIGO_D = '3730A3';
const TEAL = '0F766E';
const BG = 'FFFFFF';
const PANEL = 'F1F5F9';      // slate-100
const PANEL_LINE = 'E2E8F0'; // slate-200

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.author = 'Velocity';
pptx.company = 'Velocity';
pptx.title = 'Velocity — Capabilities';

const W = 13.333, H = 7.5, MX = 0.62;

// Shared chrome: title band + footer. Returns the y where body content starts.
function chrome(slide, kicker, title) {
  slide.background = { color: BG };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: INDIGO } });
  if (kicker) slide.addText(kicker.toUpperCase(), { x: MX, y: 0.42, w: W - 2 * MX, h: 0.3, fontFace: 'Arial', fontSize: 12, color: TEAL, bold: true, charSpacing: 2 });
  slide.addText(title, { x: MX, y: 0.66, w: W - 2 * MX, h: 0.7, fontFace: 'Arial', fontSize: 27, color: INK, bold: true });
  slide.addShape(pptx.ShapeType.line, { x: MX, y: 1.5, w: W - 2 * MX, h: 0, line: { color: PANEL_LINE, width: 1.25 } });
  // footer
  slide.addText('Velocity — AI-native command centre for multi-customer delivery', { x: MX, y: H - 0.42, w: 9, h: 0.3, fontFace: 'Arial', fontSize: 9, color: MUTED });
  slide.addText('Zero-infra · client-only · any LLM', { x: W - MX - 4, y: H - 0.42, w: 4, h: 0.3, align: 'right', fontFace: 'Arial', fontSize: 9, color: MUTED });
  return 1.72;
}

// A rounded panel with a coloured heading bar + bulleted body.
function panel(slide, x, y, w, h, accent, heading, sub, bullets, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: opts.fill || PANEL }, line: { color: PANEL_LINE, width: 1 } });
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.07, rectRadius: 0.03, fill: { color: accent }, line: { type: 'none' } });
  let ty = y + 0.18;
  slide.addText(heading, { x: x + 0.2, y: ty, w: w - 0.4, h: 0.34, fontFace: 'Arial', fontSize: opts.headSize || 14.5, color: INK, bold: true });
  ty += 0.36;
  if (sub) { slide.addText(sub, { x: x + 0.2, y: ty, w: w - 0.4, h: 0.3, fontFace: 'Arial', fontSize: 10.5, color: TEAL, italic: true }); ty += 0.3; }
  const items = bullets.map((b, i) => ({ text: b, options: { bullet: { code: '2022', indent: 12 }, color: INK, fontSize: opts.bodySize || 11, paraSpaceAfter: opts.gap != null ? opts.gap : 5, breakLine: true } }));
  slide.addText(items, { x: x + 0.22, y: ty, w: w - 0.42, h: y + h - ty - 0.16, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 1.02 });
}

/* ---------- Slide 1: Title / what it is & what it solves ---------- */
{
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: BG } });
  // left accent column
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: H, fill: { color: INDIGO } });
  s.addText('VELOCITY', { x: MX, y: 1.55, w: 11, h: 0.5, fontFace: 'Arial', fontSize: 15, color: TEAL, bold: true, charSpacing: 4 });
  s.addText('The AI-native command centre for multi-customer delivery', { x: MX, y: 2.0, w: 11.4, h: 1.5, fontFace: 'Arial', fontSize: 33, color: INK, bold: true, lineSpacingMultiple: 1.04 });
  s.addText('Zero-infrastructure · runs in the browser · works with any LLM (cloud or local).', { x: MX, y: 3.5, w: 11, h: 0.4, fontFace: 'Arial', fontSize: 14, color: MUTED });

  // The problem it addresses
  s.addShape(pptx.ShapeType.roundRect, { x: MX, y: 4.15, w: W - 2 * MX, h: 2.45, rectRadius: 0.08, fill: { color: PANEL }, line: { color: PANEL_LINE, width: 1 } });
  s.addText('THE PROBLEM IT ADDRESSES', { x: MX + 0.25, y: 4.33, w: 11, h: 0.3, fontFace: 'Arial', fontSize: 11.5, color: INDIGO_D, bold: true, charSpacing: 1.5 });
  s.addText([
    { text: 'Teams running many customer accounts lose the thread across planning, capacity, commercials and documents — scattered across spreadsheets and decks, with no single grounded source of truth, and AI tools that hallucinate.', options: { fontSize: 13.5, color: INK, paraSpaceAfter: 9, breakLine: true } },
    { text: 'Velocity unifies portfolio planning, governed AI generation and commercial foresight in one place — every figure grounded in live data, every AI change confirmed, audited and reversible, and the whole app offline-capable and private.', options: { fontSize: 13.5, color: INK, breakLine: true } }
  ], { x: MX + 0.25, y: 4.66, w: W - 2 * MX - 0.5, h: 1.85, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 1.05 });

  s.addText('Capabilities overview — personas · functions · user journeys · what it addresses', { x: MX, y: H - 0.5, w: 11, h: 0.3, fontFace: 'Arial', fontSize: 10, color: MUTED });
}

/* ---------- Slide 2: Personas ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'Who it is for', 'Built for the people who run a multi-customer portfolio');
  const colW = (W - 2 * MX - 3 * 0.3) / 4;
  const personas = [
    ['Delivery Lead / PM', INDIGO, 'Owns projects across customers', ['Realistic, capacity-checked plans', 'Risk & RAID visibility at a glance', 'Status reports that draft themselves']],
    ['Resource / Capacity Mgr', TEAL, 'Balances one shared team', ['Capacity vs demand per sprint', 'Over-allocation guards (per-person)', 'What-if a person leaves / scope grows']],
    ['Commercial / Account Lead', INDIGO_D, 'Owns the numbers', ['Quotes from the plan, prepaid netted', 'Cost vs sell, margin & burn', 'Forecasts that tie to delivery']],
    ['Exec / Sponsor', '0E7490', 'Needs the trustworthy at-a-glance', ['What is at risk, and why', 'What changed this week', 'What it costs — and the outlook']]
  ];
  personas.forEach((p, i) => {
    const x = MX + i * (colW + 0.3);
    panel(s, x, y0, colW, 4.1, p[1], p[0], p[2], p[3], { headSize: 13, bodySize: 10.5, gap: 6 });
  });
  s.addText([
    { text: 'Strategy model — Persona vs Person:  ', options: { bold: true, color: INK } },
    { text: 'Persona is the seat (the role/archetype); Person is the human filling it. A RACI cascade runs objectives → metrics → the people accountable, so ownership is always explicit.', options: { color: MUTED } }
  ], { x: MX, y: y0 + 4.25, w: W - 2 * MX, h: 0.55, fontFace: 'Arial', fontSize: 11, valign: 'top' });
}

/* ---------- Slide 3: Functions (4 pillars + governed-AI spine) ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'What it does', 'Four pillars on a governed-AI spine');
  const colW = (W - 2 * MX - 0.3) / 2;
  const rowH = 1.95, gapY = 0.22;
  const pillars = [
    ['Agent & Assistant', INDIGO, 'Ask anything; do anything — grounded', ['Grounded Q&A with citations', 'NL-to-action: edit by sentence', 'Job Runner: whole jobs as one confirm + undo', 'Durable memory · ⌘K bridge · portfolio tidy-up']],
    ['Delivery planning & solver', TEAL, 'Plans that respect reality', ['Capacity-aware auto-allocation (rules R1–R12)', 'Dependency-aware scheduling + critical path', 'Scenario Lab: saved, comparable what-ifs', 'Kanban · Roadmap/Gantt · Backlog']],
    ['Docs & BI generation', INDIGO_D, 'Governed, and always current', ['SOWs: clause library, quote, review redline', 'Tableau wireframes: build spec + vision compare', 'Status reports & packs from live facts', 'Living docs: detect drift → one-click refresh']],
    ['Commercials & forecasting', '0E7490', 'Money tied to the plan', ['Cost vs sell · country×level rates · prepaid pools', 'Plan-driven revenue, margin & completion (P50/P80)', 'Scenario economics (£ deltas per what-if)', 'Health check + quote advisor']]
  ];
  pillars.forEach((p, i) => {
    const x = MX + (i % 2) * (colW + 0.3);
    const y = y0 + Math.floor(i / 2) * (rowH + gapY);
    panel(s, x, y, colW, rowH, p[1], p[0], p[2], p[3], { headSize: 14, bodySize: 10.5, gap: 4 });
  });
  const spineY = y0 + 2 * rowH + gapY + 0.18;
  s.addShape(pptx.ShapeType.roundRect, { x: MX, y: spineY, w: W - 2 * MX, h: 0.66, rectRadius: 0.08, fill: { color: '1E293B' }, line: { type: 'none' } });
  s.addText([
    { text: 'The trust spine:  ', options: { bold: true, color: 'FFFFFF' } },
    { text: 'every AI write is proposal → confirm → audited (source ai) → one-click undo.  Every figure is grounded in live data — never invented.', options: { color: 'E2E8F0' } }
  ], { x: MX + 0.25, y: spineY, w: W - 2 * MX - 0.5, h: 0.66, fontFace: 'Arial', fontSize: 12, valign: 'middle' });
}

/* ---------- Slide 4: User journeys ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'How it is used', 'Four end-to-end journeys');
  const journeys = [
    ['Plan the quarter', INDIGO, ['Import & size projects', 'Auto-Allocate (the solver)', 'Scenario Lab: “what if we add this / lose a person?”', 'Promote the winner — one undoable batch']],
    ['Win & scope the work', TEAL, ['Draft a SOW from the project’s own data', 'Generate the quote (prepaid netted off)', 'Reviewer comments → “Suggest edit” redline', 'Approve — freshness-gated']],
    ['Govern & report', INDIGO_D, ['Open “Needs your attention” (briefing + drift + £ + readiness)', 'Draft the status report from live facts', 'Refresh when the data drifts', 'Forum / customer pack']],
    ['Ask & act', '0E7490', ['“Which projects are at risk, and why?”', 'Grounded answer with deep-link citations', 'Assistant proposes the fixes', 'Confirm — applied, audited, undoable']]
  ];
  const colW = (W - 2 * MX - 0.3) / 2;
  const rowH = 2.18, gapY = 0.24;
  journeys.forEach((j, i) => {
    const x = MX + (i % 2) * (colW + 0.3);
    const y = y0 + Math.floor(i / 2) * (rowH + gapY);
    // step-flow heading with arrow chips
    slide_journey(s, x, y, colW, rowH, j[1], j[0], j[2]);
  });
}
function slide_journey(slide, x, y, w, h, accent, title, steps) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: PANEL }, line: { color: PANEL_LINE, width: 1 } });
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 0.07, h, rectRadius: 0.03, fill: { color: accent }, line: { type: 'none' } });
  slide.addText(title, { x: x + 0.22, y: y + 0.14, w: w - 0.4, h: 0.34, fontFace: 'Arial', fontSize: 15, color: INK, bold: true });
  const items = steps.map((st, i) => ({
    text: (i + 1) + '.  ' + st,
    options: { color: INK, fontSize: 11, paraSpaceAfter: 6, breakLine: true }
  }));
  slide.addText(items, { x: x + 0.24, y: y + 0.56, w: w - 0.46, h: h - 0.7, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 1.03 });
}

/* ---------- Slide 5: What it addresses / why different ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'What it addresses', 'Why Velocity is different');
  const items = [
    ['One grounded source of truth', 'Planning, commercials and documents for every customer in a single, consistent place — not five spreadsheets and a deck.'],
    ['AI you can trust on client work', 'Grounded in live data, confirmation-gated, fully audited and one-click reversible — safe to point at customer deliverables.'],
    ['Foresight, not just tracking', 'Dependency-aware plans, critical path, £ scenario economics and completion bands (P50/P80) — see the consequence before you commit.'],
    ['Documents that stay true', 'SOWs and reports detect when their source data drifts and refresh with a redline — no stale figures in front of a client.'],
    ['Zero-infra & private', 'Offline-capable, local-LLM friendly, no login or server; provider keys never leave the browser.']
  ];
  const colW = (W - 2 * MX - 0.3) / 2;
  const leftN = 3;
  items.forEach((it, i) => {
    const col = i < leftN ? 0 : 1;
    const idx = i < leftN ? i : i - leftN;
    const x = MX + col * (colW + 0.3);
    const y = y0 + idx * 1.18;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: colW, h: 1.05, rectRadius: 0.07, fill: { color: PANEL }, line: { color: PANEL_LINE, width: 1 } });
    s.addShape(pptx.ShapeType.roundRect, { x: x + 0.14, y: y + 0.16, w: 0.12, h: 0.73, rectRadius: 0.04, fill: { color: i % 2 ? TEAL : INDIGO }, line: { type: 'none' } });
    s.addText(it[0], { x: x + 0.38, y: y + 0.12, w: colW - 0.55, h: 0.32, fontFace: 'Arial', fontSize: 13.5, color: INK, bold: true });
    s.addText(it[1], { x: x + 0.38, y: y + 0.44, w: colW - 0.55, h: 0.58, fontFace: 'Arial', fontSize: 10.7, color: MUTED, valign: 'top', lineSpacingMultiple: 1.0 });
  });
  // outcome strip bottom-right cell
  const oy = y0 + 2 * 1.18, ox = MX + (colW + 0.3);
  s.addShape(pptx.ShapeType.roundRect, { x: ox, y: oy, w: colW, h: 1.05, rectRadius: 0.07, fill: { color: '1E293B' }, line: { type: 'none' } });
  s.addText([
    { text: 'The outcome\n', options: { bold: true, color: 'FFFFFF', fontSize: 13.5 } },
    { text: 'Faster, more realistic plans · defensible commercials · documents that stay true · AI you can trust on customer-facing work.', options: { color: 'E2E8F0', fontSize: 10.7 } }
  ], { x: ox + 0.22, y: oy + 0.12, w: colW - 0.4, h: 0.85, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 1.0 });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
await pptx.writeFile({ fileName: OUT });
console.log('Wrote', OUT);
