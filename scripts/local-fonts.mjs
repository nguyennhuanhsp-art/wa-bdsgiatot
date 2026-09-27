import fs from 'node:fs';import path from 'node:path';
const dir=path.join(process.cwd(),'apps/web/public/fonts');fs.mkdirSync(dir,{recursive:true});
const url='https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;450;500;550;600;650;700;750&display=swap';
const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'}});if(!r.ok)throw Error('Font stylesheet failed');let css=await r.text();
const urls=[...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))];let i=0;
for(const u of urls){const name=`be-vietnam-${++i}.${u.includes('.woff2')?'woff2':u.includes('.woff')?'woff':'ttf'}`;const f=await fetch(u);if(!f.ok)throw Error('Font download failed');fs.writeFileSync(path.join(dir,name),Buffer.from(await f.arrayBuffer()));css=css.split(u).join(`/fonts/${name}`);}
fs.writeFileSync(path.join(dir,'font.css'),css);console.log(`Saved ${urls.length} font files for local use.`);
