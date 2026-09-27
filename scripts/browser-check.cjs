const {chromium}=require('C:/Users/NHU ANH/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');const path=require('path');
(async()=>{const dir=path.resolve(process.argv[2]||'qa');fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});const errors=[];const results=[];
for(const width of [1440,390,360]){const page=await browser.newPage({viewport:{width,height:width>600?1000:844},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
for(const route of ['/','/mua-ban','/cho-thue?market=international','/tin/1','/du-an/the-garden-riverside','/tin-tuc','/danh-ba','/dang-nhap']){const r=await page.goto('http://127.0.0.1:3000'+route,{waitUntil:'networkidle'});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}));});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);const broken=await page.locator('img').evaluateAll(a=>a.filter(x=>!x.complete||x.naturalWidth===0).length);results.push({width,route,status:r.status(),overflow,broken});if(route==='/'||route==='/tin/1'||route==='/dang-nhap')await page.screenshot({path:path.join(dir,`${width}-${route==='/'?'home':route==='/tin/1'?'listing':'login'}.png`),fullPage:true});}
await page.close();}
fs.writeFileSync(path.join(dir,'browser-results.json'),JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results}));await browser.close();})().catch(e=>{console.error(e);process.exit(1)});


