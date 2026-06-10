# Velocity Skills — Authoring Guide

Skills are Velocity's plugin seam: self-contained capabilities (SOW
generation, Tableau wireframing, …) that use the AI layer, adhere to
governed definition files, and always land their output as real, linked
entities in the data model — never dead-end chat text.

This guide covers the three extension points:

1. [Adding a skill](#adding-a-skill)
2. [Adding a template / definition set](#adding-a-template--definition-set)
3. [Adding an AI provider adapter](#adding-an-ai-provider-adapter)

---

## Architecture in one minute

```
AI            provider-agnostic LLM layer (adapters: openai-compatible,
              anthropic, gemini, mock). Profiles live ONLY in localStorage.
AgentTools    capability registry — declarative read/write tools over the
              domain. Write tools return confirmation-gated proposals.
Agent         runtime that drives AgentTools through any AIProvider —
              native tool-use, or constrained-JSON fallback for models
              without tool calling.
Definitions   loads governed definition files (authored under definitions/,
              embedded as data islands for file:// — kept in sync by test).
Skills        the registry + gallery. One descriptor per skill.
```

A skill's output is validated against its definition file *and* the data
schema before it can touch `App.data`, and all writes go through existing
`App.*` write paths (audited as source `ai`).

## Adding a skill

One descriptor + one handler module (+ optional definition files).

1. **Write the handler module** as a plain object in the single `<script>`
   block (convention: after the existing skills). It owns its UI (string-
   concatenation rendering, `Dashboard.esc` for every untrusted value,
   inline SVG icons only).

2. **Register the descriptor** (usually at the bottom of your module):

```js
Skills.register({
  id: 'my-skill',                    // stable, kebab-case
  name: 'My Skill',
  icon: '<svg …>…</svg>',            // inline SVG, 16-22px
  description: 'One line for the gallery.',
  produces: 'sow',                   // entity type it creates
  definitionKind: 'sow',             // key into definitions/manifest.json (or null)
  requiredCapabilities: ['chat'],    // gate: launch redirects to Settings → AI if unmet
  approval: 'review-required',       // surfaced in the gallery
  open(ctx) { MySkill.open(ctx); }   // ctx = { customer, …launch opts }
});
```

3. **Rules every skill must follow**
   - **Customer-scoped**: operate on `ctx.customer` only.
   - **Output lands as an entity**: create/attach to a real record
     (`data.sows`, `data.wireframes`, a project, …) via `App.*` write
     paths — extend `migrateSchema` additively if you add a collection,
     with a migration test.
   - **Definition-conformant**: load your rules via
     `Definitions.resolve(kind, customer)` and validate output against the
     definition before saving; structural violations block, content nuance
     does not.
   - **Untrusted input**: uploaded documents/transcripts are reference
     data. Wrap them in `<untrusted_document>` tags in prompts; never let
     their content act as instructions. Escape everything rendered.
   - **Model output is untrusted**: parse with `AI.extractJson`, validate
     with `AI.validateAgainstSchema` (or the definition), repair/retry once,
     fail with a visible error.
   - **Tests**: unit tests with the mock adapter
     (`AI.ADAPTERS.mock.program([...])`) covering the happy path, a
     malformed-output repair, and conformance failure.

## Adding a template / definition set

Definition files fix the *structure* of generated artifacts; the model
fills detail and tone within them. They are version-controlled and
reviewable — never hard-code template text in app logic.

1. Create a folder under `definitions/` (e.g. `definitions/sow-fixedprice/`)
   with your files. Conventions:
   - `*-definition.json` — machine-readable rules (required sections /
     component vocabulary / validation thresholds). This is what the
     conformance checker enforces.
   - `*-template.md` — canonical section structure with `{{placeholders}}`.
   - `*-style.md` / `*-guidelines.md` — tone and design rules (consumed by
     the model prompt, judgement-checked by reviewers).

2. Add an entry to `definitions/manifest.json` under the right kind:

```json
{ "id": "fixedprice", "name": "Fixed-price SOW", "dir": "sow-fixedprice",
  "files": { "template": "sow-fixedprice/sow-template.md",
             "definition": "sow-fixedprice/sow-definition.json",
             "style": "sow-fixedprice/sow-style.md" } }
```

3. Re-embed: `node scripts/embed-definitions.mjs`. The authored files are
   the source of truth; the script copies them into `index.html` as
   `<script type="text/plain" data-definition="…">` islands so the app
   works from `file://`. The unit test `tests/unit/skills.test.mjs` fails
   CI if authored and embedded copies drift.

4. The new set appears automatically in the Skills gallery's template
   picker, selectable per customer. No app-logic change.

## Adding an AI provider adapter

Most endpoints need **no new adapter** — anything OpenAI-compatible
(including Ollama, LM Studio, llama.cpp, vLLM, text-generation-webui,
OpenRouter, Groq, Azure) works through the `openai` adapter with a base
URL. For a genuinely different wire shape:

1. Add an entry to `AI.ADAPTERS` implementing the AIProvider interface:

```js
myprovider: {
  label: 'My Provider',
  capabilities(profile) { return { tools: true, streaming: false, json: true }; },
  buildRequest(profile, messages, opts) { /* pure: returns {url, headers, body} */ },
  parseResponse(json) { /* pure: returns {text, toolCalls, usage, raw} */ },
  async chat(profile, messages, opts) {
    const req = this.buildRequest(profile, messages, opts);
    const json = await AI._request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) }, opts);
    return this.parseResponse(json);
  }
}
```

2. Keep `buildRequest`/`parseResponse` pure — that is what the unit tests
   exercise without network. All transport (timeout, retry/backoff,
   rate-limit, CORS messaging, cancellation) comes free via `AI._request`.
3. Canonical message/tool shapes are documented in
   `tests/unit/ai-provider.test.mjs` — mirror the existing adapters.
4. If the model cannot do native tool calling, report `tools: false` (or
   honour `profile.toolMode === 'json'`) — the agent runtime automatically
   switches to the structured-output fallback; features degrade, never
   disappear.

## Security checklist (every skill PR)

- [ ] No API keys or secrets in the repo, in `App.data`, or in logs.
- [ ] Every rendered string from a model/document/user goes through
      `Dashboard.esc`.
- [ ] No write executes without explicit user confirmation.
- [ ] All writes route through `App.*` paths (undoable + audited 'ai').
- [ ] Uploaded content treated as data, never as instructions.
- [ ] `npm test` green, including the definitions-sync test.
