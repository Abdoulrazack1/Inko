import { chromium } from '../../node_modules/playwright/index.mjs';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
await c.addInitScript(()=>{localStorage.setItem('mh_eula_v2','{"acceptedAt":1,"version":1}');localStorage.setItem('inko_consent','1');localStorage.setItem('inko_tour_done','1');localStorage.setItem('inko_astuces_vues','["catalogue","bibliotheque","serie","chapitre","stats","profil","notifications","lecture"]')});
const p=await c.newPage();
const R=async(sel)=>{const e=await p.$(sel);return e?await e.boundingBox():null};
const T=async(txt)=>{const e=p.getByText(txt,{exact:false}).first();try{return await e.boundingBox({timeout:3000})}catch{return null}};
await p.goto('http://localhost:8088/accueil.html',{waitUntil:'networkidle'});await p.waitForTimeout(2500);
console.log('home reprendre',JSON.stringify(await T('Reprendre la lecture')),'stats',JSON.stringify(await T('chapitres lus')),'nouveaux',JSON.stringify(await T('Nouveaux chapitres')));
await p.goto('http://localhost:8088/lecture.html?manga=1342&chapter=1342%3Afull&source=gutenberg',{waitUntil:'networkidle'});await p.waitForTimeout(3000);
const h=await p.getByText('It is a truth universally acknowledged',{exact:false}).first();
try{await h.scrollIntoViewIfNeeded({timeout:5000});await p.mouse.wheel(0,520);await p.waitForTimeout(1200);}catch(e){console.log('notext')}
await p.screenshot({path:'shots/novel.png'});
await b.close();
