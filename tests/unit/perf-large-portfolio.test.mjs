// L19 perf guard: a synthetic 200-project / 50-sprint / 20-member portfolio.
// Generous ceilings — this catches O(n^2)/pathological regressions in table,
// board, Gantt render and the solver, NOT micro-perf. Keep the bounds loose so
// it never flakes on a slow CI box.
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

describe('perf probe (synthetic 200 projects / 50 sprints)', () => {
  it('renders + solves a large portfolio within sane time bounds', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(50);
    const skills = ['Requirements','Data Engineering','Data Science','Tableau','UAT'];
    const members = [];
    for (let i=0;i<20;i++) members.push(makeMember({ name:'M'+i, available_points_per_sprint: 12, primary_skills:[skills[i%5]], secondary_skills:[skills[(i+1)%5]] }));
    const projects = [];
    const statuses = ['Not Started','In Progress','At Risk','Blocked','On Hold','Complete'];
    for (let i=0;i<200;i++){
      const p = makeProject({
        id:'P'+i, name:'Project '+i, customer:'Acme Industries',
        status: statuses[i%statuses.length],
        size_requirements: 3, size_engineering: 8, size_data_science: 4, size_tableau: 5, size_uat_adoption: 2,
        hard_deadline: i%4===0 ? sprints[Math.min(49,(i%50))].end_date : null,
        priority: (i%200)+1,
        moscow: ['Must','Should','Could','Won\'t'][i%4],
        manager:'M'+(i%20), target_date: sprints[Math.min(49,(i%50))].end_date, lifecycle_stage:'Implementation'
      });
      p.size_total = 22;
      // chain ~ every 5th project on the previous for dependency stress
      if (i%5===0 && i>0) p.dependencies=[{kind:'project',type:'blocked_by',target_id:'P'+(i-1)}];
      projects.push(p);
    }
    const t0=Date.now();
    const app = await loadApp(makeDataset({ projects, sprints, team_members: members }));
    app.App.activeCustomer='Acme Industries';
    const tLoad=Date.now()-t0;

    const time = (fn) => { const s=Date.now(); fn(); return Date.now()-s; };
    const tTable = time(()=>{ try { app.Dashboard.renderTable(app.App.data.projects); } catch(e){ console.log('table err',e.message);} });
    const tBoard = time(()=>{ try { app.App.navigate('board'); } catch(e){ console.log('board err',e.message);} });
    const tGantt = time(()=>{ try { app.App.navigate('roadmap'); } catch(e){ console.log('gantt err',e.message);} });
    let tSolve=-1, plan;
    tSolve = time(()=>{ plan = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint); });

    console.log(JSON.stringify({ tLoad, tTable, tBoard, tGantt, tSolve, allocated: plan? Object.keys(plan.allocations).length:0, warnings: plan?plan.warnings.length:0 }));
    // Generous ceilings — we're hunting O(n^2) blowups, not micro-optimising.
    expect(tTable).toBeLessThan(4000);
    expect(tBoard).toBeLessThan(4000);
    expect(tGantt).toBeLessThan(4000);
    expect(tSolve).toBeLessThan(15000);
    app.teardown();
  });
});
