import { chromium } from '@playwright/test';
const BASE='http://127.0.0.1:8799';
const VIEWS=['portfolio','dashboard','board','raid','backlog','roadmap','sprint','capacity','reports','strategy','personas','metrics','products','activity','config'];
const b=await chromium.launch({channel:'chromium-headless-shell'}).catch(()=>chromium.launch());
const p=await b.newPage({viewport:{width:1440,height:900}});
const json=await (await p.request.get(BASE+'/portfolio-data.json')).text();
await p.goto(BASE+'/index.html');
await p.evaluate(d=>{localStorage.setItem('portfolio-command-centre-data',d);localStorage.setItem('portfolio-command-centre-meta',JSON.stringify({savedAt:new Date().toISOString(),projectCount:JSON.parse(d).projects.length}));},json);
await p.reload();
const r=await p.$('#restoreBanner button.btn-primary'); if(r) await r.click();
await p.waitForSelector('#projectTableBody tr',{timeout:8000});
await p.evaluate(()=>App.setActiveCustomer('Acme Industries'));
for(const v of VIEWS){
  await p.evaluate(view=>App.navigate(view),v);
  await p.waitForTimeout(650);
  await p.screenshot({path:'dist/shots/v-'+v+'.png'});
  console.log('shot',v);
}
// Project detail panel
await p.evaluate(()=>App.navigate('dashboard'));
await p.waitForTimeout(400);
await p.click('#projectTableBody tr');
await p.waitForTimeout(900);
await p.screenshot({path:'dist/shots/v-detail.png'});
console.log('shot detail');
await b.close();
