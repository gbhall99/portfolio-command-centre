// Generator for the Velocity capabilities deck — Deloitte-branded, 12 slides, 16:9.
// Leads with the CORE platform; AI shown as the complement. Six role one-pagers
// (Product Owner, Scrum Master, Developer, Senior Manager, Director, Customer)
// with real app screenshots. Branding is a recreation of the Deloitte palette +
// a text wordmark — it does NOT embed the trademarked logo artwork.
// Run: node scripts/build-capability-deck.mjs   (needs pptxgenjs --no-save + dist/shots/*.png)
// Output: dist/velocity-capabilities.pptx
import PptxGenJSImport from 'pptxgenjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PptxGenJS = PptxGenJSImport.default || PptxGenJSImport;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const SHOTS = path.join(OUT_DIR, 'shots');
const OUT = path.join(OUT_DIR, 'velocity-capabilities.pptx');
const shot = (n) => path.join(SHOTS, n + '.png');
const hasShot = (n) => fs.existsSync(shot(n));

// --- Deloitte-style palette (recreated; no logo artwork) ---
const BLACK = '000000', INK = '1A1A1A', GREEN = '86BC25', GREEN_D = '5A7D1E';
const MUTED = '6B7280', PANEL = 'F4F6F3', LINE = 'D8E0D4', DARK = '000000';

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.author = 'Deloitte'; pptx.company = 'Deloitte'; pptx.title = 'Velocity — Capabilities';
const W = 13.333, H = 7.5, MX = 0.62;

function wordmark(slide, x, y, dark) {
  slide.addText([{ text: 'Deloitte', options: { color: dark ? 'FFFFFF' : BLACK, bold: true } }, { text: '.', options: { color: GREEN, bold: true } }],
    { x, y, w: 1.5, h: 0.3, fontFace: 'Arial', fontSize: 13, align: 'right' });
}

function chrome(slide, kicker, title) {
  slide.background = { color: 'FFFFFF' };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.14, fill: { color: BLACK } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.14, w: W, h: 0.03, fill: { color: GREEN } });
  if (kicker) slide.addText(kicker.toUpperCase(), { x: MX, y: 0.42, w: W - 2.2 * MX, h: 0.3, fontFace: 'Arial', fontSize: 11.5, color: GREEN_D, bold: true, charSpacing: 2 });
  slide.addText(title, { x: MX, y: 0.64, w: W - 2 * MX, h: 0.6, fontFace: 'Arial', fontSize: 24, color: INK, bold: true });
  slide.addShape(pptx.ShapeType.line, { x: MX, y: 1.42, w: W - 2 * MX, h: 0, line: { color: LINE, width: 1.25 } });
  wordmark(slide, W - MX - 1.5, 0.44, false);
  slide.addText('Velocity — command centre for multi-customer delivery', { x: MX, y: H - 0.4, w: 9, h: 0.3, fontFace: 'Arial', fontSize: 9, color: MUTED });
  slide.addText('Core platform + complementary AI · client-only · any LLM', { x: W - MX - 5, y: H - 0.4, w: 5, h: 0.3, align: 'right', fontFace: 'Arial', fontSize: 9, color: MUTED });
  return 1.62;
}

