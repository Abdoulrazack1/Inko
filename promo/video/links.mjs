import { chromium } from '../../node_modules/playwright/index.mjs';
const b=await chromium.launch();const c=await b.newContext({viewport:{width:1440,height:900}});
await c.addInitScript(()=>{localStorage.setItem('mh_eula_v2','{"acceptedAt":1,"version":1}');localStorage.setItem('inko_consent','1');localStorage.setItem('inko_tour_done','1')});
const p=await c.newPage();await p.goto('http://localhost:8088/accueil.html',{waitUntil:'networkidle'});await p.waitForTimeout(2000);
console.log((await p.$$eval('a[href]',as=>as.map(a=>a.getAttribute('href')+' :: '+(a.textContent||'').trim().slice(0,40)))).filter(h=>/serie|chapitre|lecture/.test(h)).slice(0,25).join('\n'));
await b.close();
