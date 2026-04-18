// Tiny, composable fixture builders for unit tests.
// Prefer these over loading portfolio-data.json when testing a single rule or
// function — fixtures should isolate the behaviour under test.

let _idSeq = 0;
const nextId = (prefix = 'P') => prefix + '-' + String(++_idSeq).padStart(3, '0');

export function resetIdSeq() { _idSeq = 0; }

export function makeProject(overrides = {}) {
  const base = {
    id: nextId('Acme Industries'),
    name: 'Test Project',
    customer: 'Acme Industries',
    status: 'In Progress',
    priority: 1,
    category: 'General',
    rag_schedule: 'Green',
    rag_resourcing: 'Green',
    rag_scope: 'Green',
    size_requirements: 0,
    size_tableau: 0,
    size_engineering: 5,
    size_data_science: 0,
    size_uat_adoption: 0,
    size_total: 5,
    hard_deadline: null,
    target_date: null,
    start_date: null,
    risks_register: [],
    dependencies: [],
    delivery_config: { phase_order: ['Data Engineering'] },
    skill_splits: {}
  };
  const merged = { ...base, ...overrides };
  // Recompute size_total if individual sizes overridden but not total
  if (!('size_total' in overrides)) {
    merged.size_total = (merged.size_requirements || 0)
      + (merged.size_tableau || 0)
      + (merged.size_engineering || 0)
      + (merged.size_data_science || 0)
      + (merged.size_uat_adoption || 0);
  }
  return merged;
}

export function makeSprint(overrides = {}) {
  return {
    sprint_id: 'CY26-S1',
    start_date: '2026-01-05',
    end_date: '2026-02-06',
    hardening_start: '2026-02-02',
    ...overrides
  };
}

/**
 * Build a sequence of weekly-aligned sprints. Each sprint is 5 weeks (4 dev + 1 hardening).
 */
export function makeSprintSequence(n, startISO = '2026-01-05') {
  const sprints = [];
  let cursor = new Date(startISO);
  for (let i = 1; i <= n; i++) {
    const start = new Date(cursor);
    const hardening = new Date(cursor); hardening.setDate(hardening.getDate() + 28);
    const end = new Date(cursor); end.setDate(end.getDate() + 34);
    sprints.push({
      sprint_id: 'CY26-S' + i,
      start_date: start.toISOString().slice(0, 10),
      hardening_start: hardening.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10)
    });
    cursor = new Date(end); cursor.setDate(cursor.getDate() + 1);
  }
  return sprints;
}

export function makeMember(overrides = {}) {
  return {
    name: 'Test Member',
    customer: 'Acme Industries',
    primary_skills: ['Data Engineering'],
    secondary_skills: [],
    available_points_per_sprint: 20,
    sprint_overrides: {},
    holidays: [],
    ramp_profile: 'none',
    ...overrides
  };
}

export function makeDataset(overrides = {}) {
  return {
    meta: { version: '1.0' },
    projects: [],
    team_members: [],
    sprints: [],
    workflow_templates: [],
    governance_forums: [],
    annual_holidays: [],
    settings: {},
    audit_log: [],
    ...overrides
  };
}
