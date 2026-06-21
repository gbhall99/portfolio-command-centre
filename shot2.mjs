import { chromium } from '@playwright/test';
const BASE='http://127.0.0.1:8799';
const b=await chromium.launch({channel:'chromium-headless-shell'}).catch(()=>chromium.launch());
const p=await b.newPage({viewport:{width:1440,height:900}});
const json=await (await p.request.get(BASE+'/portfolio-data.json')).text();
await p.goto(BASE+'/index.html');
await p.evaluate(d=>{localStorage.setItem('portfolio-command-centre-data',d);localStorage.setItem('portfolio-command-centre-meta',JSON.stringify({savedAt:new Date().toISOString(),projectCount:JSON.parse(d).projects.length}));},json);
await p.reload();
const r=await p.$('#restoreBanner button.btn-primary'); if(r) await r.click();
await p.waitForSelector('#projectTableBody tr',{timeout:8000});
await p.evaluate(()=>App.setActiveCustomer('Acme Industries'));
await p.waitForTimeout(300);
// open detail panel via DetailPanel API
await p.evaluate(()=>{const id=App.data.projects.find(x=>x.customer==='Acme Industries').id; DetailPanel.open(id);});
await p.waitForTimeout(900);
await p.screenshot({path:'dist/shots/x-detail.png'});
console.log('detail');
// Assistant
await p.evaluate(()=>Assistant.open());
await p.waitForTimeout(800);
await p.screenshot({path:'dist/shots/x-assistant.png'});
console.log('assistant');
await p.evaluate(()=>Assistant.close&&Assistant.close());
// Command palette
await p.keyboard.press('Control+k');
await p.waitForTimeout(600);
await p.screenshot({path:'dist/shots/x-palette.png'});
console.log('palette');
await b.close();
