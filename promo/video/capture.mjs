// Captures réelles de l'app (serveur local :8088), profil Playwright jetable.
import { chromium } from '../../node_modules/playwright/index.mjs';
const [,, mode='scan', ...pages]=process.argv;
const BASE='http://localhost:8088/';
const b=await chromium.launch();
const mk=async (mobile)=>{const c=await b.newContext(mobile?{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}:{viewport:{width:1440,height:900},deviceScaleFactor:2});
  await c.addInitScript(()=>{try{localStorage.setItem('mh_eula_v2',JSON.stringify({acceptedAt:Date.now(),version:1}));localStorage.setItem('inko_consent','1');localStorage.setItem('inko_tour_done','1');localStorage.setItem('inko_astuces_vues',JSON.stringify(['catalogue','bibliotheque','serie','chapitre','stats','profil','notifications','accueil','lecture','sources']))}catch(e){}});return c};
for(const spec of pages){
  const [p,name,mob,wait='2500',scroll='0']=spec.split('|');
  const c=await mk(mob==='m'); const pg=await c.newPage();
  await pg.goto(BASE+p,{waitUntil:'networkidle',timeout:45000}).catch(e=>console.log('goto',e.message));
  await pg.waitForTimeout(+wait); if(+scroll)await pg.mouse.wheel(0,+scroll),await pg.waitForTimeout(1200);
  await pg.screenshot({path:`shots/${name}.png`,fullPage:mode==='full'}); console.log('ok',name,pg.url());
  await c.close();
}
await b.close();
