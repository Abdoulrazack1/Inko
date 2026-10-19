// Rendu image par image : node render.mjs [stills t1,t2,...] | [fps sub]
import { chromium } from '../../node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const mode=process.argv[2]||'video';
const browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:1080,height:1350}});
page.on('console',m=>{if(m.type()==='error')console.error('PAGE',m.text())}); page.on('pageerror',e=>console.error('PAGEERR',e.message));
await page.goto(pathToFileURL(path.join(here,'index.html')).href); await page.evaluate(()=>window.ready);
if(mode==='stills'){
  const out=process.argv[4]||path.join(here,'stills'); fs.mkdirSync(out,{recursive:true});
  for(const t of process.argv[3].split(',').map(Number)){await page.evaluate(t=>render(t),t);await page.screenshot({path:path.join(out,`t${t.toFixed(2)}.jpg`),type:'jpeg',quality:80});}
}else{
  const FPS=30,SUB=+(process.argv[3]||4),DUR=20; const N=FPS*DUR*SUB;
  const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS*SUB),'-c:v','mjpeg','-i','-',
    '-vf',`tmix=frames=${SUB}:weights=${'1 '.repeat(SUB).trim()},fps=${FPS}`,'-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p',path.join(here,'_video.mp4')],{stdio:['pipe','inherit','inherit']});
  const t0=Date.now();
  for(let i=0;i<N;i++){const t=(i+.5)/(FPS*SUB)-(.5/FPS);await page.evaluate(t=>render(Math.max(0,t)),t);
    const buf=await page.screenshot({type:'jpeg',quality:96}); if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
    if(i%120===0)console.log(i,'/',N,((Date.now()-t0)/1000).toFixed(0)+'s');}
  ff.stdin.end(); await new Promise(r=>ff.on('close',r));
}
await browser.close();
