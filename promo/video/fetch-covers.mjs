import fs from 'node:fs';
const titles=['One Piece','Chainsaw Man','Jujutsu Kaisen','Blue Lock','Frieren','Dandadan','Kagurabachi','Berserk','Vagabond','Spy x Family','Sakamoto Days','Solo Leveling','Gachiakuta','Vinland Saga','Oshi no Ko','Kaiju No. 8'];
const H={'User-Agent':'InkoPromo/1.0'};
for(const t of titles){
  const r=await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(t)}&limit=1&order[relevance]=desc&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`,{headers:H});
  const j=await r.json(); const m=j.data?.[0]; if(!m){console.log('MISS',t);continue}
  const c=m.relationships.find(x=>x.type==='cover_art'); const fn=c?.attributes?.fileName; if(!fn){console.log('NOCOVER',t);continue}
  const url=`https://uploads.mangadex.org/covers/${m.id}/${fn}.512.jpg`;
  const b=Buffer.from(await (await fetch(url,{headers:H})).arrayBuffer());
  const slug=t.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  fs.writeFileSync(`covers/${slug}.jpg`,b); console.log('OK',slug,m.attributes.title.en||'',b.length);
  await new Promise(r=>setTimeout(r,250));
}