function tile(slide, x, y, w, h, accent, heading, sub, bullets, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: opts.fill || PANEL }, line: { color: LINE, width: 1 } });
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.06, rectRadius: 0.03, fill: { color: accent }, line: { type: 'none' } });
  let ty = y + 0.15;
  slide.addText(heading, { x: x + 0.18, y: ty, w: w - 0.36, h: 0.3, fontFace: 'Arial', fontSize: opts.headSize || 13.5, color: INK, bold: true }); ty += 0.31;
  if (sub) { slide.addText(sub, { x: x + 0.18, y: ty, w: w - 0.36, h: 0.26, fontFace: 'Arial', fontSize: 9.5, color: GREEN_D, italic: true }); ty += 0.26; }
  const items = bullets.map(b => ({ text: b, options: { bullet: { code: '2022', indent: 10 }, color: INK, fontSize: opts.bodySize || 10, paraSpaceAfter: opts.gap != null ? opts.gap : 3.5, breakLine: true } }));
  slide.addText(items, { x: x + 0.2, y: ty, w: w - 0.38, h: y + h - ty - 0.12, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 0.98 });
}
function grid2x2(slide, y0, defs) {
  const colW = (W - 2 * MX - 0.28) / 2, rowH = (H - 0.62 - y0 - 0.24) / 2, gapY = 0.24;
  defs.forEach((d, i) => tile(slide, MX + (i % 2) * (colW + 0.28), y0 + Math.floor(i / 2) * (rowH + gapY), colW, rowH, d.accent, d.head, d.sub, d.bullets, { headSize: 14, bodySize: 10.5, gap: 4 }));
}
function shotImage(slide, x, y, w, file, caption) {
  const h = w * 820 / 1366;
  slide.addShape(pptx.ShapeType.rect, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1.25 } });
  if (hasShot(file)) slide.addImage({ path: shot(file), x, y, w, h });
  else slide.addText('[ ' + file + ' ]', { x, y, w, h, align: 'center', valign: 'middle', color: MUTED, fontFace: 'Arial', fontSize: 12 });
  if (caption) slide.addText(caption, { x, y: y + h + 0.04, w, h: 0.26, fontFace: 'Arial', fontSize: 9, color: MUTED, italic: true });
  return h;
}

/* ---------- Slide 1: Title (black hero) ---------- */
{
  const s = pptx.addSlide();
  s.background = { color: BLACK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 3.06, w: 2.0, h: 0.06, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('VELOCITY', { x: MX, y: 2.3, w: 11, h: 0.5, fontFace: 'Arial', fontSize: 15, color: GREEN, bold: true, charSpacing: 5 });
  s.addText('The command centre for multi-customer delivery', { x: MX, y: 3.2, w: 11.8, h: 1.3, fontFace: 'Arial', fontSize: 33, color: 'FFFFFF', bold: true, lineSpacingMultiple: 1.03 });
  s.addText('One browser-based app for the whole delivery lifecycle — backlog → plan → deliver → govern → report → bill — across every customer account.  An optional AI layer complements the core; it never replaces it.',
    { x: MX, y: 4.55, w: 11.4, h: 1.0, fontFace: 'Arial', fontSize: 14, color: 'CBD5E1', lineSpacingMultiple: 1.06 });
  s.addText('Capabilities for six roles — Product Owner · Scrum Master · Developer · Senior Manager · Director · Customer', { x: MX, y: 6.45, w: 11.4, h: 0.3, fontFace: 'Arial', fontSize: 10.5, color: GREEN });
  wordmark(s, W - MX - 1.8, 0.55, true);
}

/* ---------- Slide 2: Personas map ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'Who it is for', 'Six roles, one source of truth');
  const personas = [
    ['Product Owner', 'Backlog · Strategy', ['Backlog Health & readiness gates', 'WSJF + MoSCoW prioritisation', 'Scope, sizing, outcomes & metrics'], 'AI: tidy the backlog · edit by sentence · success stories'],
    ['Scrum Master', 'Planning · Board · Governance', ['Auto-Allocate solver (capacity + rules)', 'Board: WIP limits & swimlanes', 'RAID impediments · ceremonies & minutes'], 'AI: explain the plan · drift check · what-ifs'],
    ['Developer', 'Board · Capacity · Documents', ['My work & team schedule', 'Skill allocations across sprints', 'Tableau wireframe builder + build spec'], 'AI: draft wireframes · compare-to-built · SOW sections'],
    ['Senior Manager', 'Dashboard · Capacity · Forecast', ['Portfolio RAG health & RAID rollups', 'Capacity vs demand & resourcing gaps', 'Forecast: velocity, P50/P80, EVM'], 'AI: health check · status reports · portfolio Q&A'],
    ['Director', 'Portfolio · Commercials · Strategy', ['All-customers portfolio overview', 'Cost vs sell, margin, prepaid, quotes', 'Strategy cascade: objectives → metrics → RACI'], 'AI: commercial forecast · quote advisor · scenario £'],
    ['Customer', 'Customer mode · Documents', ['Curated, read-only portfolio view', 'Branded packs & status reports', 'Milestones · headline / wins / asks'], 'AI: governed, grounded, always-current documents']
  ];
  const cols = 3, gap = 0.28, cw = (W - 2 * MX - (cols - 1) * gap) / cols, rh = 2.42, gy = 0.22;
  personas.forEach((p, i) => {
    const x = MX + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (rh + gy);
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: rh, rectRadius: 0.06, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 0.07, h: rh, rectRadius: 0.03, fill: { color: GREEN }, line: { type: 'none' } });
    s.addText(p[0], { x: x + 0.2, y: y + 0.13, w: cw - 0.35, h: 0.3, fontFace: 'Arial', fontSize: 14, color: INK, bold: true });
    s.addText(p[1], { x: x + 0.2, y: y + 0.45, w: cw - 0.35, h: 0.24, fontFace: 'Arial', fontSize: 9.5, color: GREEN_D, italic: true });
    s.addText(p[2].map(b => ({ text: b, options: { bullet: { code: '2022', indent: 9 }, color: INK, fontSize: 9.8, paraSpaceAfter: 3, breakLine: true } })), { x: x + 0.22, y: y + 0.74, w: cw - 0.4, h: 1.05, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 0.96 });
    s.addText(p[3], { x: x + 0.2, y: y + rh - 0.5, w: cw - 0.36, h: 0.46, fontFace: 'Arial', fontSize: 8.8, color: GREEN_D, italic: true, valign: 'top', lineSpacingMultiple: 0.95 });
  });
  s.addText([{ text: 'Strategy model — Persona vs Person:  ', options: { bold: true, color: INK } }, { text: 'Persona is the role/seat; Person is the human filling it — with a RACI cascade objectives → metrics → the people accountable.', options: { color: MUTED } }], { x: MX, y: y0 + 2 * rh + gy + 0.04, w: W - 2 * MX, h: 0.4, fontFace: 'Arial', fontSize: 10.5, valign: 'top' });
}

/* ---------- Slides 3-8: per-role one-pagers ---------- */
function onePager(role, job, steps, coreList, aiLine, file, caption) {
  const s = pptx.addSlide();
  const y0 = chrome(s, role + ' · end-to-end', role + ' — ' + job);
  // Left: the journey
  const lx = MX, lw = 5.5;
  s.addText('A DAY IN THE FLOW', { x: lx, y: y0, w: lw, h: 0.28, fontFace: 'Arial', fontSize: 11, color: GREEN_D, bold: true, charSpacing: 1.5 });
  const items = steps.map((st, i) => ({ text: st, options: { color: INK, fontSize: 11.5, paraSpaceAfter: 8, breakLine: true, bullet: { type: 'number', numberType: 'arabicPeriod', indent: 16 } } }));
  s.addText(items, { x: lx + 0.05, y: y0 + 0.34, w: lw - 0.1, h: 4.6, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 1.02 });
  // Right: screenshot + a compact "core capabilities" / "AI helps" info block.
  const rx = 6.55, rw = 5.85;
  const imgH = shotImage(s, rx, y0 + 0.02, rw, file, caption);   // imgH ≈ 3.51
  let iy = y0 + 0.02 + imgH + 0.36;       // below image + caption
  s.addShape(pptx.ShapeType.line, { x: rx, y: iy, w: rw, h: 0, line: { color: LINE, width: 1 } });
  iy += 0.1;
  s.addText([{ text: 'Core capabilities:  ', options: { bold: true, color: GREEN_D } }, { text: coreList, options: { color: INK } }],
    { x: rx, y: iy, w: rw, h: 0.5, fontFace: 'Arial', fontSize: 10, valign: 'top', lineSpacingMultiple: 1.0 });
  s.addText([{ text: 'Where AI helps:  ', options: { bold: true, color: GREEN_D } }, { text: aiLine, options: { color: INK } }],
    { x: rx, y: H - 1.12, w: rw, h: 0.7, fontFace: 'Arial', fontSize: 10, valign: 'top', lineSpacingMultiple: 1.0 });
}

onePager('Product Owner', 'shape the backlog, prove the outcome',
  ['Capture & size new work — phases and skill points on each project.',
   'Refine the backlog — Backlog Health clears unrefined/stale; the readiness gates (backlog → planning → steerco) turn green.',
   'Prioritise with WSJF + MoSCoW; run Auto-Prioritise as a dry-run and check “why this rank?”.',
   'Tie work to value — objectives, metrics (with targets) and outcomes/benefits.',
   'Track delivery on the roadmap and tell the win with a Success Story.'],
  'Backlog Health · readiness gates · WSJF & MoSCoW · auto-prioritise · objectives & metrics.',
  'tidy the backlog, edit priorities & scope by sentence, and draft success stories with grounded metric movement.',
  'projects', 'Projects / portfolio — backlog, sizing, RAG & priority');

onePager('Scrum Master', 'realistic plans, flowing work, no surprises',
  ['Build the sprint plan — one click Auto-Allocate across the sprint calendar.',
   'Read the allocation results — utilisation, deadline misses, who is over capacity, and why.',
   'Stress-test — Scenario Lab “what if we add this / lose a person?”; ask the plan to explain itself.',
   'Run the board — WIP limits, swimlanes, drag transitions; clear impediments in RAID.',
   'Run the ceremony — the walkthrough captures decisions, actions and minutes.'],
  'Auto-Allocate solver (rules R1–R12) · allocation results · Board · RAID · governance walkthrough.',
  'explain the plan’s binding constraints, run an on-demand drift check, and model what-ifs before you commit.',
  'board', 'Board — statuses, WIP, swimlanes, drag-to-move');

onePager('Developer', 'build with clarity — know the work and the spec',
  ['See my work — the by-assignee board and a per-person schedule across the next sprints.',
   'Pick up the next card; status flows on the board as work progresses.',
   'Build the dashboard from a governed Tableau wireframe — with a field/calc map and an acceptance checklist.',
   'Raise issues and risks in RAID as they surface.',
   'Compare the built dashboard against the approved concept before sign-off.'],
  'By-assignee board · skill allocations & team schedule · wireframe builder + build spec · RAID.',
  'AI-draft a conforming wireframe, run a vision compare-to-built, and draft SOW sections.',
  'capacity', 'Capacity & workload — team schedule and load');

onePager('Senior Manager', 'delivery health across every account',
  ['Scan the portfolio — projects table with RAG health (schedule / resource / scope) and RAID rollups.',
   'Check capacity vs demand and resourcing gaps over the coming sprints.',
   'Read the forecast — velocity, completion bands (P50/P80) and earned value (SPI/CPI).',
   'Open “Needs your attention” — briefing, plan drift, commercial and readiness flags in one digest.',
   'Send the story up and out — a grounded status report.'],
  'Dashboard & RAG health · capacity vs demand · Forecast & EVM · governance forums · status reports.',
  'an on-demand health check, plan explainer, auto-drafted status reports, and grounded portfolio Q&A.',
  'roadmap', 'Roadmap / Gantt — timeline, baselines, milestones, critical path');

onePager('Director', 'the portfolio and the commercials, together',
  ['See the whole book — the all-customers portfolio overview.',
   'Run the commercials — cost vs sell, prepaid drawdown, quotes and margin per project and customer.',
   'Steer strategy — objectives → metrics (with actuals & targets) → who is accountable (RACI).',
   'Weigh trade-offs in the Scenario Lab — each what-if carries its £ economics.',
   'Brief the business with branded packs and reports.'],
  'Portfolio overview · commercials & billing · strategy cascade · Scenario Lab economics · reports.',
  'a commercial forecast (revenue/margin/completion), a quote advisor, and £ deltas on every scenario.',
  'strategy', 'Strategy — objectives, metrics and RACI cascade');

onePager('Customer', 'a clear, trustworthy view of their delivery',
  ['Receive a curated, read-only portfolio view — no internal noise.',
   'See progress on a customer roadmap — dates and milestones, not internal resourcing.',
   'Read a branded status report or portfolio pack — grounded in live figures, classified for sharing.',
   'Track the commitments that matter — customer milestones, plus the headline / wins / asks.',
   'Sign off scope on a governed SOW with a quote that ties to the plan.'],
  'Customer mode · customer roadmap · branded packs & status reports · milestones & narrative · SOWs.',
  'every customer document is governed, grounded in live data, and flags itself for refresh when the data drifts.',
  'roadmap', 'Customer roadmap — dates & milestones (curated)');

/* ---------- Slide 9: Core — Plan & Deliver ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'Core platform · 1 of 2', 'Plan & deliver — the delivery engine');
  grid2x2(s, y0, [
    { accent: GREEN, head: 'Backlog & prioritisation', sub: 'Decide what matters, defensibly', bullets: ['Backlog Health + 3-stage readiness gates', 'WSJF (value · urgency · risk ÷ size) and MoSCoW', 'Auto-prioritise with dry-run + “why this rank?”', 'Hard-deadline urgency + dependency leverage'] },
    { accent: GREEN, head: 'Capacity-aware planning — the solver', sub: 'One click, realistic plans', bullets: ['Auto-Allocate work across the sprint calendar', 'Rules R1–R12: per-person caps, phase buffers, day-budget', 'Dependency-aware ordering + critical path', 'Allocation results: utilisation, warnings, reasons'] },
    { accent: GREEN, head: 'Execute — Board & Roadmap', sub: 'See and move the work', bullets: ['Kanban: 7 statuses, WIP limits, swimlanes, drag', 'Roadmap / Gantt with baselines & variance', 'Milestones (deadline / launch / UAT / customer)', 'Dependency arrows + critical-path overlay'] },
    { accent: GREEN, head: 'Capacity & workload', sub: 'Balance one shared team', bullets: ['Members: skills, ramp, holidays, contract-end, overrides', 'Holiday-aware capacity per member, per sprint', 'Capacity vs demand + resourcing-gap analysis', 'Member-impact simulator + per-person schedule'] }
  ]);
}

/* ---------- Slide 10: Core — Run the business ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'Core platform · 2 of 2', 'Govern, forecast, bill & report');
  grid2x2(s, y0, [
    { accent: GREEN, head: 'RAID & governance', sub: 'Surface and resolve', bullets: ['Risks · Assumptions · Issues · Decisions · Actions registers', 'Severity = impact × probability, with escalation', 'Forums: cadence, roster, decision state machine', 'Walkthrough ceremony → minutes, agenda & packs'] },
    { accent: GREEN, head: 'Forecast & earned value', sub: 'Know where it lands', bullets: ['Velocity history per sprint', 'Monte-Carlo completion bands (P50 / P80 / P95)', 'Earned value: BAC / EV / AC, SPI / CPI', 'Capacity-vs-demand outlook'] },
    { accent: GREEN, head: 'Commercials & billing', sub: 'Money tied to the plan', bullets: ['Cost (rate card) vs sell (rates by country × level)', 'Prepaid pools with deterministic drawdown', 'Quotes from the plan (planned points, prepaid netted)', 'Per-project margin + a costs report'] },
    { accent: GREEN, head: 'Strategy, documents & reports', sub: 'Outcomes and the paper trail', bullets: ['Objectives → metrics → RACI · persona vs person', 'Governed SOWs (clauses, quote, review redline)', 'Tableau wireframes (governed vocabulary + build spec)', '11-report catalogue — packs, status, costs — branded, print-to-PDF'] }
  ]);
}

/* ---------- Slide 11: AI complements the core ---------- */
{
  const s = pptx.addSlide();
  const y0 = chrome(s, 'AI complements the core', 'A governed AI layer on top — grounded, gated, reversible');
  const colW = (W - 2 * MX - 0.28) / 2, rowH = 1.72, gapY = 0.2;
  const tiles = [
    { head: 'Assistant', sub: 'Ask anything; do anything', bullets: ['Grounded answers with deep-link citations', 'NL-to-action: edit projects & the plan by sentence', 'Job Runner: a whole job as one confirm + one undo', '⌘K command bridge · durable memory'] },
    { head: 'Plan intelligence', sub: 'Understand & stress-test', bullets: ['Explain the plan: binding constraints + levers', 'On-demand drift check vs the last solve', 'Scenario Lab: saved, comparable what-ifs', '£ scenario economics + quote advisor'] },
    { head: 'Governed generation', sub: 'Documents that draft & stay current', bullets: ['Draft SOWs, wireframes & status reports', 'Living docs: detect drift → one-click refresh', 'Metric-movement narration · success stories', 'Every figure grounded — never invented'] },
    { head: 'Foresight & hygiene', sub: 'On demand, never on its own', bullets: ['Commercial forecast (revenue / margin / completion)', '“Needs your attention” health check', 'Tidy the portfolio (dedupe RAID, normalise priorities)', 'Review-driven “suggest edit” redlines'] }
  ];
  tiles.forEach((d, i) => tile(s, MX + (i % 2) * (colW + 0.28), y0 + Math.floor(i / 2) * (rowH + gapY), colW, rowH, GREEN, d.head, d.sub, d.bullets, { headSize: 13.5, bodySize: 10, gap: 3 }));
  const spineY = y0 + 2 * rowH + gapY + 0.06;
  s.addShape(pptx.ShapeType.roundRect, { x: MX, y: spineY, w: W - 2 * MX, h: 0.66, rectRadius: 0.06, fill: { color: BLACK }, line: { type: 'none' } });
  s.addShape(pptx.ShapeType.roundRect, { x: MX, y: spineY, w: 0.08, h: 0.66, rectRadius: 0.03, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText([{ text: 'Trust by design:  ', options: { bold: true, color: GREEN } }, { text: 'every AI write is proposal → confirm → audited (source ai) → one-click undo.  Works with any LLM — cloud or local; provider keys never leave the browser.', options: { color: 'E2E8F0' } }], { x: MX + 0.28, y: spineY, w: W - 2 * MX - 0.5, h: 0.66, fontFace: 'Arial', fontSize: 11.5, valign: 'middle' });
}

/* ---------- Slide 12: What it addresses ---------- */
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
  const colW = (W - 2 * MX - 0.3) / 2, cardH = 1.02, stepY = 1.14, leftN = 3;
  items.forEach((it, i) => {
    const col = i < leftN ? 0 : 1, idx = i < leftN ? i : i - leftN;
    const x = MX + col * (colW + 0.3), y = y0 + idx * stepY;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: colW, h: cardH, rectRadius: 0.06, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
    s.addShape(pptx.ShapeType.roundRect, { x: x + 0.14, y: y + 0.16, w: 0.12, h: cardH - 0.32, rectRadius: 0.04, fill: { color: GREEN }, line: { type: 'none' } });
    s.addText(it[0], { x: x + 0.38, y: y + 0.12, w: colW - 0.55, h: 0.3, fontFace: 'Arial', fontSize: 13.5, color: INK, bold: true });
    s.addText(it[1], { x: x + 0.38, y: y + 0.42, w: colW - 0.55, h: 0.56, fontFace: 'Arial', fontSize: 10.5, color: MUTED, valign: 'top', lineSpacingMultiple: 0.98 });
  });
  const oy = y0 + 2 * stepY, ox = MX + (colW + 0.3);
  s.addShape(pptx.ShapeType.roundRect, { x: ox, y: oy, w: colW, h: cardH, rectRadius: 0.06, fill: { color: BLACK }, line: { type: 'none' } });
  s.addShape(pptx.ShapeType.roundRect, { x: ox, y: oy, w: 0.1, h: cardH, rectRadius: 0.04, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText([{ text: 'The outcome\n', options: { bold: true, color: GREEN, fontSize: 13.5 } }, { text: 'Faster, more realistic plans · defensible commercials · documents that stay true · AI you can trust on customer-facing work.', options: { color: 'E2E8F0', fontSize: 10.5 } }], { x: ox + 0.26, y: oy + 0.12, w: colW - 0.45, h: cardH - 0.2, fontFace: 'Arial', valign: 'top', lineSpacingMultiple: 0.98 });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
await pptx.writeFile({ fileName: OUT });
console.log('Wrote', OUT);
